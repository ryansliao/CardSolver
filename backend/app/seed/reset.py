"""Compact IDs in tables whose rows were historically delete-and-recreated by
the seed loader.

Before `_sync_card_groups_and_multipliers` / `_sync_card_rotating` were made
idempotent, every `python -m app.seed load` burned a fresh set of autoincrement
IDs for `card_category_multipliers` and `rotating_categories`. Over many
loads their IDs drift far above the row count. This module renumbers them
sequentially (1..N) in place and reseeds the IDENTITY counter.

Nothing outside those tables references those IDs, so the renumber is safe.
Other FK columns (`card_id`, `category_id`, `multiplier_group_id`,
`spend_category_id`) are preserved verbatim.
"""

from __future__ import annotations

from sqlalchemy import text

from ..database import engine


# (table, ordered column list including `id`)
_RENUMBER_TARGETS: list[tuple[str, list[str]]] = [
    (
        "card_category_multipliers",
        [
            "id",
            "card_id",
            "category_id",
            "is_portal",
            "is_additive",
            "multiplier",
            "cap_per_billing_cycle",
            "cap_period_months",
            "multiplier_group_id",
            "created_at",
            "updated_at",
        ],
    ),
    (
        "rotating_categories",
        ["id", "card_id", "year", "quarter", "spend_category_id"],
    ),
]


async def _renumber_table(conn, table: str, columns: list[str]) -> None:
    col_list = ", ".join(columns)
    non_id_cols = [c for c in columns if c != "id"]
    non_id_list = ", ".join(non_id_cols)
    tmp = f"#__renum_{table}"

    # Snapshot with new sequential IDs (ordered by current id for determinism).
    await conn.execute(
        text(
            f"""
            SELECT
                ROW_NUMBER() OVER (ORDER BY id) AS new_id,
                {non_id_list}
            INTO {tmp}
            FROM dbo.{table};
            """
        )
    )

    result = await conn.execute(text(f"SELECT COUNT(*) FROM {tmp}"))
    row_count = result.scalar() or 0

    await conn.execute(text(f"DELETE FROM dbo.{table};"))
    await conn.execute(text(f"DBCC CHECKIDENT ('dbo.{table}', RESEED, 0);"))

    if row_count > 0:
        await conn.execute(text(f"SET IDENTITY_INSERT dbo.{table} ON;"))
        try:
            await conn.execute(
                text(
                    f"""
                    INSERT INTO dbo.{table} ({col_list})
                    SELECT new_id, {non_id_list}
                    FROM {tmp}
                    ORDER BY new_id;
                    """
                )
            )
        finally:
            await conn.execute(text(f"SET IDENTITY_INSERT dbo.{table} OFF;"))

    await conn.execute(text(f"DROP TABLE {tmp};"))

    print(f"  renumbered {table}: {row_count} row(s) → ids 1..{row_count}")


async def reset_ids() -> None:
    """Compact IDs for every table in `_RENUMBER_TARGETS`."""
    async with engine.begin() as conn:
        for table, columns in _RENUMBER_TARGETS:
            await _renumber_table(conn, table, columns)
    print("Renumber complete.")
