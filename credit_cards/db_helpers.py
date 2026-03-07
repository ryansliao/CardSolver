"""
Helper to load cards and spend categories from the DB into calculator dataclasses.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .calculator import CardData
from .models import Card, SpendCategory


async def load_card_data(session: AsyncSession) -> list[CardData]:
    """Load all cards with their multipliers and credits as CardData objects."""
    result = await session.execute(
        select(Card).options(
            selectinload(Card.multipliers),
            selectinload(Card.credits),
        )
    )
    cards = result.scalars().all()

    out: list[CardData] = []
    for card in cards:
        multipliers = {m.category: m.multiplier for m in card.multipliers}
        credits = {c.credit_name: c.credit_value for c in card.credits}
        out.append(
            CardData(
                id=card.id,
                name=card.name,
                issuer=card.issuer,
                currency=card.currency,
                annual_fee=card.annual_fee,
                cents_per_point=card.cents_per_point,
                sub_points=card.sub_points,
                sub_min_spend=card.sub_min_spend,
                sub_months=card.sub_months,
                sub_spend_points=card.sub_spend_points,
                annual_bonus_points=card.annual_bonus_points,
                boosted_by_chase_premium=card.boosted_by_chase_premium,
                points_adjustment_factor=card.points_adjustment_factor,
                multipliers=multipliers,
                credits=credits,
            )
        )
    return out


async def load_spend(
    session: AsyncSession,
    overrides: dict[str, float] | None = None,
) -> dict[str, float]:
    """Load spend categories from DB, applying any overrides."""
    result = await session.execute(select(SpendCategory))
    cats = result.scalars().all()
    spend = {sc.category: sc.annual_spend for sc in cats}
    if overrides:
        spend.update(overrides)
    return spend
