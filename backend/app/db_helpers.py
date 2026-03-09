"""
Helper to load cards and spend categories from the DB into calculator dataclasses.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .calculator import CardData, CurrencyData
from .models import Card, Currency, EcosystemBoost, SpendCategory


def _currency_data(orm_currency: Currency) -> CurrencyData:
    """Convert a Currency ORM object to a CurrencyData dataclass."""
    return CurrencyData(
        id=orm_currency.id,
        name=orm_currency.name,
        issuer_name=orm_currency.issuer.name,
        cents_per_point=orm_currency.cents_per_point,
        is_cashback=orm_currency.is_cashback,
        is_transferable=orm_currency.is_transferable,
        comparison_factor=orm_currency.comparison_factor,
    )


async def load_card_data(session: AsyncSession) -> list[CardData]:
    """Load all cards with their full relationship tree as CardData objects."""
    result = await session.execute(
        select(Card).options(
            selectinload(Card.issuer),
            selectinload(Card.currency_obj).selectinload(Currency.issuer),
            selectinload(Card.ecosystem_boost).selectinload(
                EcosystemBoost.boosted_currency
            ).selectinload(Currency.issuer),
            selectinload(Card.anchor_for_boosts),
            selectinload(Card.multipliers),
            selectinload(Card.credits),
        )
    )
    cards = result.scalars().all()

    out: list[CardData] = []
    for card in cards:
        currency = _currency_data(card.currency_obj)

        boost_currency: CurrencyData | None = None
        if card.ecosystem_boost is not None:
            boost_currency = _currency_data(card.ecosystem_boost.boosted_currency)

        anchor_boost_ids = [anchor.boost_id for anchor in card.anchor_for_boosts]

        multipliers = {m.category: m.multiplier for m in card.multipliers}
        credits = {c.credit_name: c.credit_value for c in card.credits}

        out.append(
            CardData(
                id=card.id,
                name=card.name,
                issuer_name=card.issuer.name,
                currency=currency,
                annual_fee=card.annual_fee,
                sub_points=card.sub_points,
                sub_min_spend=card.sub_min_spend,
                sub_months=card.sub_months,
                sub_spend_points=card.sub_spend_points,
                annual_bonus_points=card.annual_bonus_points,
                ecosystem_boost_id=card.ecosystem_boost_id,
                ecosystem_boost_currency=boost_currency,
                is_anchor_for_boost_ids=anchor_boost_ids,
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
