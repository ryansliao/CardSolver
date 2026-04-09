"""Wallet card multiplier override endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..helpers import card_404, wallet_404
from ..models import Card, SpendCategory, Wallet, WalletCardMultiplier
from ..schemas import WalletCardMultiplierRead, WalletCardMultiplierUpsert

router = APIRouter(tags=["wallet-multipliers"])


@router.get(
    "/wallets/{wallet_id}/card-multipliers",
    response_model=list[WalletCardMultiplierRead],
)
async def list_wallet_card_multipliers(
    wallet_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List all wallet-level multiplier overrides."""
    w_result = await db.execute(select(Wallet).where(Wallet.id == wallet_id))
    if not w_result.scalar_one_or_none():
        raise wallet_404(wallet_id)

    result = await db.execute(
        select(WalletCardMultiplier)
        .options(selectinload(WalletCardMultiplier.spend_category))
        .where(WalletCardMultiplier.wallet_id == wallet_id)
        .order_by(WalletCardMultiplier.card_id, WalletCardMultiplier.category_id)
    )
    return list(result.scalars().all())


@router.put(
    "/wallets/{wallet_id}/cards/{card_id}/multipliers/{category_id}",
    response_model=WalletCardMultiplierRead,
)
async def upsert_wallet_card_multiplier(
    wallet_id: int,
    card_id: int,
    category_id: int,
    payload: WalletCardMultiplierUpsert,
    db: AsyncSession = Depends(get_db),
):
    """Set or update a multiplier override for a card/category in this wallet."""
    w_result = await db.execute(select(Wallet).where(Wallet.id == wallet_id))
    if not w_result.scalar_one_or_none():
        raise wallet_404(wallet_id)
    card_result = await db.execute(select(Card).where(Card.id == card_id))
    if not card_result.scalar_one_or_none():
        raise card_404(card_id)
    sc_result = await db.execute(select(SpendCategory).where(SpendCategory.id == category_id))
    if not sc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail=f"SpendCategory id={category_id} not found")

    existing = await db.execute(
        select(WalletCardMultiplier).where(
            WalletCardMultiplier.wallet_id == wallet_id,
            WalletCardMultiplier.card_id == card_id,
            WalletCardMultiplier.category_id == category_id,
        )
    )
    row = existing.scalar_one_or_none()
    if row:
        row.multiplier = payload.multiplier
    else:
        row = WalletCardMultiplier(
            wallet_id=wallet_id,
            card_id=card_id,
            category_id=category_id,
            multiplier=payload.multiplier,
        )
        db.add(row)
    await db.commit()
    await db.refresh(row)
    res = await db.execute(
        select(WalletCardMultiplier)
        .options(selectinload(WalletCardMultiplier.spend_category))
        .where(WalletCardMultiplier.id == row.id)
    )
    return res.scalar_one()


@router.delete(
    "/wallets/{wallet_id}/cards/{card_id}/multipliers/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_wallet_card_multiplier(
    wallet_id: int,
    card_id: int,
    category_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Remove a multiplier override (reverts to library value)."""
    result = await db.execute(
        select(WalletCardMultiplier).where(
            WalletCardMultiplier.wallet_id == wallet_id,
            WalletCardMultiplier.card_id == card_id,
            WalletCardMultiplier.category_id == category_id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="No multiplier override found")
    await db.delete(row)
    await db.commit()
