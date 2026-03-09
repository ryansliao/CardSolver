"""
Credit card value calculation engine.

All functions mirror the spreadsheet formulas exactly.

Terminology
-----------
- card       : a dict with the card's static data (from DB or schemas)
- spend      : a dict of {category: annual_spend_dollars}
- cpp        : cents per point
- EV         : expected value (dollars)
- SUB        : sign-up bonus
- years      : years_counted (C1 in the sheet)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Data containers (plain dataclasses so the engine has no DB dependency)
# ---------------------------------------------------------------------------


@dataclass
class CardData:
    id: int
    name: str
    issuer: str
    currency: str
    annual_fee: float
    cents_per_point: float
    sub_points: int
    sub_min_spend: Optional[int]
    sub_months: Optional[int]
    sub_spend_points: int
    annual_bonus_points: int
    boosted_by_chase_premium: bool
    points_adjustment_factor: float  # 1.0 for most; ~1.1765 for Delta cobrand
    multipliers: dict[str, float] = field(default_factory=dict)
    # credit_name -> value in dollars
    credits: dict[str, float] = field(default_factory=dict)


@dataclass
class CardResult:
    card_id: int
    card_name: str
    selected: bool
    # Per-card computed values (all 0 when not selected)
    annual_ev: float = 0.0
    second_year_ev: float = 0.0
    total_points: float = 0.0
    annual_point_earn: float = 0.0
    credit_valuation: float = 0.0
    annual_fee: float = 0.0
    sub_points: int = 0
    annual_bonus_points: int = 0
    sub_extra_spend: float = 0.0
    sub_spend_points: int = 0
    sub_opportunity_cost: float = 0.0
    opp_cost_abs: float = 0.0
    avg_spend_multiplier: float = 0.0
    cents_per_point: float = 0.0


@dataclass
class WalletResult:
    years_counted: int
    total_annual_ev: float
    total_points_earned: float
    total_annual_pts: float
    # Currency group breakdowns
    amex_mr_pts: float = 0.0
    chase_ur_pts: float = 0.0
    capital_one_pts: float = 0.0
    citi_ty_pts: float = 0.0
    bilt_pts: float = 0.0
    delta_pts: float = 0.0
    hilton_pts: float = 0.0
    card_results: list[CardResult] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _has_chase_premium(selected_cards: list[CardData]) -> bool:
    """Return True if any Chase premium travel card is in the selected wallet."""
    PREMIUM = {
        "Chase Sapphire Reserve",
        "Chase Sapphire Preferred",
        "Chase Ink Preferred",
    }
    return any(c.name in PREMIUM for c in selected_cards)


def _effective_multiplier(card: CardData, category: str, chase_premium: bool) -> float:
    """
    Return the effective multiplier for a card/category pair.
    Chase Freedom Unlimited and Freedom Flex earn 1.5x on points transferred
    to a premium Chase card (UR → 1.5cpp instead of 1cpp), which the sheet
    models as multiplying the base rate by the partner card's cpp (1.5x on 1cpp = same
    face value as 1x on 1.5cpp).  The sheet uses cpp=2 for UR when a premium
    Chase card is held — so the *multiplier* stays the same and the cpp handles it.
    """
    return card.multipliers.get(category, 1.0)


def _effective_cpp(card: CardData, chase_premium: bool) -> float:
    """
    Chase Freedom Unlimited/Flex: base cpp is 1 (cash-back mode).
    When a premium Chase card is held the points transfer to UR at 1.5cpp.
    The spreadsheet stores cpp=2 for these cards (already accounting for the
    premium transfer), so we just return the stored value.
    """
    return card.cents_per_point


# ---------------------------------------------------------------------------
# Core per-card calculations
# ---------------------------------------------------------------------------


def calc_points_earned_by_category(
    card: CardData,
    spend: dict[str, float],
    chase_premium: bool,
) -> dict[str, float]:
    """
    Points earned per category for a single card.
    Returns {category: points}.
    """
    result: dict[str, float] = {}
    for cat, annual_spend in spend.items():
        mult = _effective_multiplier(card, cat, chase_premium)
        result[cat] = annual_spend * mult
    return result


def calc_annual_point_earn(
    card: CardData,
    spend: dict[str, float],
    chase_premium: bool,
) -> float:
    """
    Total points earned per year (no SUB, no annual bonus).
    Corresponds to spreadsheet row 4 (Annual Point Earn).
    Formula: SUM(card_col rows 9, 19:35)
    Row 9 = annual bonus, rows 19-35 = category spend * multiplier
    """
    cat_points = calc_points_earned_by_category(card, spend, chase_premium)
    return float(card.annual_bonus_points) + sum(cat_points.values())


def calc_credit_valuation(card: CardData) -> float:
    """
    Total dollar value of all annual credits/perks.
    Corresponds to row 6 (Credit Valuation) = SUM(credit rows 36-48).
    """
    return sum(card.credits.values())


def calc_2nd_year_ev(
    card: CardData,
    spend: dict[str, float],
    chase_premium: bool,
) -> float:
    """
    Steady-state annual EV (no SUB amortization).
    Formula: SUM(cat_pts) / 100 * cpp + credits - fee

    For Chase Freedom Unlimited/Flex: the sheet multiplies by cpp only when a
    premium Chase card is held; otherwise uses 1.  We store the correct cpp
    (2.0 when premium card is in wallet, 1.0 otherwise) in card.cents_per_point,
    so the formula is straightforward here.
    """
    cpp = _effective_cpp(card, chase_premium)
    annual_earn = calc_annual_point_earn(card, spend, chase_premium)
    credits = calc_credit_valuation(card)
    return annual_earn / 100 * cpp + credits - card.annual_fee


def calc_sub_extra_spend(
    card: CardData,
    spend: dict[str, float],
) -> float:
    """
    How many additional dollars must be spent to hit the SUB minimum spend,
    beyond what the card earns naturally (from its category assignments).

    Formula (LET in spreadsheet):
      total_natural_spend = SUMIF(card_spend, ">0", total_spend)
      IF(total_natural_spend < threshold, threshold - total_natural_spend, 0)

    Because in the model spend is already split by category across selected cards,
    'natural spend on this card' = sum of all categories where this card has a
    positive multiplier and the category spend > 0.
    """
    if card.sub_min_spend is None or card.sub_min_spend == 0:
        return 0.0
    natural_spend = sum(
        v for cat, v in spend.items() if card.multipliers.get(cat, 0) > 0
    )
    gap = card.sub_min_spend - natural_spend
    return max(0.0, gap)


def _avg_alt_multiplier(
    card: CardData,
    selected_cards: list[CardData],
    spend: dict[str, float],
    chase_premium: bool,
) -> float:
    """
    Average spend multiplier across other selected cards (excluding current card).
    Used for SUB opportunity cost calculation.
    """
    others = [c for c in selected_cards if c.id != card.id]
    if not others:
        return 0.0

    total_earn = 0.0
    total_spend = 0.0
    for other in others:
        for cat, s in spend.items():
            mult = _effective_multiplier(other, cat, chase_premium)
            if mult > 0:
                total_earn += s * mult
                total_spend += s

    if total_spend == 0:
        return 0.0
    return total_earn / total_spend


def calc_sub_opportunity_cost(
    card: CardData,
    selected_cards: list[CardData],
    spend: dict[str, float],
    chase_premium: bool,
) -> float:
    """
    Points cost of redirecting extra SUB spend from other cards to this one.
    Formula (from spreadsheet LET):
      extra_spend = sub_extra_spend
      avg_alt = average multiplier of other selected cards (excluding current)
      points_if_redirected = extra_spend * avg_alt
      net_cost_points = points_if_redirected - sub_spend_points  (points LOST)
      result = MAX(0, net_cost_points) if extra_spend > 0 else 0

    Returns the POINT cost (not dollar cost).
    """
    extra_spend = calc_sub_extra_spend(card, spend)
    if extra_spend <= 0:
        return 0.0

    avg_alt = _avg_alt_multiplier(card, selected_cards, spend, chase_premium)
    points_if_redirected = extra_spend * avg_alt
    sub_spend_pts = float(card.sub_spend_points)
    net_cost = points_if_redirected - sub_spend_pts
    return max(0.0, net_cost)


def calc_opp_cost_abs(
    card: CardData,
    selected_cards: list[CardData],
    spend: dict[str, float],
    chase_premium: bool,
) -> float:
    """
    Absolute opportunity cost in points, accounting for how other cards'
    opportunity costs spill over into this card.

    This is a close Python translation of the complex LET formula in the sheet:

    total_other_opp = sum of sub_opp_cost of all OTHER selected cards
    all_other_points = this card's sub_spend_points (absorption capacity)
    remaining_after_all_other = MAX(0, total_other_opp - all_other_points)
    all_other_absorption = MIN(all_other_points, total_other_opp)
    proportional_share = (1/avg_mult_this) / sum(1/avg_mult_all)
    other_categories_total = sum of spend assigned to this card across all categories
    other_absorption = MIN(other_categories_total, proportional_share * remaining_after_all_other)
    result = all_other_absorption + other_absorption
    """
    # Per-card opp costs for all selected cards
    opp_costs: dict[int, float] = {}
    for c in selected_cards:
        opp_costs[c.id] = calc_sub_opportunity_cost(c, selected_cards, spend, chase_premium)

    total_other_opp = sum(v for cid, v in opp_costs.items() if cid != card.id)
    all_other_points = float(card.sub_spend_points)

    remaining_after_all_other = max(0.0, total_other_opp - all_other_points)
    all_other_absorption = min(all_other_points, total_other_opp)

    # Proportional share based on inverse of average multiplier
    def avg_mult(c: CardData) -> float:
        pts = [c.multipliers.get(cat, 1.0) for cat, s in spend.items() if s > 0 and c.multipliers.get(cat, 0) > 0]
        return sum(pts) / len(pts) if pts else 0.0

    inv_mult = 1 / avg_mult(card) if avg_mult(card) > 0 else 0.0
    sum_inv = sum(
        (1 / avg_mult(c) if avg_mult(c) > 0 else 0.0) for c in selected_cards
    )
    proportional_share = inv_mult / sum_inv if sum_inv > 0 else 0.0

    # Total spend assigned to this card (categories where this card has the multiplier)
    other_categories_total = sum(
        v for cat, v in spend.items() if card.multipliers.get(cat, 0) > 0
    )

    other_absorption = min(
        other_categories_total,
        proportional_share * remaining_after_all_other,
    )

    return all_other_absorption + other_absorption


def calc_avg_spend_multiplier(
    card: CardData,
    spend: dict[str, float],
    chase_premium: bool,
) -> float:
    """
    Weighted average points multiplier across all categories where spend > 0.
    Corresponds to row 17 (Avg. Spend Multiplier):
      AVERAGEIF(card_spend_range, ">0", multiplier_range)
    """
    total_spend = 0.0
    total_pts = 0.0
    for cat, s in spend.items():
        mult = _effective_multiplier(card, cat, chase_premium)
        if s > 0:
            total_spend += s
            total_pts += s * mult
    return total_pts / total_spend if total_spend > 0 else 0.0


def calc_total_points(
    card: CardData,
    spend: dict[str, float],
    years: int,
    chase_premium: bool,
) -> float:
    """
    Total points over `years` years including SUB and annual bonuses.
    Formula: (cat_pts + annual_bonus + sub_points - sub_opp_cost - sub_extra_spend_pts)
             + cat_pts * (years - 1)
    Corresponds to spreadsheet row 3 (Points Earned).
    """
    annual_earn = calc_annual_point_earn(card, spend, chase_premium)
    sub_opp = calc_sub_opportunity_cost(card, [card], spend, chase_premium)
    # Points = first year (earn + SUB - losses) + recurring for remaining years
    first_year = (
        annual_earn
        + card.sub_points
        + card.sub_spend_points
        - sub_opp
        - calc_sub_extra_spend(card, spend)
    )
    # Actually the sheet formula is simpler — it doesn't subtract sub_extra_spend from points
    # Let's match sheet row 3 exactly:
    # =IF(selected, (cat_pts + annual_bonus + sub_pts - sub_opp - sub_extra_pts) + cat_pts * (years-1), 0)
    # sub_extra_pts here = calc_sub_extra_spend (the dollars, not points)
    # Checking: row 3 formula = (F4 + F14 + F8 - F15 - F16) + F4*(years-1)
    # F4 = annual_point_earn, F14 = sub_spend_points, F8 = sub_points,
    # F15 = sub_opp_cost (points), F16 = opp_cost_abs (points)
    opp_abs = calc_opp_cost_abs(card, [card], spend, chase_premium)
    total = (
        annual_earn
        + card.sub_spend_points
        + card.sub_points
        - sub_opp
        - opp_abs
    ) + annual_earn * (years - 1)
    return total * card.points_adjustment_factor


def calc_annual_ev(
    card: CardData,
    spend: dict[str, float],
    years: int,
    chase_premium: bool,
) -> float:
    """
    Annual EV over `years`, amortizing the SUB.
    Formula (row 2):
      ((cat_pts + annual_bonus) / 100 * cpp) * years
      + sub_pts / 100
      + sub_spend_pts * (years - 1)   ← annual bonus recurring
      + credits
      - fee
      ) / years
    Exact sheet formula for most cards:
      =IF(selected,
          ((F4 + F14)/100 * F18) * years
          + F8/100
          + F9*(years-1)
          + F6 - F7
          , 0) / years
    Where F4=annual_earn, F14=sub_spend_pts, F18=cpp, F8=sub_pts,
          F9=annual_bonus_pts, F6=credits, F7=fee.

    For Chase Freedom Unlimited/Flex: cpp is multiplied by IF(chase_premium, cpp, 1).
    We already store the correct cpp value so the formula works without branching.

    For Delta cobrand cards: the sheet divides the points formula by 0.85 (via
    points_adjustment_factor stored on the card).
    """
    cpp = _effective_cpp(card, chase_premium)
    annual_earn = calc_annual_point_earn(card, spend, chase_premium)
    credits = calc_credit_valuation(card)

    # For Delta cobrand cards the sheet wraps the points portion with * (1/0.85)
    pts_adj = card.points_adjustment_factor

    value = (
        ((annual_earn + card.sub_spend_points) / 100 * cpp) * years * pts_adj
        + card.sub_points / 100
        + card.annual_bonus_points * (years - 1)
        + credits
        - card.annual_fee
    ) / years
    return value


# ---------------------------------------------------------------------------
# Wallet-level aggregation
# ---------------------------------------------------------------------------

CURRENCY_GROUPS = {
    "Amex MR": "amex_mr_pts",
    "Chase UR": "chase_ur_pts",
    "Capital One Miles": "capital_one_pts",
    "Citi TY": "citi_ty_pts",
    "Bilt Rewards": "bilt_pts",
    "Delta SkyMiles": "delta_pts",
    "Hilton Honors": "hilton_pts",
}


def compute_wallet(
    all_cards: list[CardData],
    selected_ids: set[int],
    spend: dict[str, float],
    years: int,
) -> WalletResult:
    """
    Compute results for every card in `all_cards`.
    Only cards with id in `selected_ids` are considered active.
    """
    selected_cards = [c for c in all_cards if c.id in selected_ids]
    chase_premium = _has_chase_premium(selected_cards)

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
                    sub_points=card.sub_points,
                    cents_per_point=card.cents_per_point,
                )
            )
            continue

        annual_ev = calc_annual_ev(card, spend, years, chase_premium)
        second_year_ev = calc_2nd_year_ev(card, spend, chase_premium)
        annual_point_earn = calc_annual_point_earn(card, spend, chase_premium)
        total_points = calc_total_points(card, spend, years, chase_premium)
        credit_val = calc_credit_valuation(card)
        sub_extra = calc_sub_extra_spend(card, spend)
        sub_opp = calc_sub_opportunity_cost(card, selected_cards, spend, chase_premium)
        opp_abs = calc_opp_cost_abs(card, selected_cards, spend, chase_premium)
        avg_mult = calc_avg_spend_multiplier(card, spend, chase_premium)

        card_results.append(
            CardResult(
                card_id=card.id,
                card_name=card.name,
                selected=True,
                annual_ev=round(annual_ev, 4),
                second_year_ev=round(second_year_ev, 4),
                total_points=round(total_points, 2),
                annual_point_earn=round(annual_point_earn, 2),
                credit_valuation=round(credit_val, 2),
                annual_fee=card.annual_fee,
                sub_points=card.sub_points,
                annual_bonus_points=card.annual_bonus_points,
                sub_extra_spend=round(sub_extra, 2),
                sub_spend_points=card.sub_spend_points,
                sub_opportunity_cost=round(sub_opp, 2),
                opp_cost_abs=round(opp_abs, 2),
                avg_spend_multiplier=round(avg_mult, 4),
                cents_per_point=card.cents_per_point,
            )
        )

    selected_results = [r for r in card_results if r.selected]
    total_annual_ev = round(sum(r.annual_ev for r in selected_results), 4)
    total_points_earned = round(sum(r.total_points for r in selected_results), 2)
    total_annual_pts = round(sum(r.annual_point_earn for r in selected_results), 2)

    currency_totals: dict[str, float] = {v: 0.0 for v in CURRENCY_GROUPS.values()}
    for card in selected_cards:
        earn = calc_annual_point_earn(card, spend, chase_premium)
        group_key = CURRENCY_GROUPS.get(card.currency)
        if group_key:
            currency_totals[group_key] += earn

    return WalletResult(
        years_counted=years,
        total_annual_ev=total_annual_ev,
        total_points_earned=total_points_earned,
        total_annual_pts=total_annual_pts,
        card_results=card_results,
        **currency_totals,
    )
