"""
Migrate data from local PostgreSQL (creditcards) to SQL Server (Azure or local).

Usage:
    python3 scripts/migrate_pg_to_mssql.py

Reads connection strings from environment / .env:
  PG_SOURCE_URL   — source PostgreSQL DB (default: postgresql://ryansliao@localhost:5432/creditcards)
  DATABASE_URL    — target SQL Server DB (mssql+aioodbc:// or mssql:// scheme)

The script:
1. Reads every row from the source PostgreSQL tables.
2. Disables all FK constraints on the target.
3. Truncates destination tables in reverse-FK order.
4. Inserts rows with SET IDENTITY_INSERT ON for tables that have IDENTITY columns.
5. Re-enables FK constraints.
6. Reseeds IDENTITY sequences to max(id).
"""

import os
import re
import sys
from pathlib import Path

# ── Load .env from project root ──────────────────────────────────────────────
project_root = Path(__file__).resolve().parents[1]
env_path = project_root / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip())

import psycopg2
import pyodbc

# ── Connection strings ────────────────────────────────────────────────────────
PG_URL = os.environ.get("PG_SOURCE_URL", "postgresql://ryansliao@localhost:5432/creditcards")
MSSQL_URL = os.environ.get("DATABASE_URL", "")

if not MSSQL_URL:
    print("ERROR: DATABASE_URL not set", file=sys.stderr)
    sys.exit(1)

# Parse mssql+aioodbc://user:pass@host:port/db?params  →  pyodbc connection string
def parse_mssql_url(url: str) -> str:
    """Convert SQLAlchemy DATABASE_URL to a pyodbc connection string."""
    # Strip scheme
    url = re.sub(r"^mssql\+aioodbc://|^mssql\+pyodbc://|^mssql://|^sqlserver://", "", url)
    # Split userinfo from host/path
    userinfo, _, rest = url.partition("@")
    user, _, password = userinfo.partition(":")
    # Decode %24 → $ etc.
    import urllib.parse
    password = urllib.parse.unquote(password)
    # host:port/db?params
    hostport_db, _, params_str = rest.partition("?")
    hostport, _, db = hostport_db.partition("/")
    host, _, port = hostport.partition(":")
    port = port or "1433"

    # Parse query params
    params = {}
    for part in params_str.split("&"):
        if "=" in part:
            k, _, v = part.partition("=")
            params[k] = urllib.parse.unquote(v)

    driver = params.get("driver", "ODBC Driver 18 for SQL Server").replace("+", " ")
    encrypt = params.get("Encrypt", "yes")
    trust = params.get("TrustServerCertificate", "no")

    cs = (
        f"DRIVER={{{driver}}};"
        f"SERVER={host},{port};"
        f"DATABASE={db};"
        f"UID={user};"
        f"PWD={password};"
        f"Encrypt={encrypt};"
        f"TrustServerCertificate={trust};"
    )
    return cs

MSSQL_CS = parse_mssql_url(MSSQL_URL)

# ── Table order (FK-safe insert order) ───────────────────────────────────────
# Tables listed from least-dependent to most-dependent.
# Truncation uses the reverse.
TABLE_ORDER = [
    "users",
    "issuers",
    "co_brands",
    "networks",
    "network_tiers",
    "currencies",
    "spend_categories",        # self-referential (parent_id) — handled by disabling FKs
    "cards",
    "card_category_multipliers",
    "card_multiplier_groups",
    "card_credits",
    "card_rotating_history",
    "rotating_categories",
    "issuer_application_rules",
    "travel_portals",
    "travel_portal_cards",
    "credits",
    "wallets",
    "wallet_cards",
    "wallet_spend_items",
    "wallet_spend_categories",
    "wallet_spend_category_mappings",
    "wallet_currency_balances",
    "wallet_currency_cpp",
    "wallet_card_credits",
    "wallet_card_multipliers",
    "wallet_card_group_selections",
    "wallet_card_category_priorities",
    "wallet_card_rotation_overrides",
    "wallet_portal_shares",
]

# Tables that have IDENTITY (autoincrement) primary key columns named "id"
IDENTITY_TABLES = {
    "users", "issuers", "co_brands", "networks", "network_tiers",
    "currencies", "spend_categories", "cards", "card_category_multipliers",
    "card_multiplier_groups", "card_rotating_history",
    "rotating_categories", "issuer_application_rules", "travel_portals",
    "credits", "wallets", "wallet_cards",
    "wallet_spend_items", "wallet_spend_categories",
    "wallet_currency_balances", "wallet_currency_cpp", "wallet_card_credits",
    "wallet_card_multipliers", "wallet_card_group_selections",
    "wallet_card_category_priorities", "wallet_card_rotation_overrides",
    "wallet_portal_shares",
    # wallet_spend_category_mappings — check dynamically
}
# Tables that do NOT have an identity/autoincrement id column (composite PKs)
NON_IDENTITY_TABLES = {"card_credits", "travel_portal_cards", "wallet_spend_category_mappings"}


def pg_connect():
    # psycopg2 accepts a DSN or URI
    return psycopg2.connect(PG_URL)


def mssql_connect():
    return pyodbc.connect(MSSQL_CS, timeout=30)


def fetch_table(pg_cur, table: str):
    pg_cur.execute(f'SELECT * FROM "{table}"')
    cols = [d[0] for d in pg_cur.description]
    rows = pg_cur.fetchall()
    return cols, rows


def quote_val(v):
    """Return a SQL-safe literal for pyodbc executemany (uses ? placeholders — not used here,
    but kept for reference). We use parameterised queries everywhere."""
    return v


def mssql_table_exists(ms_cur, table: str) -> bool:
    ms_cur.execute(
        "SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(?) AND type = 'U'",
        (table,),
    )
    return ms_cur.fetchone() is not None


def disable_all_fks(ms_conn):
    cur = ms_conn.cursor()
    cur.execute(
        """
        DECLARE @sql NVARCHAR(MAX) = N'';
        SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))
            + '.' + QUOTENAME(OBJECT_NAME(parent_object_id))
            + ' NOCHECK CONSTRAINT ' + QUOTENAME(name) + ';' + CHAR(13)
        FROM sys.foreign_keys;
        EXEC sp_executesql @sql;
        """
    )
    ms_conn.commit()
    cur.close()


def enable_all_fks(ms_conn):
    cur = ms_conn.cursor()
    cur.execute(
        """
        DECLARE @sql NVARCHAR(MAX) = N'';
        SELECT @sql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))
            + '.' + QUOTENAME(OBJECT_NAME(parent_object_id))
            + ' WITH CHECK CHECK CONSTRAINT ' + QUOTENAME(name) + ';' + CHAR(13)
        FROM sys.foreign_keys;
        EXEC sp_executesql @sql;
        """
    )
    ms_conn.commit()
    cur.close()


def truncate_tables(ms_conn, tables):
    cur = ms_conn.cursor()
    for table in reversed(tables):
        if mssql_table_exists(cur, table):
            print(f"  Truncating {table}…")
            cur.execute(f"DELETE FROM [{table}]")
    ms_conn.commit()
    cur.close()


def coerce_value(v):
    """Convert PostgreSQL values to SQL Server compatible types."""
    if v is None:
        return None
    # psycopg2 returns booleans as Python bool; SQL Server BIT wants 1/0
    if isinstance(v, bool):
        return 1 if v else 0
    # Dates and datetimes pass through fine
    return v


def insert_table(ms_conn, table: str, cols, rows):
    if not rows:
        print(f"  {table}: 0 rows (skipped)")
        return
    cur = ms_conn.cursor()
    use_identity = table in IDENTITY_TABLES and table not in NON_IDENTITY_TABLES

    col_list = ", ".join(f"[{c}]" for c in cols)
    placeholders = ", ".join("?" for _ in cols)
    sql = f"INSERT INTO [{table}] ({col_list}) VALUES ({placeholders})"

    if use_identity:
        cur.execute(f"SET IDENTITY_INSERT [{table}] ON")

    batch = []
    for row in rows:
        batch.append(tuple(coerce_value(v) for v in row))

    try:
        cur.fast_executemany = True
        cur.executemany(sql, batch)
    except Exception:
        # Fall back to row-by-row for better error messages
        cur.fast_executemany = False
        for i, row_vals in enumerate(batch):
            try:
                cur.execute(sql, row_vals)
            except Exception as e:
                print(f"    ERROR on row {i} of {table}: {e}")
                print(f"    Row: {row_vals}")
                raise

    if use_identity:
        cur.execute(f"SET IDENTITY_INSERT [{table}] OFF")

    ms_conn.commit()
    print(f"  {table}: {len(rows)} rows inserted")
    cur.close()


def reseed_identities(ms_conn, tables):
    """Reset IDENTITY seeds to max(id) so future inserts don't collide."""
    cur = ms_conn.cursor()
    for table in tables:
        if table not in IDENTITY_TABLES:
            continue
        if not mssql_table_exists(cur, table):
            continue
        cur.execute(f"SELECT MAX(id) FROM [{table}]")
        row = cur.fetchone()
        max_id = row[0] if row and row[0] is not None else 0
        if max_id > 0:
            cur.execute(f"DBCC CHECKIDENT ('{table}', RESEED, {max_id})")
    ms_conn.commit()
    cur.close()


def main():
    print("=== PostgreSQL → SQL Server migration ===")
    print(f"Source: {PG_URL}")
    # Mask password in display
    display_target = re.sub(r"PWD=[^;]+;", "PWD=***;", MSSQL_CS)
    print(f"Target: {display_target}")
    print()

    print("Connecting to PostgreSQL…")
    pg_conn = pg_connect()
    pg_cur = pg_conn.cursor()

    print("Connecting to SQL Server…")
    ms_conn = mssql_connect()

    # Read all data from source first
    print("\nReading source tables…")
    source_data = {}
    for table in TABLE_ORDER:
        try:
            cols, rows = fetch_table(pg_cur, table)
            source_data[table] = (cols, rows)
            print(f"  {table}: {len(rows)} rows")
        except Exception as e:
            print(f"  {table}: SKIPPED ({e})")
            pg_conn.rollback()
            source_data[table] = ([], [])

    pg_cur.close()
    pg_conn.close()

    # Disable FKs, truncate, insert, re-enable FKs
    print("\nDisabling FK constraints…")
    disable_all_fks(ms_conn)

    print("\nTruncating destination tables…")
    truncate_tables(ms_conn, [t for t in TABLE_ORDER if t in source_data and source_data[t][1]])

    print("\nInserting data…")
    for table in TABLE_ORDER:
        cols, rows = source_data.get(table, ([], []))
        if not cols:
            continue
        # Skip schema_migrations — that's managed by the app
        if table == "schema_migrations":
            continue
        # Check table exists in destination
        check_cur = ms_conn.cursor()
        exists = mssql_table_exists(check_cur, table)
        check_cur.close()
        if not exists:
            print(f"  {table}: NOT IN DESTINATION — skipped")
            continue
        insert_table(ms_conn, table, cols, rows)

    print("\nRe-enabling FK constraints…")
    enable_all_fks(ms_conn)

    print("\nReseeding IDENTITY columns…")
    reseed_identities(ms_conn, TABLE_ORDER)

    ms_conn.close()
    print("\nMigration complete.")


if __name__ == "__main__":
    main()
