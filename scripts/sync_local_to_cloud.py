#!/usr/bin/env python3
"""
Sync local SQL Server → cloud Azure SQL.

Applies pending schema migrations to the cloud DB, then MERGEs reference
data (cards, categories, issuers, networks, currencies, portals) from
local → cloud. Wallet and user table data is never touched.

Usage
-----
    python3 scripts/sync_local_to_cloud.py [--dry-run] [--no-delete]

Requirements
------------
    pyodbc + ODBC Driver 18 for SQL Server (brew install msodbcsql18)
    .env at repo root with LOCAL_DATABASE_URL and DATABASE_URL
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

REPO_ROOT = Path(__file__).resolve().parent.parent

try:
    import pyodbc
except ImportError:
    sys.exit("pyodbc not found. Run: pip install pyodbc")

try:
    from dotenv import load_dotenv
    load_dotenv(REPO_ROOT / ".env")
except ImportError:
    pass

MIGRATIONS_DIR = REPO_ROOT / "backend" / "migrations"

# Tables whose data is synced, in dependency order (parents before children).
DATA_TABLES: list[str] = [
    "issuers",
    "co_brands",
    "networks",
    "network_tiers",
    "currencies",               # self-ref: converts_to_currency_id
    "spend_categories",         # self-ref: parent_id
    "travel_portals",
    "cards",
    "card_multiplier_groups",
    "card_category_multipliers",
    "rotating_categories",
    "credits",
    "card_credits",
    "travel_portal_cards",
    "issuer_application_rules",
]

# Self-referential FK tables need NOCHECK during MERGE so row order doesn't matter.
SELF_REF_TABLES: frozenset[str] = frozenset({"currencies", "spend_categories"})

BATCH_SIZE = 500


def sync(*, dry_run: bool = False, delete_orphans: bool = True) -> None:
    """Apply schema migrations and sync reference data from local to cloud."""

    def url_to_pyodbc(url: str) -> str:
        url = re.sub(r"^mssql\+(?:aioodbc|pyodbc)://", "x://", url)
        p = urlparse(url)
        userinfo, _, hostinfo = p.netloc.rpartition("@")
        host, _, port = hostinfo.partition(":")
        uid, _, pwd = userinfo.partition(":")
        database = p.path.lstrip("/")
        qs = parse_qs(p.query)
        driver = qs.get("driver", ["ODBC Driver 18 for SQL Server"])[0].replace("+", " ")
        parts = [
            f"DRIVER={{{driver}}}",
            f"SERVER={host},{port or '1433'}",
            f"DATABASE={database}",
            f"UID={unquote(uid)}",
            f"PWD={{{unquote(pwd)}}}",
        ]
        for key in ("Encrypt", "TrustServerCertificate"):
            val = (qs.get(key) or [None])[0]
            if val:
                parts.append(f"{key}={val}")
        return ";".join(parts)

    local_url = os.environ.get("LOCAL_DATABASE_URL", "")
    cloud_url = os.environ.get("DATABASE_URL", "")
    if not local_url:
        sys.exit("LOCAL_DATABASE_URL not set in .env")
    if not cloud_url:
        sys.exit("DATABASE_URL not set in .env")

    print("Connecting...")
    try:
        src = pyodbc.connect(url_to_pyodbc(local_url), autocommit=False)
        print("  connected to local")
    except pyodbc.Error as e:
        sys.exit(f"Cannot connect to local: {e}")
    try:
        dst = pyodbc.connect(url_to_pyodbc(cloud_url), autocommit=False)
        print("  connected to cloud")
    except pyodbc.Error as e:
        sys.exit(f"Cannot connect to cloud: {e}")

    if dry_run:
        print("\n[DRY RUN — no changes will be written]")

    # ── Schema migrations ────────────────────────────────────────────────────
    print("\n── Schema migrations ──────────────────────────────────────────")
    cur = dst.cursor()
    cur.execute("""
        IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'schema_migrations') AND type = 'U')
        BEGIN
            CREATE TABLE schema_migrations (
                id         NVARCHAR(255)     PRIMARY KEY,
                applied_at DATETIMEOFFSET(7) NOT NULL DEFAULT GETUTCDATE()
            )
        END
    """)
    dst.commit()

    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        cur.execute("SELECT 1 FROM schema_migrations WHERE id = ?", f.name)
        if cur.fetchone():
            print(f"  skip  {f.name}")
            continue
        print(f"  apply {f.name}" + ("  (dry-run)" if dry_run else ""))
        if not dry_run:
            for batch in re.split(r"^\s*GO\s*$", f.read_text(), flags=re.MULTILINE | re.IGNORECASE):
                if batch.strip():
                    cur.execute(batch.strip())
            cur.execute("INSERT INTO schema_migrations (id) VALUES (?)", f.name)
            dst.commit()

    # ── Reference data sync ──────────────────────────────────────────────────
    print("\n── Reference data ─────────────────────────────────────────────")
    dst_tables = {
        r[0] for r in dst.cursor().execute(
            "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'"
        )
    }

    for table in DATA_TABLES:
        if table not in dst_tables:
            print(f"  {table}: not in cloud yet — run migrations first")
            continue

        # Introspect columns and PK from source
        src_cur = src.cursor()
        src_cur.execute(
            "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
            table,
        )
        cols = [r[0] for r in src_cur.fetchall()]

        src_cur.execute("""
            SELECT ccu.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu
                ON ccu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME AND ccu.TABLE_NAME = tc.TABLE_NAME
            WHERE tc.TABLE_NAME = ? AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        """, table)
        pk_cols = [r[0] for r in src_cur.fetchall()]

        src_cur.execute(
            "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(?) AND is_identity = 1",
            table,
        )
        identity = bool(src_cur.fetchone()[0])

        src_cur.execute(f"SELECT {', '.join(f'[{c}]' for c in cols)} FROM [{table}]")
        rows = src_cur.fetchall()

        print(f"  {table:<42} {len(rows):>5} rows", end="", flush=True)
        if dry_run:
            print("  (dry-run)")
            continue

        non_pk_cols = [c for c in cols if c not in pk_cols]
        q_cols = ", ".join(f"[{c}]" for c in cols)
        temp = f"#sync_{table}"

        on_clause = " AND ".join(f"t.[{c}] = s.[{c}]" for c in pk_cols)
        matched = ("WHEN MATCHED THEN UPDATE SET " + ", ".join(f"t.[{c}] = s.[{c}]" for c in non_pk_cols)) if non_pk_cols else ""
        not_matched = f"WHEN NOT MATCHED BY TARGET THEN INSERT ({q_cols}) VALUES ({', '.join(f's.[{c}]' for c in cols)})"
        insert_sql = f"INSERT INTO [{temp}] ({q_cols}) VALUES ({', '.join('?' * len(cols))})"

        # Attempt with delete; fall back to upsert-only if a FK violation is hit
        # (means a cloud wallet still references a row that was deleted locally).
        for attempt_delete in ([True, False] if delete_orphans else [False]):
            delete_clause = "WHEN NOT MATCHED BY SOURCE THEN DELETE" if attempt_delete else ""
            merge_sql = "\n".join(filter(None, [
                f"MERGE INTO [{table}] AS t",
                f"USING [{temp}] AS s ON {on_clause}",
                matched,
                not_matched,
                delete_clause + ";",
            ]))
            try:
                dst_cur = dst.cursor()
                dst_cur.execute(f"SELECT TOP 0 {q_cols} INTO [{temp}] FROM [{table}]")
                if identity:
                    dst_cur.execute(f"SET IDENTITY_INSERT [{temp}] ON")
                for i in range(0, len(rows), BATCH_SIZE):
                    dst_cur.executemany(insert_sql, [tuple(r) for r in rows[i : i + BATCH_SIZE]])
                if identity:
                    dst_cur.execute(f"SET IDENTITY_INSERT [{temp}] OFF")

                if table in SELF_REF_TABLES:
                    dst_cur.execute(f"ALTER TABLE [{table}] NOCHECK CONSTRAINT ALL")
                if identity:
                    dst_cur.execute(f"SET IDENTITY_INSERT [{table}] ON")
                dst_cur.execute(merge_sql)
                affected = dst_cur.rowcount
                if identity:
                    dst_cur.execute(f"SET IDENTITY_INSERT [{table}] OFF")
                if table in SELF_REF_TABLES:
                    dst_cur.execute(f"ALTER TABLE [{table}] WITH CHECK CHECK CONSTRAINT ALL")

                dst.commit()
                suffix = "  (upsert-only — FK violation blocked delete)" if not attempt_delete and delete_orphans else ""
                print(f"  → {affected} affected{suffix}")
                break

            except pyodbc.Error as exc:
                dst.rollback()
                if attempt_delete and "547" in str(exc):
                    print(f"\n    FK violation on delete — retrying [{table}] as upsert-only...")
                    continue
                print(f"\n    ERROR syncing [{table}]: {exc}")
                raise
            finally:
                c = dst.cursor()
                c.execute(f"IF OBJECT_ID('tempdb..[{temp}]') IS NOT NULL DROP TABLE [{temp}]")
                dst.commit()

    src.close()
    dst.close()
    print("\nDone.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="Show planned changes without writing")
    ap.add_argument("--no-delete", action="store_true", help="Upsert only; skip delete of cloud-only rows")
    args = ap.parse_args()
    sync(dry_run=args.dry_run, delete_orphans=not args.no_delete)
