"""Currency endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Currency
from ..schemas import CurrencyRead

router = APIRouter(tags=["currencies"])


@router.get("/currencies", response_model=list[CurrencyRead])
async def list_currencies(db: AsyncSession = Depends(get_db)):
    """List all currencies."""
    result = await db.execute(
        select(Currency)
        .options(
            selectinload(Currency.converts_to_currency),
        )
        .order_by(Currency.name)
    )
    return result.scalars().all()
