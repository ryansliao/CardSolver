"""Pydantic v2 schemas for request/response validation."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Card schemas
# ---------------------------------------------------------------------------


class CardCreditSchema(BaseModel):
    credit_name: str
    credit_value: float


class CardMultiplierSchema(BaseModel):
    category: str
    multiplier: float


class CardBase(BaseModel):
    name: str
    issuer: str
    currency: str
    annual_fee: float = 0.0
    cents_per_point: float = 1.0
    sub_points: int = 0
    sub_min_spend: Optional[int] = None
    sub_months: Optional[int] = None
    sub_spend_points: int = 0
    annual_bonus_points: int = 0
    boosted_by_chase_premium: bool = False
    points_adjustment_factor: float = 1.0


class CardUpdate(BaseModel):
    """Partial update for a card's static data."""

    annual_fee: Optional[float] = None
    cents_per_point: Optional[float] = None
    sub_points: Optional[int] = None
    sub_min_spend: Optional[int] = None
    sub_months: Optional[int] = None
    sub_spend_points: Optional[int] = None
    annual_bonus_points: Optional[int] = None
    boosted_by_chase_premium: Optional[bool] = None
    points_adjustment_factor: Optional[float] = None


class CardRead(CardBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    multipliers: list[CardMultiplierSchema] = []
    credits: list[CardCreditSchema] = []


# ---------------------------------------------------------------------------
# Spend category schemas
# ---------------------------------------------------------------------------


class SpendCategoryBase(BaseModel):
    category: str
    annual_spend: float = 0.0


class SpendCategoryRead(SpendCategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SpendCategoryUpdate(BaseModel):
    annual_spend: float


# ---------------------------------------------------------------------------
# Scenario schemas
# ---------------------------------------------------------------------------


class ScenarioCardBase(BaseModel):
    card_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    years_counted: int = Field(default=2, ge=1)


class ScenarioCardCreate(ScenarioCardBase):
    pass


class ScenarioCardRead(ScenarioCardBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scenario_id: int
    card_name: Optional[str] = None  # populated by the API layer


class ScenarioBase(BaseModel):
    name: str
    description: Optional[str] = None
    as_of_date: Optional[date] = None


class ScenarioCreate(ScenarioBase):
    cards: list[ScenarioCardCreate] = []


class ScenarioUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    as_of_date: Optional[date] = None


class ScenarioRead(ScenarioBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scenario_cards: list[ScenarioCardRead] = []


# ---------------------------------------------------------------------------
# Calculation result schemas
# ---------------------------------------------------------------------------


class CardResultSchema(BaseModel):
    card_id: int
    card_name: str
    selected: bool
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


class WalletResultSchema(BaseModel):
    years_counted: int
    total_annual_ev: float
    total_points_earned: float
    total_annual_pts: float
    amex_mr_pts: float = 0.0
    chase_ur_pts: float = 0.0
    capital_one_pts: float = 0.0
    citi_ty_pts: float = 0.0
    bilt_pts: float = 0.0
    delta_pts: float = 0.0
    hilton_pts: float = 0.0
    card_results: list[CardResultSchema] = []


class ScenarioResultSchema(BaseModel):
    scenario_id: int
    scenario_name: str
    as_of_date: Optional[date]
    wallet: WalletResultSchema


# ---------------------------------------------------------------------------
# Direct calculation request (no Google Sheets needed)
# ---------------------------------------------------------------------------


class CalculateRequest(BaseModel):
    """
    Direct calculation endpoint — pass inputs without touching the spreadsheet.
    """

    years_counted: int = Field(default=2, ge=1, le=20)
    selected_card_ids: list[int] = []
    spend_overrides: dict[str, float] = Field(
        default_factory=dict,
        description="Override annual spend per category (key=category name)",
    )
