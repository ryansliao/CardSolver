"""CLI entry point: `python -m app.seed export|load`.

Run from `backend/` with the project's .venv active so the database env vars
(APP_ENV / LOCAL_DATABASE_URL / DATABASE_URL) resolve the same way the app
would.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

from ..database import engine
from .export import export_all
from .load import load_all
from .reset import reset_ids


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m app.seed")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("export", help="Dump DB reference data to backend/seed/*.yaml")
    sub.add_parser("load", help="Load backend/seed/*.yaml into the DB (idempotent upsert)")
    sub.add_parser(
        "reset-ids",
        help=(
            "Compact autoincrement IDs for tables historically burned by "
            "delete-and-recreate seed loads (card_category_multipliers, "
            "rotating_categories)."
        ),
    )
    return parser


async def _run(cmd: str) -> None:
    try:
        if cmd == "export":
            await export_all()
        elif cmd == "load":
            await load_all()
        elif cmd == "reset-ids":
            await reset_ids()
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    asyncio.run(_run(args.cmd))
    return 0


if __name__ == "__main__":
    sys.exit(main())
