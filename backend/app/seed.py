"""Startup seed logic for rotating cards, portal premiums, credits, and travel portals."""

from __future__ import annotations

import logging

from sqlalchemy import select

from .database import AsyncSessionLocal
from .models import (
    Card,
    CardCategoryMultiplier,
    CardMultiplierGroup,
    CardRotatingHistory,
    CoBrand,
    Credit,
    Currency,
    Issuer,
    SpendCategory,
    TravelPortal,
    TravelPortalSeedLog,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Rotating-bonus card + history seed data
# ---------------------------------------------------------------------------

_DISCOVER_IT_HISTORY: list[tuple[int, int, list[str]]] = [
    (2023, 1, ["Groceries", "Drugstores", "Streaming"]),
    (2023, 2, ["Gas", "Wholesale Clubs"]),
    (2023, 3, ["Dining"]),
    (2023, 4, ["Amazon", "Target"]),
    (2024, 1, ["Dining", "Drugstores"]),
    (2024, 2, ["Gas", "Transit", "Utilities"]),
    (2024, 3, ["Dining"]),
    (2024, 4, ["Amazon", "Target"]),
    (2025, 1, ["Dining", "Home Improvement", "Streaming"]),
    (2025, 2, ["Gas", "Transit", "EV Charging"]),
    (2025, 3, ["Dining"]),
    (2025, 4, ["Amazon", "Target"]),
]

_CHASE_FREEDOM_FLEX_HISTORY: list[tuple[int, int, list[str]]] = [
    (2023, 1, ["Groceries", "Fitness"]),
    (2023, 2, ["Amazon", "Lowe's"]),
    (2023, 3, ["Gas", "EV Charging", "Movies"]),
    (2023, 4, ["PayPal", "Wholesale Clubs"]),
    (2024, 1, ["Groceries", "Fitness"]),
    (2024, 2, ["Hotels", "Dining"]),
    (2024, 3, ["Gas", "EV Charging", "Movies"]),
    (2024, 4, ["PayPal", "McDonald's"]),
    (2025, 1, ["Groceries", "Fitness"]),
    (2025, 2, ["Hotels", "Amazon"]),
    (2025, 3, ["Gas", "EV Charging", "Dining"]),
    (2025, 4, ["PayPal", "Wholesale Clubs"]),
]

_CHASE_FREEDOM_HISTORY = _CHASE_FREEDOM_FLEX_HISTORY

_ROTATING_CARD_SPECS: list[dict] = [
    {
        "name": "Discover it Cash Back",
        "issuer": "Discover",
        "currency_aliases": ["Discover Cashback Bonus", "Discover Cashback", "Cash"],
        "currency_default_kind": "cash",
        "currency_default_cpp": 1.0,
        "annual_fee": 0.0,
        "first_year_fee": None,
        "business": False,
        "history": _DISCOVER_IT_HISTORY,
        "rotating_group_multiplier": 5.0,
        "rotating_is_additive": False,
        "always_on_premiums": [],
    },
    {
        "name": "Chase Freedom Flex",
        "issuer": "Chase",
        "currency_aliases": ["Chase Ultimate Rewards", "Chase UR", "Chase Cash", "Cash"],
        "currency_default_kind": "points",
        "currency_default_cpp": 1.0,
        "annual_fee": 0.0,
        "first_year_fee": None,
        "business": False,
        "history": _CHASE_FREEDOM_FLEX_HISTORY,
        "rotating_group_multiplier": 4.0,
        "rotating_is_additive": True,
        "always_on_premiums": [
            ("Dining", 2.0, False),
            ("Drugstores", 2.0, False),
            ("Travel", 4.0, True),
        ],
    },
    {
        "name": "Chase Freedom",
        "issuer": "Chase",
        "currency_aliases": ["Chase Ultimate Rewards", "Chase UR", "Chase Cash", "Cash"],
        "currency_default_kind": "points",
        "currency_default_cpp": 1.0,
        "annual_fee": 0.0,
        "first_year_fee": None,
        "business": False,
        "history": _CHASE_FREEDOM_HISTORY,
        "rotating_group_multiplier": 5.0,
        "rotating_is_additive": False,
        "always_on_premiums": [],
    },
]

_PORTAL_PREMIUM_SPECS: list[dict] = [
    {
        "card_name": "Capital One Venture X",
        "rows": [
            ("Hotels", 10.0, False),
            ("Car Rentals", 10.0, False),
            ("Flights", 5.0, False),
            ("Vacation Rentals", 5.0, False),
        ],
    },
]

_STANDARDIZED_CREDIT_SPECS: list[tuple[str, float]] = [
    ("Priority Pass", 469.0),
    ("CLEAR Plus", 199.0),
    ("Walmart+ Membership", 155.0),
    ("Equinox Credit", 300.0),
    ("Global Entry / TSA PreCheck", 120.0),
    ("Free Checked Bags", 0.0),
    ("Uber Cash", 0.0),
    ("DoorDash Credit", 0.0),
    ("Marriott Free Night Award", 0.0),
    ("Hilton Free Night Award", 0.0),
    ("Hotel Credit", 0.0),
    ("Airline Incidental Credit", 0.0),
    ("Streaming Credit", 0.0),
    ("Saks Fifth Avenue Credit", 0.0),
    ("Resy Dining Credit", 0.0),
]


# ---------------------------------------------------------------------------
# Seed helper functions
# ---------------------------------------------------------------------------


async def _ensure_issuer(session, name: str) -> Issuer:
    from sqlalchemy import func

    row = await session.execute(
        select(Issuer).where(func.lower(Issuer.name) == name.lower())
    )
    obj = row.scalar_one_or_none()
    if obj is not None:
        return obj
    obj = Issuer(name=name)
    session.add(obj)
    await session.flush()
    logger.info("rotating seed: created issuer %r", name)
    return obj


async def _ensure_currency(
    session,
    aliases: list[str],
    default_kind: str,
    default_cpp: float,
) -> Currency:
    from sqlalchemy import func

    for alias in aliases:
        row = await session.execute(
            select(Currency).where(func.lower(Currency.name) == alias.lower())
        )
        obj = row.scalar_one_or_none()
        if obj is not None:
            return obj
    canonical = aliases[0]
    obj = Currency(
        name=canonical,
        reward_kind=default_kind,
        cents_per_point=default_cpp,
        cash_transfer_rate=1.0 if default_kind == "cash" else None,
    )
    session.add(obj)
    await session.flush()
    logger.info("rotating seed: created currency %r (%s)", canonical, default_kind)
    return obj


async def _ensure_spend_category(session, name: str) -> SpendCategory:
    from sqlalchemy import func

    row = await session.execute(
        select(SpendCategory).where(func.lower(SpendCategory.category) == name.lower())
    )
    obj = row.scalar_one_or_none()
    if obj is not None:
        return obj
    obj = SpendCategory(category=name, is_system=False)
    session.add(obj)
    await session.flush()
    logger.info("rotating seed: created spend category %r", name)
    return obj


# ---------------------------------------------------------------------------
# Per-card seed orchestrators
# ---------------------------------------------------------------------------


async def _seed_one_rotating_card(session, spec: dict) -> None:
    from sqlalchemy import func

    issuer = await _ensure_issuer(session, spec["issuer"])
    currency = await _ensure_currency(
        session,
        spec["currency_aliases"],
        spec["currency_default_kind"],
        spec["currency_default_cpp"],
    )

    universe_names: list[str] = []
    seen: set[str] = set()
    for _y, _q, cats in spec["history"]:
        for cat_name in cats:
            key = cat_name.strip().lower()
            if key not in seen:
                seen.add(key)
                universe_names.append(cat_name)

    universe_categories: list[SpendCategory] = []
    for cat_name in universe_names:
        sc = await _ensure_spend_category(session, cat_name)
        universe_categories.append(sc)

    card_row = await session.execute(
        select(Card).where(func.lower(Card.name) == spec["name"].lower())
    )
    card = card_row.scalar_one_or_none()
    if card is None:
        card = Card(
            name=spec["name"],
            issuer_id=issuer.id,
            currency_id=currency.id,
            annual_fee=spec["annual_fee"],
            first_year_fee=spec["first_year_fee"],
            business=spec["business"],
        )
        session.add(card)
        await session.flush()
        logger.info("rotating seed: created card %r", spec["name"])

    rotating_group_mult = float(spec.get("rotating_group_multiplier", 5.0))
    rotating_is_additive = bool(spec.get("rotating_is_additive", False))
    existing_groups = await session.execute(
        select(CardMultiplierGroup).where(
            CardMultiplierGroup.card_id == card.id,
            CardMultiplierGroup.is_rotating == True,  # noqa: E712
        )
    )
    group = existing_groups.scalars().first()
    if group is None:
        group = CardMultiplierGroup(
            card_id=card.id,
            multiplier=rotating_group_mult,
            cap_per_billing_cycle=1500.0,
            cap_period_months=3,
            is_rotating=True,
            is_additive=rotating_is_additive,
            top_n_categories=None,
        )
        session.add(group)
        await session.flush()
        logger.info(
            "rotating seed: created rotating group on %r (%sx, additive=%s)",
            card.name, rotating_group_mult, rotating_is_additive,
        )
    else:
        if abs(group.multiplier - rotating_group_mult) > 1e-6:
            group.multiplier = rotating_group_mult
        if bool(group.is_additive) != rotating_is_additive:
            group.is_additive = rotating_is_additive

    existing_grouped = await session.execute(
        select(CardCategoryMultiplier).where(
            CardCategoryMultiplier.card_id == card.id,
            CardCategoryMultiplier.multiplier_group_id == group.id,
        )
    )
    grouped_by_cat_id = {m.category_id: m for m in existing_grouped.scalars()}
    for sc in universe_categories:
        existing = grouped_by_cat_id.get(sc.id)
        if existing is None:
            session.add(
                CardCategoryMultiplier(
                    card_id=card.id,
                    category_id=sc.id,
                    multiplier=rotating_group_mult,
                    multiplier_group_id=group.id,
                    is_additive=rotating_is_additive,
                )
            )
            logger.info(
                "rotating seed: linked %r -> %r in rotating group",
                card.name, sc.category,
            )
        else:
            if abs(existing.multiplier - rotating_group_mult) > 1e-6:
                existing.multiplier = rotating_group_mult
            if bool(existing.is_additive) != rotating_is_additive:
                existing.is_additive = rotating_is_additive
    await session.flush()

    always_on: list[tuple[str, float, bool]] = list(spec.get("always_on_premiums", []))
    if always_on:
        existing_standalone = await session.execute(
            select(CardCategoryMultiplier).where(
                CardCategoryMultiplier.card_id == card.id,
                CardCategoryMultiplier.multiplier_group_id.is_(None),
            )
        )
        standalone_by_key = {
            (m.category_id, bool(m.is_portal)): m
            for m in existing_standalone.scalars()
        }
        for cat_name, premium, is_portal in always_on:
            sc = await _ensure_spend_category(session, cat_name)
            existing = standalone_by_key.get((sc.id, bool(is_portal)))
            if existing is None:
                session.add(
                    CardCategoryMultiplier(
                        card_id=card.id,
                        category_id=sc.id,
                        multiplier=float(premium),
                        is_additive=True,
                        is_portal=bool(is_portal),
                        multiplier_group_id=None,
                    )
                )
                logger.info(
                    "rotating seed: added always-on +%sx %r on %r%s",
                    premium, cat_name, card.name, " (portal)" if is_portal else "",
                )
            else:
                if existing.is_additive:
                    if abs(existing.multiplier - float(premium)) > 1e-6:
                        existing.multiplier = float(premium)
        await session.flush()

    sc_by_lower_name = {sc.category.lower(): sc.id for sc in universe_categories}
    existing_history = await session.execute(
        select(
            CardRotatingHistory.year,
            CardRotatingHistory.quarter,
            CardRotatingHistory.spend_category_id,
        ).where(CardRotatingHistory.card_id == card.id)
    )
    existing_keys = {(r[0], r[1], r[2]) for r in existing_history.all()}
    for year, quarter, cat_names in spec["history"]:
        for cat_name in cat_names:
            sc_id = sc_by_lower_name.get(cat_name.lower())
            if sc_id is None:
                continue
            key = (year, quarter, sc_id)
            if key in existing_keys:
                continue
            session.add(
                CardRotatingHistory(
                    card_id=card.id,
                    year=year,
                    quarter=quarter,
                    spend_category_id=sc_id,
                )
            )


async def _seed_one_portal_premium(session, spec: dict) -> None:
    from sqlalchemy import func

    card_row = await session.execute(
        select(Card).where(func.lower(Card.name) == spec["card_name"].lower())
    )
    card = card_row.scalar_one_or_none()
    if card is None:
        return

    existing_standalone = await session.execute(
        select(CardCategoryMultiplier).where(
            CardCategoryMultiplier.card_id == card.id,
            CardCategoryMultiplier.multiplier_group_id.is_(None),
            CardCategoryMultiplier.is_portal == True,  # noqa: E712
        )
    )
    portal_by_cat_id = {m.category_id: m for m in existing_standalone.scalars()}

    for cat_name, mult, is_add in spec["rows"]:
        sc = await _ensure_spend_category(session, cat_name)
        existing = portal_by_cat_id.get(sc.id)
        if existing is None:
            session.add(
                CardCategoryMultiplier(
                    card_id=card.id,
                    category_id=sc.id,
                    multiplier=float(mult),
                    is_additive=bool(is_add),
                    is_portal=True,
                    multiplier_group_id=None,
                )
            )
            logger.info(
                "portal premium seed: added %sx portal %r on %r",
                mult, cat_name, card.name,
            )
        else:
            if abs(existing.multiplier - float(mult)) > 1e-6:
                existing.multiplier = float(mult)
            if bool(existing.is_additive) != bool(is_add):
                existing.is_additive = bool(is_add)
    await session.flush()


# ---------------------------------------------------------------------------
# Public seed functions (called from lifespan)
# ---------------------------------------------------------------------------


async def seed_rotating_cards_and_history() -> None:
    """Idempotently seed rotating-card universe."""
    async with AsyncSessionLocal() as session:
        for spec in _ROTATING_CARD_SPECS:
            try:
                await _seed_one_rotating_card(session, spec)
                await session.commit()
            except Exception:
                logger.exception(
                    "rotating seed: failed to seed %r -- rolling back this card",
                    spec["name"],
                )
                await session.rollback()
                continue


async def seed_portal_premiums() -> None:
    """Idempotently add portal-only multiplier rows to existing cards."""
    async with AsyncSessionLocal() as session:
        for spec in _PORTAL_PREMIUM_SPECS:
            try:
                await _seed_one_portal_premium(session, spec)
                await session.commit()
            except Exception:
                logger.exception(
                    "portal premium seed: failed to seed %r -- rolling back",
                    spec["card_name"],
                )
                await session.rollback()
                continue


async def seed_standardized_credits() -> None:
    """Idempotently seed the global credit library with common defaults."""
    async with AsyncSessionLocal() as session:
        existing_rows = await session.execute(select(Credit.credit_name))
        existing_names = {n for (n,) in existing_rows.all()}
        added = False
        for name, default_value in _STANDARDIZED_CREDIT_SPECS:
            if name in existing_names:
                continue
            session.add(Credit(credit_name=name, credit_value=default_value))
            added = True
        if added:
            await session.commit()


async def seed_travel_portals() -> None:
    """Seed one TravelPortal per Issuer and per CoBrand the first time we see them."""
    async with AsyncSessionLocal() as session:
        log_rows = (
            await session.execute(select(TravelPortalSeedLog))
        ).scalars().all()
        seeded_issuer_ids = {r.source_id for r in log_rows if r.kind == "issuer"}
        seeded_cobrand_ids = {r.source_id for r in log_rows if r.kind == "cobrand"}

        existing_names = {
            name
            for (name,) in (
                await session.execute(select(TravelPortal.name))
            ).all()
        }

        issuers = (await session.execute(select(Issuer))).scalars().all()
        cobrands = (await session.execute(select(CoBrand))).scalars().all()
        cards = (await session.execute(select(Card))).scalars().all()

        cards_by_issuer: dict[int, list[Card]] = {}
        cards_by_cobrand: dict[int, list[Card]] = {}
        for c in cards:
            cards_by_issuer.setdefault(c.issuer_id, []).append(c)
            if c.co_brand_id is not None:
                cards_by_cobrand.setdefault(c.co_brand_id, []).append(c)

        added = False
        for iss in issuers:
            if iss.id in seeded_issuer_ids:
                continue
            portal_name = f"{iss.name} Travel"
            if portal_name not in existing_names:
                session.add(
                    TravelPortal(
                        name=portal_name,
                        cards=list(cards_by_issuer.get(iss.id, [])),
                    )
                )
            session.add(TravelPortalSeedLog(kind="issuer", source_id=iss.id))
            added = True

        for cb in cobrands:
            if cb.id in seeded_cobrand_ids:
                continue
            portal_name = f"{cb.name} Travel"
            if portal_name not in existing_names:
                session.add(
                    TravelPortal(
                        name=portal_name,
                        cards=list(cards_by_cobrand.get(cb.id, [])),
                    )
                )
            session.add(TravelPortalSeedLog(kind="cobrand", source_id=cb.id))
            added = True

        if added:
            await session.commit()
