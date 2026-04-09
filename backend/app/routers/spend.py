"""Spend category endpoints (reference data)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import SpendCategory
from ..schemas import SpendCategoryRead

router = APIRouter(tags=["spend"])


@router.get("/spend", response_model=list[SpendCategoryRead])
async def list_spend(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpendCategory).order_by(SpendCategory.category))
    return result.scalars().all()


@router.get("/app-spend-categories", response_model=list[SpendCategoryRead])
async def list_app_spend_categories(db: AsyncSession = Depends(get_db)):
    """Return top-level spend categories with their children nested (excludes system catch-all)."""
    result = await db.execute(
        select(SpendCategory)
        .options(
            selectinload(SpendCategory.children).selectinload(SpendCategory.children),
        )
        .where(SpendCategory.parent_id == None, SpendCategory.is_system == False)  # noqa: E711,E712
        .order_by(SpendCategory.category)
    )
    return result.scalars().all()
