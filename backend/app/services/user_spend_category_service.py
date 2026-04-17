"""User spend category data access service."""

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import UserSpendCategory, UserSpendCategoryMapping
from .base import BaseService


class UserSpendCategoryService(BaseService[UserSpendCategory]):
    """Service for UserSpendCategory operations."""

    model = UserSpendCategory

    async def list_all(self) -> list[UserSpendCategory]:
        """List all user spend categories ordered by display_order.

        Returns:
            List of user spend categories with mappings eager-loaded.
        """
        result = await self.db.execute(
            select(UserSpendCategory)
            .options(
                selectinload(UserSpendCategory.mappings)
                .selectinload(UserSpendCategoryMapping.earn_category)
            )
            .order_by(UserSpendCategory.display_order)
        )
        return list(result.scalars().all())

    async def list_for_input(self) -> list[UserSpendCategory]:
        """List user spend categories for spend input (excludes system categories).

        Returns:
            List of non-system user spend categories.
        """
        result = await self.db.execute(
            select(UserSpendCategory)
            .options(
                selectinload(UserSpendCategory.mappings)
                .selectinload(UserSpendCategoryMapping.earn_category)
            )
            .where(UserSpendCategory.is_system == False)  # noqa: E712
            .order_by(UserSpendCategory.display_order)
        )
        return list(result.scalars().all())


def get_user_spend_category_service(
    db: AsyncSession = Depends(get_db),
) -> UserSpendCategoryService:
    """FastAPI dependency for UserSpendCategoryService."""
    return UserSpendCategoryService(db)
