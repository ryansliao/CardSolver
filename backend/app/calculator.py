"""
Credit card value calculation engine.

Terminology
-----------
- CardData    : all static data for a card, including nested CurrencyData
- CurrencyData: issuer currency with its CPP, transferability, and comparison factor
- spend       : dict of {category: annual_spend_dollars}
- cpp         : cents per point (from the effective currency, accounting for boost)
- SUB         : sign-up bonus
- years       : years_counted
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional

from .constants import ALL_OTHER_CATEGORY


# ---------------------------------------------------------------------------
# Data containers (plain dataclasses — no DB dependency)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class CreditLine:
    """Statement credit row for calculations (ids match library `card_credits.id`)."""

    library_credit_id: int
    name: str
    value: float
    one_time: bool = False


@dataclass
class CurrencyData:
    """Snapshot of a reward currency for use in the calculator engine."""

    id: int
    name: str
    reward_kind: str  # "points" (incl. miles) or "cash"
    cents_per_point: float
    cash_transfer_rate: float
    partner_transfer_rate: Optional[float]
    # When set, this currency upgrades to the target when any wallet card earns the target directly
    converts_to_currency: Optional["CurrencyData"] = None
    # Rate when converting: 1 unit of this = converts_at_rate units of target (default 1.0)
    converts_at_rate: float = 1.0


@dataclass
class CardData:
    """All static data for one card, ready for the calculator engine."""

    id: int
    name: str
    issuer_name: str              # denormalised for display

    # Default currency this card earns
    currency: CurrencyData

    annual_fee: float
    sub: int
    sub_min_spend: Optional[int]
    sub_months: Optional[int]
    sub_spend_earn: int
    annual_bonus: int
    first_year_fee: Optional[float] = None

    # category -> multiplier (standalone + group categories; top-N applied at calc time via multiplier_groups)
    multipliers: dict[str, float] = field(default_factory=dict)
    # Group metadata for top-N: (multiplier, categories list, top_n_categories or None)
    multiplier_groups: list[tuple[float, list[str], Optional[int]]] = field(default_factory=list)
    credit_lines: list[CreditLine] = field(default_factory=list)
    # Set of category names where the multiplier only applies via the card's booking portal
    portal_categories: set[str] = field(default_factory=set)


@dataclass
class CardResult:
    """Per-card outputs from the calculator, zeroed when card is not selected."""

    card_id: int
    card_name: str
    selected: bool
    # Net annual cost after credits, amortised SUB/fees, and wallet-allocated category earn (at CPP).
    effective_annual_fee: float = 0.0
    total_points: float = 0.0
    annual_point_earn: float = 0.0
    credit_valuation: float = 0.0
    annual_fee: float = 0.0
    first_year_fee: Optional[float] = None
    sub: int = 0
    annual_bonus: int = 0
    sub_extra_spend: float = 0.0
    sub_spend_earn: int = 0
    # Opportunity cost: net dollar value foregone on the rest of the wallet
    # to cover the SUB extra spend (gross opp cost minus sub_spend_earn value)
    sub_opp_cost_dollars: float = 0.0
    # Gross dollar opportunity cost (best alternative earn on the extra spend,
    # before crediting back the sub_spend_earn earned on the target card)
    sub_opp_cost_gross_dollars: float = 0.0
    avg_spend_multiplier: float = 0.0
    cents_per_point: float = 0.0
    # Effective currency name (may differ from default when upgrade is active)
    effective_currency_name: str = ""
    effective_currency_id: int = 0
    effective_reward_kind: str = "points"


@dataclass
class WalletResult:
    """Aggregated wallet outputs."""

    years_counted: int
    total_effective_annual_fee: float
    total_points_earned: float
    total_annual_pts: float
    # Sum of projection-period reward units for cash-kind cards only (× cpp/100 = dollars).
    total_cash_reward_dollars: float = 0.0
    # Σ (total_points × cents_per_point / 100) over selected cards — comparable across currencies.
    total_reward_value_usd: float = 0.0
    # currency_name -> total points over the projection period (spend + SUB/bonuses, net of SUB opp cost).
    currency_pts: dict[str, float] = field(default_factory=dict)
    currency_pts_by_id: dict[int, float] = field(default_factory=dict)
    card_results: list[CardResult] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Category multiplier: All Other fallback + grouped top-N
# ---------------------------------------------------------------------------

def _all_other_multiplier(multipliers: dict[str, float]) -> float:
    """Get the All Other multiplier from a category->multiplier dict (case-insensitive)."""
    for cat, mult in multipliers.items():
        if cat.strip().lower() == ALL_OTHER_CATEGORY.lower():
            return mult
    return 1.0


def _spend_for_category(spend: dict[str, float], category: str) -> float:
    """Get spend amount for a category (case-insensitive match)."""
    c = (category or "").strip().lower()
    if not c:
        return 0.0
    for k, v in spend.items():
        if (k or "").strip().lower() == c:
            return v
    return 0.0


def _build_effective_multipliers(card: CardData, spend: dict[str, float]) -> dict[str, float]:
    """
    Build category -> multiplier map for this card given spend.
    Applies top-N logic for groups: only the top N spending categories in each group
    get the group rate; the rest get All Other.
    """
    effective = dict(card.multipliers)
    all_other = _all_other_multiplier(effective)

    for group_mult, group_cats, top_n in card.multiplier_groups:
        if top_n is None or top_n <= 0:
            continue
        # Rank group categories by spend (desc); only top N get group_mult
        ranked = sorted(
            group_cats,
            key=lambda c: _spend_for_category(spend, c) if c else 0.0,
            reverse=True,
        )
        top_set = set(ranked[:top_n])
        for cat in group_cats:
            key = cat.strip() if cat else ""
            if not key:
                continue
            if key not in top_set:
                # Overwrite multiplier for this category (match key in effective case-insensitively)
                for ek in list(effective):
                    if (ek or "").strip().lower() == key.lower():
                        effective[ek] = all_other
                        break
                else:
                    effective[key] = all_other

    return effective


def _multiplier_for_category(
    card: CardData, spend_category: str, spend: dict[str, float]
) -> float:
    """
    Return the multiplier for this spend category.
    Uses effective multipliers (with top-N applied) then All Other fallback.
    """
    effective = _build_effective_multipliers(card, spend)
    key = spend_category.strip()
    if key in effective:
        return effective[key]
    key_lower = key.lower()
    for cat, mult in effective.items():
        if cat.strip().lower() == key_lower:
            return mult
    return _all_other_multiplier(effective)


# ---------------------------------------------------------------------------
# Currency upgrade helpers
# ---------------------------------------------------------------------------


def _wallet_currency_ids(selected_cards: list[CardData]) -> set[int]:
    """IDs of all currencies directly earned by selected cards."""
    return {c.currency.id for c in selected_cards}


def _effective_currency(card: CardData, wallet_currency_ids: set[int]) -> CurrencyData:
    """
    Return the currency this card actually earns given the wallet state.
    When this card's currency has a converts_to_currency and the target
    currency is earned directly by any card in the wallet, use the target.
    """
    cur = card.currency
    if cur.converts_to_currency and cur.converts_to_currency.id in wallet_currency_ids:
        return cur.converts_to_currency
    return cur


def _effective_cpp(card: CardData, wallet_currency_ids: set[int]) -> float:
    return _effective_currency(card, wallet_currency_ids).cents_per_point


def _comparison_cpp(card: CardData, wallet_currency_ids: set[int]) -> float:
    """
    CPP used when comparing cards for category allocation.
    Cash should always compete at face value: 1 cent per point/unit.
    """
    eff = _effective_currency(card, wallet_currency_ids)
    return 1.0 if eff.reward_kind == "cash" else eff.cents_per_point


def _conversion_rate(card: CardData, wallet_currency_ids: set[int]) -> float:
    """Multiplier from card's currency to effective currency (1.0 or converts_at_rate when upgraded)."""
    eff = _effective_currency(card, wallet_currency_ids)
    return card.currency.converts_at_rate if eff.id != card.currency.id else 1.0


def _effective_annual_earn(
    card: CardData, spend: dict[str, float], wallet_currency_ids: set[int]
) -> float:
    """Points earned in the effective currency (raw earn * conversion rate when upgraded)."""
    return calc_annual_point_earn(card, spend) * _conversion_rate(card, wallet_currency_ids)


def _tied_cards_for_category(
    selected_cards: list[CardData],
    spend: dict[str, float],
    category: str,
    wallet_currency_ids: set[int],
) -> list[CardData]:
    """
    All selected cards tied for the best multiplier × effective CPP on this category.
    Category dollars are split evenly across them; each card applies its own multiplier
    to its share (see calc_annual_point_earn_allocated).
    """
    scored: list[tuple[float, CardData]] = []
    for c in selected_cards:
        m = _multiplier_for_category(c, category, spend)
        cpp = _comparison_cpp(c, wallet_currency_ids)
        scored.append((m * cpp, c))
    if not scored:
        return []
    best = max(t[0] for t in scored)
    tied = [c for score, c in scored if math.isclose(score, best, rel_tol=0.0, abs_tol=1e-9)]
    tied.sort(key=lambda c: c.id)
    return tied


def calc_annual_point_earn_allocated(
    card: CardData,
    selected_cards: list[CardData],
    spend: dict[str, float],
    wallet_currency_ids: set[int],
) -> float:
    """
    Points from spend: each category is assigned to the card(s) with the best
    multiplier × effective CPP; tied cards split category dollars evenly, each
    earning (share × own multiplier). Annual bonus still applies in full to every card.
    """
    if len(selected_cards) <= 1:
        return calc_annual_point_earn(card, spend)
    total = float(card.annual_bonus)
    for cat, s in spend.items():
        if s <= 0:
            continue
        tied = _tied_cards_for_category(selected_cards, spend, cat, wallet_currency_ids)
        if not tied or card.id not in {c.id for c in tied}:
            continue
        n = len(tied)
        m = _multiplier_for_category(card, cat, spend)
        total += (s / n) * m
    return total


def _effective_annual_earn_allocated(
    card: CardData,
    spend: dict[str, float],
    selected_cards: list[CardData],
    wallet_currency_ids: set[int],
) -> float:
    """Like _effective_annual_earn but category spend is wallet-allocated (see above)."""
    return (
        calc_annual_point_earn_allocated(card, selected_cards, spend, wallet_currency_ids)
        * _conversion_rate(card, wallet_currency_ids)
    )


# ---------------------------------------------------------------------------
# Core per-card calculations
# ---------------------------------------------------------------------------


def calc_annual_point_earn(
    card: CardData,
    spend: dict[str, float],
) -> float:
    """Total points earned per year from category spend plus any annual bonus.
    Uses effective multipliers (top-N applied for groups) and All Other fallback.
    """
    effective = _build_effective_multipliers(card, spend)
    all_other = _all_other_multiplier(effective)
    cat_pts = sum(
        s * (effective[cat] if cat in effective else all_other)
        for cat, s in spend.items()
    )
    return float(card.annual_bonus) + cat_pts


def _credit_annual_and_one_time_totals(card: CardData) -> tuple[float, float]:
    annual = 0.0
    one_time = 0.0
    for line in card.credit_lines:
        if line.one_time:
            one_time += line.value
        else:
            annual += line.value
    return annual, one_time


def calc_credit_valuation(card: CardData) -> float:
    """Sum of credit dollar values (annual + one-time face amounts) for display."""
    a, o = _credit_annual_and_one_time_totals(card)
    return a + o


def calc_sub_extra_spend(
    card: CardData,
    spend: dict[str, float],
) -> float:
    """
    Additional dollars that must be spent to hit the SUB minimum spend,
    beyond what the card earns naturally from its category assignments.
    """
    if not card.sub_min_spend:
        return 0.0
    effective = _build_effective_multipliers(card, spend)
    all_other = _all_other_multiplier(effective)
    natural_spend = sum(
        v for cat, v in spend.items() if (effective.get(cat) or all_other) > 0
    )
    return max(0.0, card.sub_min_spend - natural_spend)


def _best_wallet_earn_rate_dollars(
    card: CardData,
    selected_cards: list[CardData],
    spend: dict[str, float],
    wallet_currency_ids: set[int],
) -> float:
    """
    Spend-weighted best dollar-equivalent earn rate across all other selected
    cards for each category.

    For every category with positive spend, this finds the other card that
    would earn the most in dollar terms (multiplier × cpp).
    Returns a blended rate in $/$ (dollars earned per dollar spent).

    This replaces the old avg-multiplier approach: it is cross-currency aware
    and picks the *best* alternative rather than averaging all of them.
    """
    others = [c for c in selected_cards if c.id != card.id]
    if not others:
        return 0.0

    total_spend = 0.0
    total_best_earn = 0.0

    effective_per_card = {c.id: _build_effective_multipliers(c, spend) for c in others}
    for cat, s in spend.items():
        if s <= 0:
            continue
        # Best dollar-earn rate for this category among other selected cards
        best_rate = max(
            (effective_per_card[c.id].get(cat) or _all_other_multiplier(effective_per_card[c.id]))
            * _comparison_cpp(c, wallet_currency_ids)
            / 100.0
            for c in others
        )
        total_spend += s
        total_best_earn += s * best_rate

    return total_best_earn / total_spend if total_spend > 0 else 0.0


def calc_sub_opportunity_cost(
    card: CardData,
    selected_cards: list[CardData],
    spend: dict[str, float],
    wallet_currency_ids: set[int],
) -> tuple[float, float]:
    """
    Dollar opportunity cost of redirecting extra SUB spend from the rest of
    the wallet to this card.

    Returns (gross_opp_cost_dollars, net_opp_cost_dollars):
      gross = extra_spend × best_wallet_earn_rate
      net   = gross − value_of_sub_spend_earn_on_this_card
              (i.e. what you truly lose after accounting for what the new card
               earns on that same spend)
    """
    extra_spend = calc_sub_extra_spend(card, spend)
    if extra_spend <= 0:
        return 0.0, 0.0

    best_rate = _best_wallet_earn_rate_dollars(card, selected_cards, spend, wallet_currency_ids)
    gross = extra_spend * best_rate

    currency = _effective_currency(card, wallet_currency_ids)
    sub_spend_value = card.sub_spend_earn * currency.cents_per_point / 100.0
    net = max(0.0, gross - sub_spend_value)

    return round(gross, 4), round(net, 4)


def calc_avg_spend_multiplier(
    card: CardData,
    spend: dict[str, float],
) -> float:
    """Spend-weighted average multiplier across categories with positive spend.
    Uses effective multipliers (top-N applied) and All Other fallback.
    """
    effective = _build_effective_multipliers(card, spend)
    all_other = _all_other_multiplier(effective)
    total_spend = 0.0
    total_pts = 0.0
    for cat, s in spend.items():
        mult = effective.get(cat) or all_other
        if s > 0:
            total_spend += s
            total_pts += s * mult
    return total_pts / total_spend if total_spend > 0 else 0.0


def calc_total_points(
    card: CardData,
    selected_cards: list[CardData],
    spend: dict[str, float],
    years: int,
    wallet_currency_ids: set[int],
) -> float:
    """
    Total points over `years` including SUB and annual bonuses (in effective currency).
    Recurring category earn uses the same wallet allocation as annual_point_earn
    (best multiplier × effective CPP per category; ties split category dollars).
    """
    currency = _effective_currency(card, wallet_currency_ids)
    effective_earn = _effective_annual_earn_allocated(
        card, spend, selected_cards, wallet_currency_ids
    )
    _, net_opp = calc_sub_opportunity_cost(card, selected_cards, spend, wallet_currency_ids)

    # Convert net opp cost back to a points deduction in the effective currency
    cpp = currency.cents_per_point
    net_opp_pts = (net_opp / (cpp / 100.0)) if cpp > 0 else 0.0

    rate = _conversion_rate(card, wallet_currency_ids)
    effective_sub = card.sub_spend_earn * rate
    total = (
        effective_earn
        + effective_sub
        + card.sub
        - net_opp_pts
    ) + effective_earn * (years - 1)
    return total


def _average_annual_net_dollars(
    card: CardData,
    spend: dict[str, float],
    years: int,
    wallet_currency_ids: set[int],
    selected_cards: list[CardData],
) -> float:
    """
    Average annual net dollar benefit over `years`, amortising SUB and first-year fee.

    Category spend is wallet-allocated (each category goes to best m×CPP card(s);
    ties split dollars evenly among tied cards).

    effective_earn already includes card.annual_bonus (from _effective_annual_earn_allocated),
    so the annual bonus is naturally amortised over `years` via the earn × years term.

    Formula:
      ( (effective_earn + sub_spend_pts) * cpp / 100 * years
        + sub_pts * cpp / 100
        + annual_credits * years + one_time_credits
        - fee
      ) / years
    """
    currency = _effective_currency(card, wallet_currency_ids)
    cpp = currency.cents_per_point
    effective_earn = _effective_annual_earn_allocated(
        card, spend, selected_cards, wallet_currency_ids
    )
    annual_credits, one_time_credits = _credit_annual_and_one_time_totals(card)

    rate = _conversion_rate(card, wallet_currency_ids)
    effective_sub = card.sub_spend_earn * rate
    fee_y1 = card.first_year_fee if card.first_year_fee is not None else card.annual_fee
    total_fees = fee_y1 + (years - 1) * card.annual_fee
    # effective_earn (from _effective_annual_earn_allocated) already includes card.annual_bonus,
    # so it is counted correctly via the years multiplier above.
    # card.sub is the one-time SUB in raw currency units; convert to dollars with * cpp / 100
    # (for cash cards cpp=1, so * cpp / 100 is the same as / 100).
    value = (
        ((effective_earn + effective_sub) / 100 * cpp) * years
        + card.sub * cpp / 100
        + annual_credits * years
        + one_time_credits
        - total_fees
    ) / years
    return value


# ---------------------------------------------------------------------------
# Wallet-level aggregation
# ---------------------------------------------------------------------------


def compute_wallet(
    all_cards: list[CardData],
    selected_ids: set[int],
    spend: dict[str, float],
    years: int,
) -> WalletResult:
    """
    Compute results for every card in `all_cards`.
    Only cards with id in `selected_ids` contribute to totals and currency points.
    """
    selected_cards = [c for c in all_cards if c.id in selected_ids]
    active_wallet_currency_ids = _wallet_currency_ids(selected_cards)

    card_results: list[CardResult] = []

    for card in all_cards:
        selected = card.id in selected_ids

        if not selected:
            card_results.append(
                CardResult(
                    card_id=card.id,
                    card_name=card.name,
                    selected=False,
                    annual_fee=card.annual_fee,
                    first_year_fee=card.first_year_fee,
                    sub=card.sub,
                    cents_per_point=card.currency.cents_per_point,
                    effective_currency_name=card.currency.name,
                    effective_currency_id=card.currency.id,
                    effective_reward_kind=card.currency.reward_kind,
                )
            )
            continue

        eff_currency = _effective_currency(card, active_wallet_currency_ids)
        net_annual = _average_annual_net_dollars(
            card, spend, years, active_wallet_currency_ids, selected_cards
        )
        effective_annual_fee = round(-net_annual, 4)
        annual_point_earn = _effective_annual_earn_allocated(
            card, spend, selected_cards, active_wallet_currency_ids
        )
        total_points = calc_total_points(card, selected_cards, spend, years, active_wallet_currency_ids)
        credit_val = calc_credit_valuation(card)
        sub_extra = calc_sub_extra_spend(card, spend)
        gross_opp, net_opp = calc_sub_opportunity_cost(card, selected_cards, spend, active_wallet_currency_ids)
        avg_mult = calc_avg_spend_multiplier(card, spend)

        card_results.append(
            CardResult(
                card_id=card.id,
                card_name=card.name,
                selected=True,
                effective_annual_fee=effective_annual_fee,
                total_points=round(total_points, 2),
                annual_point_earn=round(annual_point_earn, 2),
                credit_valuation=round(credit_val, 2),
                annual_fee=card.annual_fee,
                first_year_fee=card.first_year_fee,
                sub=card.sub,
                annual_bonus=card.annual_bonus,
                sub_extra_spend=round(sub_extra, 2),
                sub_spend_earn=card.sub_spend_earn,
                sub_opp_cost_dollars=net_opp,
                sub_opp_cost_gross_dollars=gross_opp,
                avg_spend_multiplier=round(avg_mult, 4),
                cents_per_point=eff_currency.cents_per_point,
                effective_currency_name=eff_currency.name,
                effective_currency_id=eff_currency.id,
                effective_reward_kind=eff_currency.reward_kind,
            )
        )

    selected_results = [r for r in card_results if r.selected]
    total_effective_annual_fee = round(
        sum(r.effective_annual_fee for r in selected_results), 4
    )
    points_only = [r for r in selected_results if r.effective_reward_kind != "cash"]
    cash_only = [r for r in selected_results if r.effective_reward_kind == "cash"]
    total_points_earned = round(sum(r.total_points for r in points_only), 2)
    total_annual_pts = round(sum(r.annual_point_earn for r in points_only), 2)
    total_cash_reward_dollars = round(
        sum(r.total_points * r.cents_per_point / 100.0 for r in cash_only), 4
    )
    total_reward_value_usd = round(
        sum(r.total_points * r.cents_per_point / 100.0 for r in selected_results), 4
    )

    # Total points over the projection period, by effective currency (spend + SUB + bonuses − opp cost)
    currency_pts: dict[str, float] = {}
    currency_pts_by_id: dict[int, float] = {}
    for r in selected_results:
        name = (r.effective_currency_name or "").strip()
        if name:
            currency_pts[name] = currency_pts.get(name, 0.0) + r.total_points
        cid = r.effective_currency_id
        if cid:
            currency_pts_by_id[cid] = currency_pts_by_id.get(cid, 0.0) + r.total_points
    currency_pts = {k: round(v, 2) for k, v in currency_pts.items()}
    currency_pts_by_id = {k: round(v, 2) for k, v in currency_pts_by_id.items()}

    return WalletResult(
        years_counted=years,
        total_effective_annual_fee=total_effective_annual_fee,
        total_points_earned=total_points_earned,
        total_annual_pts=total_annual_pts,
        total_cash_reward_dollars=total_cash_reward_dollars,
        total_reward_value_usd=total_reward_value_usd,
        currency_pts=currency_pts,
        currency_pts_by_id=currency_pts_by_id,
        card_results=card_results,
    )
