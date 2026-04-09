"""Wallet spend categories (legacy) and spend items (current) endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..constants import ALLOCATION_SUM_TOLERANCE, ALL_OTHER_CATEGORY as ALL_OTHER_SPEND_NAME
from ..database import get_db
from ..db_helpers import ensure_all_other_wallet_spend_category, ensure_all_other_wallet_spend_item
from ..helpers import load_spend_item_opts, wallet_404
from ..models import (
    SpendCategory,
    Wallet,
    WalletSpendCategory,
    WalletSpendCategoryMapping,
    WalletSpendItem,
)
from ..schemas import (
    WalletSpendCategoryCreate,
    WalletSpendCategoryRead,
    WalletSpendCategoryUpdate,
    WalletSpendItemCreate,
    WalletSpendItemRead,
    WalletSpendItemUpdate,
)

router = APIRouter(tags=["wallet-spend"])


# ---------------------------------------------------------------------------
# Legacy wallet spend categories
# ---------------------------------------------------------------------------


@router.get(
    "/wallets/{wallet_id}/spend-categories",
    response_model=list[WalletSpendCategoryRead],
)
async def list_wallet_spend_categories(
    wallet_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List all wallet spend categories with their card category mappings."""
    wallet_result = await db.execute(select(Wallet).where(Wallet.id == wallet_id))
    if not wallet_result.scalar_one_or_none():
        raise wallet_404(wallet_id)
    await ensure_all_other_wallet_spend_category(db, wallet_id)
    await db.commit()
    result = await db.execute(
        select(WalletSpendCategory)
        .options(
            selectinload(WalletSpendCategory.mappings).selectinload(WalletSpendCategoryMapping.spend_category)
        )
        .where(WalletSpendCategory.wallet_id == wallet_id)
        .order_by(WalletSpendCategory.name)
    )
    return result.scalars().all()


@router.post(
    "/wallets/{wallet_id}/spend-categories",
    response_model=WalletSpendCategoryRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_wallet_spend_category(
    wallet_id: int,
    payload: WalletSpendCategoryCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a wallet spend category with optional card category mappings."""
    wallet_result = await db.execute(select(Wallet).where(Wallet.id == wallet_id))
    if not wallet_result.scalar_one_or_none():
        raise wallet_404(wallet_id)

    existing = await db.execute(
        select(WalletSpendCategory).where(
            WalletSpendCategory.wallet_id == wallet_id,
            WalletSpendCategory.name == payload.name.strip(),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Spend category '{payload.name}' already exists")

    if payload.name.strip() == ALL_OTHER_SPEND_NAME:
        raise HTTPException(
            status_code=403,
            detail=f"'{ALL_OTHER_SPEND_NAME}' is a reserved system category",
        )

    wsc = WalletSpendCategory(wallet_id=wallet_id, name=payload.name.strip(), amount=payload.amount)
    db.add(wsc)
    await db.flush()

    for m in payload.mappings:
        sc_result = await db.execute(select(SpendCategory).where(SpendCategory.id == m.spend_category_id))
        if not sc_result.scalar_one_or_none():
            raise HTTPException(status_code=422, detail=f"SpendCategory id={m.spend_category_id} not found")
        db.add(WalletSpendCategoryMapping(
            wallet_spend_category_id=wsc.id,
            spend_category_id=m.spend_category_id,
            allocation=m.allocation,
        ))

    await db.commit()
    result = await db.execute(
        select(WalletSpendCategory)
        .options(selectinload(WalletSpendCategory.mappings).selectinload(WalletSpendCategoryMapping.spend_category))
        .where(WalletSpendCategory.id == wsc.id)
    )
    return result.scalar_one()


@router.put(
    "/wallets/{wallet_id}/spend-categories/{wsc_id}",
    response_model=WalletSpendCategoryRead,
)
async def update_wallet_spend_category(
    wallet_id: int,
    wsc_id: int,
    payload: WalletSpendCategoryUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a wallet spend category's name, amount, or card category mappings."""
    result = await db.execute(
        select(WalletSpendCategory)
        .options(selectinload(WalletSpendCategory.mappings))
        .where(WalletSpendCategory.id == wsc_id, WalletSpendCategory.wallet_id == wallet_id)
    )
    wsc = result.scalar_one_or_none()
    if not wsc:
        raise HTTPException(status_code=404, detail=f"Wallet spend category {wsc_id} not found")

    locked = wsc.name == ALL_OTHER_SPEND_NAME
    if locked:
        if payload.name is not None and payload.name.strip() != ALL_OTHER_SPEND_NAME:
            raise HTTPException(
                status_code=403,
                detail=f"The '{ALL_OTHER_SPEND_NAME}' category cannot be renamed",
            )
        if payload.mappings is not None:
            raise HTTPException(
                status_code=403,
                detail=f"Mappings for '{ALL_OTHER_SPEND_NAME}' cannot be changed",
            )

    if payload.name is not None:
        new_name = payload.name.strip()
        if new_name != wsc.name:
            dup = await db.execute(
                select(WalletSpendCategory).where(
                    WalletSpendCategory.wallet_id == wallet_id,
                    WalletSpendCategory.name == new_name,
                    WalletSpendCategory.id != wsc_id,
                )
            )
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=409, detail=f"Spend category '{new_name}' already exists")
        wsc.name = new_name

    if payload.amount is not None:
        wsc.amount = payload.amount

    if payload.mappings is not None:
        effective_amount = wsc.amount
        total_alloc = sum(m.allocation for m in payload.mappings)
        if payload.mappings and abs(total_alloc - effective_amount) > ALLOCATION_SUM_TOLERANCE:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Mapping allocations must sum to annual amount ${effective_amount:.2f} "
                    f"(got ${total_alloc:.2f})"
                ),
            )
        for m in list(wsc.mappings):
            await db.delete(m)
        await db.flush()
        for m in payload.mappings:
            sc_result = await db.execute(select(SpendCategory).where(SpendCategory.id == m.spend_category_id))
            if not sc_result.scalar_one_or_none():
                raise HTTPException(status_code=422, detail=f"SpendCategory id={m.spend_category_id} not found")
            db.add(WalletSpendCategoryMapping(
                wallet_spend_category_id=wsc.id,
                spend_category_id=m.spend_category_id,
                allocation=m.allocation,
            ))

    await db.commit()
    result = await db.execute(
        select(WalletSpendCategory)
        .options(selectinload(WalletSpendCategory.mappings).selectinload(WalletSpendCategoryMapping.spend_category))
        .where(WalletSpendCategory.id == wsc_id)
    )
    return result.scalar_one()


@router.delete(
    "/wallets/{wallet_id}/spend-categories/{wsc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_wallet_spend_category(
    wallet_id: int,
    wsc_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WalletSpendCategory).where(
            WalletSpendCategory.id == wsc_id,
            WalletSpendCategory.wallet_id == wallet_id,
        )
    )
    wsc = result.scalar_one_or_none()
    if not wsc:
        raise HTTPException(status_code=404, detail=f"Wallet spend category {wsc_id} not found")
    if wsc.name == ALL_OTHER_SPEND_NAME:
        raise HTTPException(
            status_code=403,
            detail=f"The '{ALL_OTHER_SPEND_NAME}' category cannot be deleted",
        )
    await db.delete(wsc)
    await db.commit()


# ---------------------------------------------------------------------------
# Wallet spend items (current system)
# ---------------------------------------------------------------------------


@router.get(
    "/wallets/{wallet_id}/spend-items",
    response_model=list[WalletSpendItemRead],
)
async def list_wallet_spend_items(
    wallet_id: int,
    db: AsyncSession = Depends(get_db),
):
    """List wallet spend items. Auto-creates the 'All Other' item if missing."""
    wallet_result = await db.execute(select(Wallet).where(Wallet.id == wallet_id))
    if not wallet_result.scalar_one_or_none():
        raise wallet_404(wallet_id)
    await ensure_all_other_wallet_spend_item(db, wallet_id)
    await db.commit()
    result = await db.execute(
        select(WalletSpendItem)
        .options(*load_spend_item_opts())
        .where(WalletSpendItem.wallet_id == wallet_id)
        .join(WalletSpendItem.spend_category)
        .order_by(WalletSpendItem.amount.desc(), SpendCategory.category)
    )
    return result.scalars().all()


@router.post(
    "/wallets/{wallet_id}/spend-items",
    response_model=WalletSpendItemRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_wallet_spend_item(
    wallet_id: int,
    payload: WalletSpendItemCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a spend item to a wallet for a given app spend category."""
    wallet_result = await db.execute(select(Wallet).where(Wallet.id == wallet_id))
    if not wallet_result.scalar_one_or_none():
        raise wallet_404(wallet_id)

    sc_result = await db.execute(
        select(SpendCategory).where(SpendCategory.id == payload.spend_category_id)
    )
    sc = sc_result.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=422, detail=f"SpendCategory id={payload.spend_category_id} not found")
    if sc.is_system:
        raise HTTPException(status_code=403, detail=f"'{sc.category}' is a system category; update its amount via PUT instead")

    existing = await db.execute(
        select(WalletSpendItem).where(
            WalletSpendItem.wallet_id == wallet_id,
            WalletSpendItem.spend_category_id == payload.spend_category_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"A spend item for '{sc.category}' already exists in this wallet")

    item = WalletSpendItem(
        wallet_id=wallet_id,
        spend_category_id=payload.spend_category_id,
        amount=payload.amount,
    )
    db.add(item)
    await db.commit()
    result = await db.execute(
        select(WalletSpendItem)
        .options(*load_spend_item_opts())
        .where(WalletSpendItem.id == item.id)
    )
    return result.scalar_one()


@router.put(
    "/wallets/{wallet_id}/spend-items/{item_id}",
    response_model=WalletSpendItemRead,
)
async def update_wallet_spend_item(
    wallet_id: int,
    item_id: int,
    payload: WalletSpendItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update the annual spend amount for a wallet spend item."""
    result = await db.execute(
        select(WalletSpendItem).where(
            WalletSpendItem.id == item_id,
            WalletSpendItem.wallet_id == wallet_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail=f"Spend item {item_id} not found")
    item.amount = payload.amount
    await db.commit()
    result = await db.execute(
        select(WalletSpendItem)
        .options(*load_spend_item_opts())
        .where(WalletSpendItem.id == item_id)
    )
    return result.scalar_one()


@router.delete(
    "/wallets/{wallet_id}/spend-items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_wallet_spend_item(
    wallet_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Remove a spend item from a wallet. The 'All Other' item cannot be deleted."""
    result = await db.execute(
        select(WalletSpendItem)
        .options(selectinload(WalletSpendItem.spend_category))
        .where(WalletSpendItem.id == item_id, WalletSpendItem.wallet_id == wallet_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail=f"Spend item {item_id} not found")
    if item.spend_category and item.spend_category.is_system:
        raise HTTPException(
            status_code=403,
            detail=f"The '{item.spend_category.category}' item cannot be deleted",
        )
    await db.delete(item)
    await db.commit()
