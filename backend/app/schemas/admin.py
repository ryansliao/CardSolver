"""Admin endpoint payload schemas (reference data CRUD)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class AdminCreateIssuerPayload(BaseModel):
    name: str = Field(..., max_length=80)


class AdminCreateSpendCategoryPayload(BaseModel):
    category: str = Field(..., max_length=80)
    is_housing: bool = False
    is_foreign_eligible: bool = False


class AdminCreateCurrencyPayload(BaseModel):
    name: str = Field(..., max_length=80)
    reward_kind: str = Field(default="points", pattern="^(points|cash)$")
    cents_per_point: float = Field(default=1.0, gt=0)
    partner_transfer_rate: Optional[float] = Field(default=None, gt=0)
    cash_transfer_rate: Optional[float] = Field(default=None, gt=0)
    converts_to_currency_id: Optional[int] = None
    converts_at_rate: Optional[float] = Field(default=None, gt=0)
    no_transfer_cpp: Optional[float] = Field(default=None, gt=0)
    no_transfer_rate: Optional[float] = Field(default=None, gt=0, le=1)


class AdminCreateCardPayload(BaseModel):
    name: str = Field(..., max_length=120)
    issuer_id: int
    co_brand_id: Optional[int] = None
    currency_id: int
    annual_fee: float = Field(default=0.0, ge=0)
    first_year_fee: Optional[float] = Field(default=None, ge=0)
    business: bool = False
    network_tier_id: Optional[int] = None
    transfer_enabler: bool = False
    sub_points: Optional[int] = Field(default=None, ge=0)
    sub_min_spend: Optional[int] = Field(default=None, ge=0)
    sub_months: Optional[int] = Field(default=None, ge=1)
    sub_spend_earn: Optional[int] = Field(default=None, ge=0)
    sub_cash: Optional[float] = Field(default=None, ge=0)
    sub_secondary_points: Optional[int] = Field(default=None, ge=0)
    annual_bonus: Optional[int] = Field(default=None, ge=0)
    annual_bonus_percent: Optional[float] = Field(default=None, ge=0)
    annual_bonus_first_year_only: Optional[bool] = None
    secondary_currency_id: Optional[int] = None
    secondary_currency_rate: Optional[float] = Field(default=None, ge=0, le=1)
    secondary_currency_cap_rate: Optional[float] = Field(default=None, ge=0, le=1)
    accelerator_cost: Optional[int] = Field(default=None, ge=0)
    accelerator_spend_limit: Optional[float] = Field(default=None, ge=0)
    accelerator_bonus_multiplier: Optional[float] = Field(default=None, ge=0)
    accelerator_max_activations: Optional[int] = Field(default=None, ge=0)
    housing_tiered_enabled: bool = False
    foreign_transaction_fee: bool = False
    housing_fee_waived: bool = False
    sub_recurrence_months: Optional[int] = Field(default=None, ge=1)
    sub_family: Optional[str] = Field(default=None, max_length=80)


class AdminAddCardMultiplierPayload(BaseModel):
    category_id: int
    multiplier: float = Field(..., gt=0)
    is_portal: bool = False
    is_additive: bool = False
    cap_per_billing_cycle: Optional[float] = Field(default=None, gt=0)
    cap_period_months: Optional[int] = Field(default=None, ge=1)
    multiplier_group_id: Optional[int] = None


class AdminCreateCardMultiplierGroupPayload(BaseModel):
    multiplier: float = Field(..., gt=0)
    cap_per_billing_cycle: Optional[float] = Field(default=None, gt=0)
    cap_period_months: Optional[int] = Field(default=None, ge=1)
    top_n_categories: Optional[int] = Field(default=None, ge=1)
    is_rotating: bool = False
    is_additive: bool = False
    category_ids: list[int] = Field(default_factory=list)


class AdminUpdateCardMultiplierGroupPayload(BaseModel):
    multiplier: Optional[float] = Field(default=None, gt=0)
    cap_per_billing_cycle: Optional[float] = None
    cap_period_months: Optional[int] = Field(default=None, ge=1)
    top_n_categories: Optional[int] = None
    is_rotating: Optional[bool] = None
    is_additive: Optional[bool] = None
    category_ids: Optional[list[int]] = None


class AdminAddRotatingHistoryPayload(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    quarter: int = Field(..., ge=1, le=4)
    spend_category_id: int


class AdminCreateTravelPortalPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    card_ids: list[int] = Field(default_factory=list)


class AdminUpdateTravelPortalPayload(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    card_ids: Optional[list[int]] = None
