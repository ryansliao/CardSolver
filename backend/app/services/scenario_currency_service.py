"""Per-scenario currency CPP / balance services."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import (
    Currency,
    ScenarioCurrencyBalance,
    ScenarioCurrencyCpp,
)
from .base import BaseService


class ScenarioCurrencyService(BaseService[ScenarioCurrencyCpp]):
    """Per-scenario CPP overrides + tracked currency balances."""

    model = ScenarioCurrencyCpp

    # ---- CPP overrides ----

    async def list_cpp(self, scenario_id: int) -> list[ScenarioCurrencyCpp]:
        result = await self.db.execute(
            select(ScenarioCurrencyCpp).where(
                ScenarioCurrencyCpp.scenario_id == scenario_id
            )
        )
        return list(result.scalars().all())

    async def get_cpp(
        self, scenario_id: int, currency_id: int
    ) -> Optional[ScenarioCurrencyCpp]:
        result = await self.db.execute(
            select(ScenarioCurrencyCpp).where(
                ScenarioCurrencyCpp.scenario_id == scenario_id,
                ScenarioCurrencyCpp.currency_id == currency_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_cpp(
        self, scenario_id: int, currency_id: int, cents_per_point: float
    ) -> ScenarioCurrencyCpp:
        # Validate currency exists
        cur = await self.db.execute(
            select(Currency).where(Currency.id == currency_id)
        )
        if not cur.scalar_one_or_none():
            raise HTTPException(
                status_code=404, detail=f"Currency {currency_id} not found"
            )

        row = await self.get_cpp(scenario_id, currency_id)
        if row is None:
            row = ScenarioCurrencyCpp(
                scenario_id=scenario_id,
                currency_id=currency_id,
                cents_per_point=cents_per_point,
            )
            self.db.add(row)
        else:
            row.cents_per_point = cents_per_point
        await self.db.flush()
        return row

    async def delete_cpp(self, scenario_id: int, currency_id: int) -> None:
        row = await self.get_cpp(scenario_id, currency_id)
        if row is None:
            raise HTTPException(status_code=404, detail="No CPP override")
        await self.db.delete(row)

    # ---- Currency balances ----

    async def list_balances(
        self, scenario_id: int
    ) -> list[ScenarioCurrencyBalance]:
        result = await self.db.execute(
            select(ScenarioCurrencyBalance).where(
                ScenarioCurrencyBalance.scenario_id == scenario_id
            )
        )
        return list(result.scalars().all())

    async def get_balance(
        self, scenario_id: int, currency_id: int
    ) -> Optional[ScenarioCurrencyBalance]:
        result = await self.db.execute(
            select(ScenarioCurrencyBalance).where(
                ScenarioCurrencyBalance.scenario_id == scenario_id,
                ScenarioCurrencyBalance.currency_id == currency_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_balance(
        self, scenario_id: int, currency_id: int, balance: float
    ) -> ScenarioCurrencyBalance:
        cur = await self.db.execute(
            select(Currency).where(Currency.id == currency_id)
        )
        if not cur.scalar_one_or_none():
            raise HTTPException(
                status_code=404, detail=f"Currency {currency_id} not found"
            )

        row = await self.get_balance(scenario_id, currency_id)
        if row is None:
            row = ScenarioCurrencyBalance(
                scenario_id=scenario_id,
                currency_id=currency_id,
                balance=balance,
            )
            self.db.add(row)
        else:
            row.balance = balance
        await self.db.flush()
        return row

    async def delete_balance(self, scenario_id: int, currency_id: int) -> None:
        row = await self.get_balance(scenario_id, currency_id)
        if row is None:
            raise HTTPException(status_code=404, detail="No balance row")
        await self.db.delete(row)


def get_scenario_currency_service(
    db: AsyncSession = Depends(get_db),
) -> ScenarioCurrencyService:
    """FastAPI dependency for ScenarioCurrencyService."""
    return ScenarioCurrencyService(db)
