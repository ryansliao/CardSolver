"""Per-scenario travel portal share service."""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import ScenarioPortalShare, TravelPortal
from .base import BaseService


class ScenarioPortalService(BaseService[ScenarioPortalShare]):
    """Per-scenario travel portal shares."""

    model = ScenarioPortalShare

    async def list_for_scenario(
        self, scenario_id: int
    ) -> list[ScenarioPortalShare]:
        result = await self.db.execute(
            select(ScenarioPortalShare).where(
                ScenarioPortalShare.scenario_id == scenario_id
            )
        )
        return list(result.scalars().all())

    async def get(
        self, scenario_id: int, travel_portal_id: int
    ) -> Optional[ScenarioPortalShare]:
        result = await self.db.execute(
            select(ScenarioPortalShare).where(
                ScenarioPortalShare.scenario_id == scenario_id,
                ScenarioPortalShare.travel_portal_id == travel_portal_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert(
        self, scenario_id: int, travel_portal_id: int, share: float
    ) -> ScenarioPortalShare:
        # Validate portal exists
        portal = await self.db.execute(
            select(TravelPortal).where(TravelPortal.id == travel_portal_id)
        )
        if not portal.scalar_one_or_none():
            raise HTTPException(
                status_code=404,
                detail=f"Travel portal {travel_portal_id} not found",
            )

        row = await self.get(scenario_id, travel_portal_id)
        if row is None:
            row = ScenarioPortalShare(
                scenario_id=scenario_id,
                travel_portal_id=travel_portal_id,
                share=share,
            )
            self.db.add(row)
        else:
            row.share = share
        await self.db.flush()
        return row

    async def delete(self, scenario_id: int, travel_portal_id: int) -> None:
        row = await self.get(scenario_id, travel_portal_id)
        if row is None:
            raise HTTPException(status_code=404, detail="No portal share")
        await self.db.delete(row)


def get_scenario_portal_service(
    db: AsyncSession = Depends(get_db),
) -> ScenarioPortalService:
    """FastAPI dependency for ScenarioPortalService."""
    return ScenarioPortalService(db)
