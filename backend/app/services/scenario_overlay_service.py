"""Scenario card overlay data access service.

Overlays carry per-scenario hypothetical overrides on OWNED card instances
(scenario_id IS NULL). The same wallet card can have a different overlay
per scenario.
"""

from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import CardInstance, ScenarioCardOverlay
from .base import BaseService


class ScenarioCardOverlayService(BaseService[ScenarioCardOverlay]):
    """Manage ScenarioCardOverlay rows + enforce overlay-target rules."""

    model = ScenarioCardOverlay

    async def list_for_scenario(
        self, scenario_id: int
    ) -> list[ScenarioCardOverlay]:
        result = await self.db.execute(
            select(ScenarioCardOverlay).where(
                ScenarioCardOverlay.scenario_id == scenario_id
            )
        )
        return list(result.scalars().all())

    async def get(
        self, scenario_id: int, card_instance_id: int
    ) -> Optional[ScenarioCardOverlay]:
        result = await self.db.execute(
            select(ScenarioCardOverlay).where(
                ScenarioCardOverlay.scenario_id == scenario_id,
                ScenarioCardOverlay.card_instance_id == card_instance_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        scenario_id: int,
        card_instance_id: int,
        **fields,
    ) -> ScenarioCardOverlay:
        """Create or update an overlay. Validates the target instance is
        OWNED (scenario_id IS NULL) — overlays are not allowed on
        scenario-scoped (future) instances."""
        # Verify the target is an owned card instance
        result = await self.db.execute(
            select(CardInstance).where(CardInstance.id == card_instance_id)
        )
        instance = result.scalar_one_or_none()
        if not instance:
            raise HTTPException(
                status_code=404,
                detail=f"Card instance {card_instance_id} not found",
            )
        if instance.scenario_id is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Overlays only apply to owned card instances; future "
                    "cards should be edited directly via "
                    "/scenarios/{sid}/future-cards/{id}"
                ),
            )

        row = await self.get(scenario_id, card_instance_id)
        if row is None:
            row = ScenarioCardOverlay(
                scenario_id=scenario_id,
                card_instance_id=card_instance_id,
                **fields,
            )
            self.db.add(row)
        else:
            for k, v in fields.items():
                setattr(row, k, v)
        await self.db.flush()
        return row

    async def clear(self, scenario_id: int, card_instance_id: int) -> None:
        """Delete the overlay row entirely (revert to base)."""
        row = await self.get(scenario_id, card_instance_id)
        if row is None:
            raise HTTPException(status_code=404, detail="No overlay to clear")
        await self.db.delete(row)
        await self.db.flush()


def get_scenario_card_overlay_service(
    db: AsyncSession = Depends(get_db),
) -> ScenarioCardOverlayService:
    """FastAPI dependency for ScenarioCardOverlayService."""
    return ScenarioCardOverlayService(db)
