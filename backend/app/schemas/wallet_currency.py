"""Wallet currency balance / initial set / track schemas."""

from __future__ import annotations

from datetime import date
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class WalletCurrencyBalanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    wallet_id: int
    currency_id: int
    currency_name: str = ""
    initial_balance: float = 0.0
    projection_earn: float = 0.0
    balance: float = 0.0
    user_tracked: bool = False
    updated_date: Optional[date] = None

    @model_validator(mode="wrap")
    @classmethod
    def populate_currency_name(cls, data: Any, handler: Any) -> Any:
        if not isinstance(data, dict) and "currency" in getattr(data, "__dict__", {}):
            c = data.__dict__["currency"]
            return handler(
                {
                    "id": data.id,
                    "wallet_id": data.wallet_id,
                    "currency_id": data.currency_id,
                    "currency_name": c.name if c else "",
                    "initial_balance": data.initial_balance,
                    "projection_earn": data.projection_earn,
                    "balance": data.balance,
                    "user_tracked": data.user_tracked,
                    "updated_date": data.updated_date,
                }
            )
        return handler(data)


class WalletCurrencyInitialSet(BaseModel):
    initial_balance: float = Field(..., ge=0)


class WalletCurrencyTrackCreate(BaseModel):
    currency_id: int
    initial_balance: float = Field(default=0.0, ge=0)
