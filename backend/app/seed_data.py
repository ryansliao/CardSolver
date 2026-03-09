"""
Seed the database with all 26 credit cards parsed from Financial.xlsx.

Run directly (from the backend/ directory):
    python -m app.seed_data

Or from the project root:
    cd backend && python -m app.seed_data
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Allow running as a script: insert backend/ so `app` package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal, create_tables
from app.models import Card, CardCategoryMultiplier, CardCredit, SpendCategory

XLSX_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "Financial.xlsx"

CATEGORIES = [
    "All Other",
    "Dining",
    "Groceries",
    "Personal Care",
    "Drugstores",
    "Fitness",
    "Gas",
    "Rideshare",
    "Transit",
    "Entertainment",
    "Streaming",
    "Software, Hardware",
    "Internet",
    "Phone",
    "Airlines",
    "Hotels",
    "Rotating",
]

CREDIT_TYPES = [
    "Misc. Travel",
    "Hotel Collection",
    "Hotel Status",
    "Rental Car Status",
    "Lounge Access",
    "Airport Security",
    "Flight Credits",
    "Status Headstart",
    "Dining",
    "Streaming",
    "Rideshare & Delivery",
    "Live Entertainment",
    "Miscellaneous",
]

# Cards whose earn rates are boosted when a Chase premium card (CSR/CSP/CIP) is also held
CHASE_BOOSTED_CARDS = {"Chase Freedom Unlimited", "Chase Freedom Flex"}

# Delta cobrand cards earn SkyMiles that are worth less vs. transferred points.
# The spreadsheet divides their point totals by 0.85 to normalise to a cents-per-point basis.
DELTA_COBRAND_CARDS = {
    "Delta SkyMiles Gold",
    "Delta SkyMiles Gold Business",
    "Delta SkyMiles Platinum",
    "Delta SkyMiles Reserve",
}

ISSUER_MAP = {
    "American Express": "American Express",
    "Chase": "Chase",
    "Capital One": "Capital One",
    "Citi": "Citi",
    "Bilt": "Bilt",
    "Delta": "Delta / American Express",
    "Hilton": "Hilton / American Express",
}

CURRENCY_MAP = {
    "American Express Platinum": "Amex MR",
    "American Express Gold": "Amex MR",
    "American Express Business Gold": "Amex MR",
    "American Express Blue Business Plus": "Amex MR",
    "Chase Sapphire Reserve": "Chase UR",
    "Chase Sapphire Preferred": "Chase UR",
    "Chase Ink Preferred": "Chase UR",
    "Chase Ink Cash": "Chase UR",
    "Chase Freedom Unlimited": "Chase UR",
    "Chase Freedom Flex": "Chase UR",
    "Capital One Venture X": "Capital One Miles",
    "Capital One Savor": "Capital One Miles",
    "Citi Strata Elite": "Citi TY",
    "Citi Strata Premier": "Citi TY",
    "Citi Strata": "Citi TY",
    "Citi Custom Cash": "Citi TY",
    "Citi Double Cash": "Citi TY",
    "Bilt Palladium": "Bilt Rewards",
    "Bilt Obsidian": "Bilt Rewards",
    "Bilt Blue": "Bilt Rewards",
    "Delta SkyMiles Gold": "Delta SkyMiles",
    "Delta SkyMiles Gold Business": "Delta SkyMiles",
    "Delta SkyMiles Platinum": "Delta SkyMiles",
    "Delta SkyMiles Reserve": "Delta SkyMiles",
    "Hilton Honors Surpass": "Hilton Honors",
    "Hilton Honors Aspire": "Hilton Honors",
}


def _issuer(name: str) -> str:
    for prefix, issuer in ISSUER_MAP.items():
        if name.startswith(prefix):
            return issuer
    return "Unknown"


def parse_xlsx() -> dict:
    """
    Parse Financial.xlsx and return a dict of card_name -> card_data.
    """
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=False)
    ws = wb["Credit Card Tool"]
    rows = list(ws.iter_rows(min_row=1, values_only=True))

    # Card data columns are at even 0-based indices starting at 5 (F, H, J, …)
    # The paired "flag/multiplier" column is always col+1
    card_cols = list(range(5, 57, 2))
    card_names = [rows[0][c] for c in card_cols]

    all_cards: dict = {}
    for col, name in zip(card_cols, card_names):
        if not name:
            continue
        mult_col = col + 1

        annual_fee = rows[6][col] or 0
        sub_points = rows[7][col] or 0
        sub_min_spend = rows[9][col]
        sub_months = rows[10][col]
        sub_spend_points = rows[13][col] or 0
        annual_bonus_points = rows[8][col] or 0
        cpp_raw = rows[17][col]
        cents_per_point = float(cpp_raw) if cpp_raw is not None else 1.0

        multipliers: dict[str, float] = {}
        for cat, row_idx in zip(CATEGORIES, range(18, 35)):
            val = rows[row_idx][mult_col]
            multipliers[cat] = float(val) if val is not None else 1.0

        credits: dict[str, dict] = {}
        for ctype, row_idx in zip(CREDIT_TYPES, range(35, 48)):
            label = rows[row_idx][col]
            value = rows[row_idx][mult_col]
            if label is not None or (value is not None and value != 0):
                credits[ctype] = {
                    "label": str(label) if label else "",
                    "value": float(value) if value is not None else 0.0,
                }

        all_cards[name] = {
            "name": name,
            "issuer": _issuer(name),
            "currency": CURRENCY_MAP.get(name, "Unknown"),
            "annual_fee": float(annual_fee),
            "cents_per_point": cents_per_point,
            "sub_points": int(sub_points),
            "sub_min_spend": int(sub_min_spend) if sub_min_spend is not None else None,
            "sub_months": int(sub_months) if sub_months is not None else None,
            "sub_spend_points": int(sub_spend_points),
            "annual_bonus_points": int(annual_bonus_points),
            "boosted_by_chase_premium": name in CHASE_BOOSTED_CARDS,
            # Delta cobrand cards: their points are worth ~0.85x vs transferable MR/UR
            "points_adjustment_factor": round(1 / 0.85, 6) if name in DELTA_COBRAND_CARDS else 1.0,
            "multipliers": multipliers,
            "credits": credits,
        }

    return all_cards


def parse_spend_categories() -> list[dict]:
    """Return the 17 spend categories with their default annual spend amounts."""
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=False)
    ws = wb["Credit Card Tool"]
    rows = list(ws.iter_rows(min_row=1, values_only=True))

    result = []
    for cat, row_idx in zip(CATEGORIES, range(18, 35)):
        spend = rows[row_idx][4]  # col E (index 4)
        result.append({"category": cat, "annual_spend": float(spend) if spend else 0.0})
    return result


async def seed(session: AsyncSession) -> None:
    """Upsert all cards, multipliers, credits, and default spend categories."""

    all_cards = parse_xlsx()
    spend_cats = parse_spend_categories()

    # --- Spend categories ---
    for sc in spend_cats:
        existing = await session.execute(
            select(SpendCategory).where(SpendCategory.category == sc["category"])
        )
        obj = existing.scalar_one_or_none()
        if obj is None:
            session.add(SpendCategory(**sc))
        else:
            obj.annual_spend = sc["annual_spend"]

    # --- Cards ---
    for card_data in all_cards.values():
        multipliers = card_data.pop("multipliers")
        credits = card_data.pop("credits")

        existing = await session.execute(
            select(Card).where(Card.name == card_data["name"])
        )
        card = existing.scalar_one_or_none()

        if card is None:
            card = Card(**card_data)
            session.add(card)
            await session.flush()  # get card.id
        else:
            for k, v in card_data.items():
                setattr(card, k, v)
            await session.flush()

        # Delete and re-insert multipliers and credits for simplicity
        await session.execute(
            CardCategoryMultiplier.__table__.delete().where(
                CardCategoryMultiplier.card_id == card.id
            )
        )
        await session.execute(
            CardCredit.__table__.delete().where(CardCredit.card_id == card.id)
        )

        for cat, mult in multipliers.items():
            session.add(
                CardCategoryMultiplier(card_id=card.id, category=cat, multiplier=mult)
            )

        for ctype, cinfo in credits.items():
            session.add(
                CardCredit(
                    card_id=card.id,
                    credit_name=f"{ctype}: {cinfo['label']}".strip(": "),
                    credit_value=cinfo["value"],
                )
            )

    await session.commit()
    print(f"Seeded {len(all_cards)} cards and {len(spend_cats)} spend categories.")


async def main() -> None:
    await create_tables()
    async with AsyncSessionLocal() as session:
        await seed(session)


if __name__ == "__main__":
    asyncio.run(main())
