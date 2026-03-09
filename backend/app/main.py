"""
FastAPI application entry point.

Endpoints
---------
GET  /cards                         List all cards
GET  /cards/{id}                    Get one card
PATCH /cards/{id}                   Update card static data

GET  /spend                         Get spend categories
PUT  /spend/{category}              Update a spend category

POST /calculate                     Run wallet calculation directly

GET  /scenarios                     List scenarios
POST /scenarios                     Create a scenario
GET  /scenarios/{id}                Get one scenario
PATCH /scenarios/{id}               Update scenario metadata
DELETE /scenarios/{id}              Delete scenario
POST /scenarios/{id}/cards          Add a card to a scenario
DELETE /scenarios/{id}/cards/{cid}  Remove a card from a scenario
GET  /scenarios/{id}/results        Compute wallet for a scenario
"""

from __future__ import annotations

import contextlib
import os
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .calculator import compute_wallet
from .database import create_tables, get_db
from .db_helpers import load_card_data, load_spend
from .models import Card, ScenarioCard
from .models import Scenario, SpendCategory
from .schemas import (
    CalculateRequest,
    CardRead,
    CardResultSchema,
    CardUpdate,
    ScenarioCardCreate,
    ScenarioCardRead,
    ScenarioCreate,
    ScenarioRead,
    ScenarioResultSchema,
    ScenarioUpdate,
    SpendCategoryRead,
    SpendCategoryUpdate,
    WalletResultSchema,
)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield


app = FastAPI(
    title="Credit Card Optimizer API",
    description="Credit card wallet optimizer — calculates EV for any combination of cards.",
    version="2.0.0",
    lifespan=lifespan,
)

_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helper: card not found
# ---------------------------------------------------------------------------


def _card_404(card_id: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Card {card_id} not found")


def _scenario_404(scenario_id: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Scenario {scenario_id} not found")


# ---------------------------------------------------------------------------
# Cards
# ---------------------------------------------------------------------------


@app.get("/cards", response_model=list[CardRead], tags=["cards"])
async def list_cards(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Card).options(
            selectinload(Card.multipliers),
            selectinload(Card.credits),
        )
    )
    return result.scalars().all()


@app.get("/cards/{card_id}", response_model=CardRead, tags=["cards"])
async def get_card(card_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Card)
        .options(selectinload(Card.multipliers), selectinload(Card.credits))
        .where(Card.id == card_id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise _card_404(card_id)
    return card


@app.patch("/cards/{card_id}", response_model=CardRead, tags=["cards"])
async def update_card(
    card_id: int, payload: CardUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Card)
        .options(selectinload(Card.multipliers), selectinload(Card.credits))
        .where(Card.id == card_id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise _card_404(card_id)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(card, field, value)

    await db.commit()
    await db.refresh(card)
    return card


# ---------------------------------------------------------------------------
# Spend categories
# ---------------------------------------------------------------------------


@app.get("/spend", response_model=list[SpendCategoryRead], tags=["spend"])
async def list_spend(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpendCategory))
    return result.scalars().all()


@app.put("/spend/{category}", response_model=SpendCategoryRead, tags=["spend"])
async def update_spend(
    category: str, payload: SpendCategoryUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SpendCategory).where(SpendCategory.category == category)
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(status_code=404, detail=f"Category '{category}' not found")
    sc.annual_spend = payload.annual_spend
    await db.commit()
    await db.refresh(sc)
    return sc


# ---------------------------------------------------------------------------
# Direct calculation (no Google Sheets)
# ---------------------------------------------------------------------------


@app.post("/calculate", response_model=WalletResultSchema, tags=["calculate"])
async def calculate(
    payload: CalculateRequest, db: AsyncSession = Depends(get_db)
):
    """
    Run the wallet calculation engine directly.
    Pass selected_card_ids, years_counted, and optional spend_overrides.
    """
    all_cards = await load_card_data(db)
    spend = await load_spend(db, overrides=payload.spend_overrides)
    wallet = compute_wallet(
        all_cards=all_cards,
        selected_ids=set(payload.selected_card_ids),
        spend=spend,
        years=payload.years_counted,
    )
    return _wallet_to_schema(wallet)


# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------


@app.get("/scenarios", response_model=list[ScenarioRead], tags=["scenarios"])
async def list_scenarios(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scenario).options(selectinload(Scenario.scenario_cards))
    )
    return result.scalars().all()


@app.post(
    "/scenarios",
    response_model=ScenarioRead,
    status_code=status.HTTP_201_CREATED,
    tags=["scenarios"],
)
async def create_scenario(payload: ScenarioCreate, db: AsyncSession = Depends(get_db)):
    scenario = Scenario(
        name=payload.name,
        description=payload.description,
        as_of_date=payload.as_of_date,
    )
    db.add(scenario)
    await db.flush()

    for sc in payload.cards:
        # Validate card exists
        card_result = await db.execute(select(Card).where(Card.id == sc.card_id))
        if not card_result.scalar_one_or_none():
            raise HTTPException(
                status_code=422, detail=f"Card id={sc.card_id} not found"
            )
        db.add(
            ScenarioCard(
                scenario_id=scenario.id,
                card_id=sc.card_id,
                start_date=sc.start_date,
                end_date=sc.end_date,
                years_counted=sc.years_counted,
            )
        )

    await db.commit()
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.scenario_cards))
        .where(Scenario.id == scenario.id)
    )
    return result.scalar_one()


@app.get("/scenarios/{scenario_id}", response_model=ScenarioRead, tags=["scenarios"])
async def get_scenario(scenario_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.scenario_cards))
        .where(Scenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise _scenario_404(scenario_id)
    return scenario


@app.patch(
    "/scenarios/{scenario_id}", response_model=ScenarioRead, tags=["scenarios"]
)
async def update_scenario(
    scenario_id: int, payload: ScenarioUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.scenario_cards))
        .where(Scenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise _scenario_404(scenario_id)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(scenario, field, value)

    await db.commit()
    await db.refresh(scenario)
    return scenario


@app.delete(
    "/scenarios/{scenario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["scenarios"],
)
async def delete_scenario(scenario_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Scenario).where(Scenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise _scenario_404(scenario_id)
    await db.delete(scenario)
    await db.commit()


@app.post(
    "/scenarios/{scenario_id}/cards",
    response_model=ScenarioCardRead,
    status_code=status.HTTP_201_CREATED,
    tags=["scenarios"],
)
async def add_card_to_scenario(
    scenario_id: int,
    payload: ScenarioCardCreate,
    db: AsyncSession = Depends(get_db),
):
    # Validate scenario
    sc_result = await db.execute(
        select(Scenario).where(Scenario.id == scenario_id)
    )
    if not sc_result.scalar_one_or_none():
        raise _scenario_404(scenario_id)

    # Validate card
    card_result = await db.execute(select(Card).where(Card.id == payload.card_id))
    card = card_result.scalar_one_or_none()
    if not card:
        raise _card_404(payload.card_id)

    sc = ScenarioCard(
        scenario_id=scenario_id,
        card_id=payload.card_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        years_counted=payload.years_counted,
    )
    db.add(sc)
    await db.commit()
    await db.refresh(sc)

    read = ScenarioCardRead.model_validate(sc)
    read.card_name = card.name
    return read


@app.delete(
    "/scenarios/{scenario_id}/cards/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["scenarios"],
)
async def remove_card_from_scenario(
    scenario_id: int, card_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ScenarioCard).where(
            ScenarioCard.scenario_id == scenario_id,
            ScenarioCard.card_id == card_id,
        )
    )
    sc = result.scalar_one_or_none()
    if not sc:
        raise HTTPException(
            status_code=404,
            detail=f"Card {card_id} not in scenario {scenario_id}",
        )
    await db.delete(sc)
    await db.commit()


@app.get(
    "/scenarios/{scenario_id}/results",
    response_model=ScenarioResultSchema,
    tags=["scenarios"],
)
async def scenario_results(
    scenario_id: int,
    reference_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Compute wallet EV for a scenario.

    Cards are considered active if:
      - start_date is None OR start_date <= reference_date
      - end_date is None OR end_date > reference_date

    reference_date defaults to scenario.as_of_date, then today.
    years_counted comes from the ScenarioCard entry (overrides global default).
    """
    result = await db.execute(
        select(Scenario)
        .options(selectinload(Scenario.scenario_cards))
        .where(Scenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise _scenario_404(scenario_id)

    ref_date = reference_date or scenario.as_of_date or date.today()

    # Determine which cards are active and what years_counted to use
    active_years: dict[int, int] = {}
    for sc in scenario.scenario_cards:
        start_ok = sc.start_date is None or sc.start_date <= ref_date
        end_ok = sc.end_date is None or sc.end_date > ref_date
        if start_ok and end_ok:
            active_years[sc.card_id] = sc.years_counted

    if not active_years:
        # Return empty wallet result
        return ScenarioResultSchema(
            scenario_id=scenario_id,
            scenario_name=scenario.name,
            as_of_date=ref_date,
            wallet=WalletResultSchema(
                years_counted=2,
                total_annual_ev=0,
                total_points_earned=0,
                total_annual_pts=0,
            ),
        )

    # Use the most common years_counted among active cards (simple majority)
    years_counted = max(set(active_years.values()), key=list(active_years.values()).count)

    all_cards = await load_card_data(db)
    spend = await load_spend(db)

    wallet = compute_wallet(
        all_cards=all_cards,
        selected_ids=set(active_years.keys()),
        spend=spend,
        years=years_counted,
    )

    return ScenarioResultSchema(
        scenario_id=scenario_id,
        scenario_name=scenario.name,
        as_of_date=ref_date,
        wallet=_wallet_to_schema(wallet),
    )


# ---------------------------------------------------------------------------
# Schema conversion helper
# ---------------------------------------------------------------------------


def _wallet_to_schema(wallet) -> WalletResultSchema:
    from .calculator import WalletResult

    card_schemas = [
        CardResultSchema(
            card_id=cr.card_id,
            card_name=cr.card_name,
            selected=cr.selected,
            annual_ev=cr.annual_ev,
            second_year_ev=cr.second_year_ev,
            total_points=cr.total_points,
            annual_point_earn=cr.annual_point_earn,
            credit_valuation=cr.credit_valuation,
            annual_fee=cr.annual_fee,
            sub_points=cr.sub_points,
            annual_bonus_points=cr.annual_bonus_points,
            sub_extra_spend=cr.sub_extra_spend,
            sub_spend_points=cr.sub_spend_points,
            sub_opportunity_cost=cr.sub_opportunity_cost,
            opp_cost_abs=cr.opp_cost_abs,
            avg_spend_multiplier=cr.avg_spend_multiplier,
            cents_per_point=cr.cents_per_point,
        )
        for cr in wallet.card_results
    ]

    return WalletResultSchema(
        years_counted=wallet.years_counted,
        total_annual_ev=wallet.total_annual_ev,
        total_points_earned=wallet.total_points_earned,
        total_annual_pts=wallet.total_annual_pts,
        amex_mr_pts=wallet.amex_mr_pts,
        chase_ur_pts=wallet.chase_ur_pts,
        capital_one_pts=wallet.capital_one_pts,
        citi_ty_pts=wallet.citi_ty_pts,
        bilt_pts=wallet.bilt_pts,
        delta_pts=wallet.delta_pts,
        hilton_pts=wallet.hilton_pts,
        card_results=card_schemas,
    )


# ---------------------------------------------------------------------------
# Serve React SPA (must come last — catches all unmatched routes)
# ---------------------------------------------------------------------------

_FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

if _FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=_FRONTEND_DIST / "assets"), name="assets")


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    index = _FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Frontend not built. Run: cd frontend && npm run build")
