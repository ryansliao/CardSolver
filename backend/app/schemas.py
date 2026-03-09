"""Pydantic v2 schemas for request/response validation."""

from __future__ import annotations

from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Issuer schemas
# ---------------------------------------------------------------------------


class IssuerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


# ---------------------------------------------------------------------------
# Currency schemas
# ---------------------------------------------------------------------------


class CurrencyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    issuer_id: int
    name: str
    cents_per_point: float
    is_cashback: bool
    is_transferable: bool
    comparison_factor: float


class CurrencyUpdate(BaseModel):
    cents_per_point: Optional[float] = None
    is_cashback: Optional[bool] = None
    is_transferable: Optional[bool] = None
    comparison_factor: Optional[float] = None


# ---------------------------------------------------------------------------
# Ecosystem boost schemas
# ---------------------------------------------------------------------------


class EcosystemBoostAnchorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    card_id: int


class EcosystemBoostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    issuer_id: int
    boosted_currency_id: int
    name: str
    description: Optional[str] = None
    boosted_currency: CurrencyRead
    anchors: list[EcosystemBoostAnchorRead] = []


# ---------------------------------------------------------------------------
# Card schemas
# ---------------------------------------------------------------------------


class CardCreditSchema(BaseModel):
    credit_name: str
    credit_value: float


class CardMultiplierSchema(BaseModel):
    category: str
    multiplier: float


class CardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    issuer_id: int
    currency_id: int
    ecosystem_boost_id: Optional[int] = None
    annual_fee: float
    sub_points: int
    sub_min_spend: Optional[int] = None
    sub_months: Optional[int] = None
    sub_spend_points: int
    annual_bonus_points: int

    # Nested objects for convenience
    issuer: IssuerRead
    currency_obj: CurrencyRead
    ecosystem_boost: Optional[EcosystemBoostRead] = None

    multipliers: list[CardMultiplierSchema] = []
    credits: list[CardCreditSchema] = []


class CardUpdate(BaseModel):
    """Partial update for a card's editable fields."""

    annual_fee: Optional[float] = None
    sub_points: Optional[int] = None
    sub_min_spend: Optional[int] = None
    sub_months: Optional[int] = None
    sub_spend_points: Optional[int] = None
    annual_bonus_points: Optional[int] = None
    currency_id: Optional[int] = None
    ecosystem_boost_id: Optional[int] = None


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
    # Opportunity cost in dollars (net: gross minus value earned on target card)
    sub_opp_cost_dollars: float = 0.0
    # Gross opportunity cost in dollars (what the wallet would have earned)
    sub_opp_cost_gross_dollars: float = 0.0
    avg_spend_multiplier: float = 0.0
    cents_per_point: float = 0.0
    # Effective currency name (may differ from default when ecosystem boost is active)
    effective_currency_name: str = ""


class WalletResultSchema(BaseModel):
    years_counted: int
    total_annual_ev: float
    total_points_earned: float
    total_annual_pts: float
    # Dynamic: currency name -> annual points earned in that currency.
    # Cashback cards whose boost fires accumulate under the boosted currency name.
    currency_pts: dict[str, float] = {}
    card_results: list[CardResultSchema] = []


class ScenarioResultSchema(BaseModel):
    scenario_id: int
    scenario_name: str
    as_of_date: Optional[date]
    wallet: WalletResultSchema


# ---------------------------------------------------------------------------
# Direct calculation request
# ---------------------------------------------------------------------------


class CalculateRequest(BaseModel):
    """Direct calculation endpoint — no spreadsheet required."""

    years_counted: int = Field(default=2, ge=1, le=20)
    selected_card_ids: list[int] = []
    spend_overrides: dict[str, float] = Field(
        default_factory=dict,
        description="Override annual spend per category (key = category name)",
    )
