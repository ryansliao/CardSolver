"""Issuer endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_db
from ..models import Issuer, IssuerApplicationRule
from ..schemas import IssuerRead, IssuerApplicationRuleRead

router = APIRouter(tags=["issuers"])


@router.get("/issuers", response_model=list[IssuerRead])
async def list_issuers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Issuer).order_by(Issuer.name))
    return result.scalars().all()


@router.get("/issuers/application-rules", response_model=list[IssuerApplicationRuleRead])
async def list_issuer_application_rules(db: AsyncSession = Depends(get_db)):
    """List all known issuer velocity/eligibility rules (e.g. Chase 5/24, Amex 1/90)."""
    result = await db.execute(
        select(IssuerApplicationRule)
        .options(selectinload(IssuerApplicationRule.issuer))
        .order_by(IssuerApplicationRule.issuer_id, IssuerApplicationRule.rule_name)
    )
    return result.scalars().all()
