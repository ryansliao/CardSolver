"""Travel portal endpoints (read + admin CRUD)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Card, TravelPortal
from ..schemas import (
    AdminCreateTravelPortalPayload,
    AdminUpdateTravelPortalPayload,
    TravelPortalRead,
)

router = APIRouter()


@router.get("/travel-portals", response_model=list[TravelPortalRead])
async def list_travel_portals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TravelPortal)
        .options(selectinload(TravelPortal.cards))
        .order_by(TravelPortal.name)
    )
    return result.scalars().all()


@router.post(
    "/admin/travel-portals",
    response_model=TravelPortalRead,
    status_code=status.HTTP_201_CREATED,
    tags=["admin"],
)
async def admin_create_travel_portal(
    payload: AdminCreateTravelPortalPayload,
    db: AsyncSession = Depends(get_db),
):
    name = payload.name.strip()
    existing = await db.execute(select(TravelPortal).where(TravelPortal.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail=f"Travel portal '{name}' already exists"
        )
    portal = TravelPortal(name=name)
    if payload.card_ids:
        cards_result = await db.execute(
            select(Card).where(Card.id.in_(payload.card_ids))
        )
        cards = cards_result.scalars().all()
        found_ids = {c.id for c in cards}
        missing = [cid for cid in payload.card_ids if cid not in found_ids]
        if missing:
            raise HTTPException(
                status_code=404, detail=f"Card ids not found: {missing}"
            )
        portal.cards = list(cards)
    db.add(portal)
    await db.commit()
    result = await db.execute(
        select(TravelPortal)
        .options(selectinload(TravelPortal.cards))
        .where(TravelPortal.id == portal.id)
    )
    return result.scalar_one()


@router.put(
    "/admin/travel-portals/{portal_id}",
    response_model=TravelPortalRead,
    tags=["admin"],
)
async def admin_update_travel_portal(
    portal_id: int,
    payload: AdminUpdateTravelPortalPayload,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TravelPortal)
        .options(selectinload(TravelPortal.cards))
        .where(TravelPortal.id == portal_id)
    )
    portal = result.scalar_one_or_none()
    if portal is None:
        raise HTTPException(
            status_code=404, detail=f"Travel portal id={portal_id} not found"
        )
    if payload.name is not None:
        new_name = payload.name.strip()
        if new_name != portal.name:
            clash = await db.execute(
                select(TravelPortal).where(TravelPortal.name == new_name)
            )
            if clash.scalar_one_or_none():
                raise HTTPException(
                    status_code=409,
                    detail=f"Travel portal '{new_name}' already exists",
                )
            portal.name = new_name
    if payload.card_ids is not None:
        if payload.card_ids:
            cards_result = await db.execute(
                select(Card).where(Card.id.in_(payload.card_ids))
            )
            cards = cards_result.scalars().all()
            found_ids = {c.id for c in cards}
            missing = [cid for cid in payload.card_ids if cid not in found_ids]
            if missing:
                raise HTTPException(
                    status_code=404, detail=f"Card ids not found: {missing}"
                )
            portal.cards = list(cards)
        else:
            portal.cards = []
    await db.commit()
    refreshed = await db.execute(
        select(TravelPortal)
        .options(selectinload(TravelPortal.cards))
        .where(TravelPortal.id == portal.id)
    )
    return refreshed.scalar_one()


@router.delete(
    "/admin/travel-portals/{portal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["admin"],
)
async def admin_delete_travel_portal(
    portal_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TravelPortal).where(TravelPortal.id == portal_id)
    )
    portal = result.scalar_one_or_none()
    if portal is None:
        raise HTTPException(
            status_code=404, detail=f"Travel portal id={portal_id} not found"
        )
    await db.delete(portal)
    await db.commit()
