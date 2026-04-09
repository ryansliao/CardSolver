"""Wallet card rotation override endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import SpendCategory, WalletCard, WalletCardRotationOverride
from ..schemas import WalletRotationOverridePayload, WalletRotationOverrideRead

router = APIRouter()


@router.get(
    "/wallets/{wallet_id}/cards/{card_id}/rotation-overrides",
    response_model=list[WalletRotationOverrideRead],
)
async def list_wallet_card_rotation_overrides(
    wallet_id: int,
    card_id: int,
    db: AsyncSession = Depends(get_db),
):
    wc = await db.execute(
        select(WalletCard).where(
            WalletCard.wallet_id == wallet_id,
            WalletCard.card_id == card_id,
        )
    )
    wc_row = wc.scalar_one_or_none()
    if not wc_row:
        raise HTTPException(status_code=404, detail="Wallet card not found")
    result = await db.execute(
        select(WalletCardRotationOverride)
        .options(selectinload(WalletCardRotationOverride.spend_category))
        .where(WalletCardRotationOverride.wallet_card_id == wc_row.id)
        .order_by(
            WalletCardRotationOverride.year.desc(),
            WalletCardRotationOverride.quarter.desc(),
        )
    )
    return result.scalars().all()


@router.post(
    "/wallets/{wallet_id}/cards/{card_id}/rotation-overrides",
    response_model=WalletRotationOverrideRead,
    status_code=status.HTTP_201_CREATED,
)
async def add_wallet_card_rotation_override(
    wallet_id: int,
    card_id: int,
    payload: WalletRotationOverridePayload,
    db: AsyncSession = Depends(get_db),
):
    wc = await db.execute(
        select(WalletCard).where(
            WalletCard.wallet_id == wallet_id,
            WalletCard.card_id == card_id,
        )
    )
    wc_row = wc.scalar_one_or_none()
    if not wc_row:
        raise HTTPException(status_code=404, detail="Wallet card not found")
    sc = await db.execute(
        select(SpendCategory).where(SpendCategory.id == payload.spend_category_id)
    )
    if not sc.scalar_one_or_none():
        raise HTTPException(
            status_code=404,
            detail=f"SpendCategory id={payload.spend_category_id} not found",
        )
    existing = await db.execute(
        select(WalletCardRotationOverride).where(
            WalletCardRotationOverride.wallet_card_id == wc_row.id,
            WalletCardRotationOverride.year == payload.year,
            WalletCardRotationOverride.quarter == payload.quarter,
            WalletCardRotationOverride.spend_category_id == payload.spend_category_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Rotation override already exists for {payload.year}Q{payload.quarter}",
        )
    row = WalletCardRotationOverride(
        wallet_card_id=wc_row.id,
        year=payload.year,
        quarter=payload.quarter,
        spend_category_id=payload.spend_category_id,
    )
    db.add(row)
    await db.commit()
    result = await db.execute(
        select(WalletCardRotationOverride)
        .options(selectinload(WalletCardRotationOverride.spend_category))
        .where(WalletCardRotationOverride.id == row.id)
    )
    return result.scalar_one()


@router.delete(
    "/wallets/{wallet_id}/cards/{card_id}/rotation-overrides/{override_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_wallet_card_rotation_override(
    wallet_id: int,
    card_id: int,
    override_id: int,
    db: AsyncSession = Depends(get_db),
):
    wc = await db.execute(
        select(WalletCard).where(
            WalletCard.wallet_id == wallet_id,
            WalletCard.card_id == card_id,
        )
    )
    wc_row = wc.scalar_one_or_none()
    if not wc_row:
        raise HTTPException(status_code=404, detail="Wallet card not found")
    result = await db.execute(
        select(WalletCardRotationOverride).where(
            WalletCardRotationOverride.id == override_id,
            WalletCardRotationOverride.wallet_card_id == wc_row.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Rotation override not found")
    await db.delete(row)
    await db.commit()
