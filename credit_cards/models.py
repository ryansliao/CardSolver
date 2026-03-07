from datetime import date
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Card(Base):
    """Static data for a single credit card."""

    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    issuer: Mapped[str] = mapped_column(String(60), nullable=False)
    # Reward currency (e.g. "Amex MR", "Chase UR", "Citi TY", "Bilt", "Delta", "Hilton")
    currency: Mapped[str] = mapped_column(String(60), nullable=False)
    annual_fee: Mapped[float] = mapped_column(Float, default=0)
    cents_per_point: Mapped[float] = mapped_column(Float, default=1.0)

    # Sign-up bonus
    sub_points: Mapped[int] = mapped_column(Integer, default=0)
    sub_min_spend: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sub_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Points earned just from hitting the SUB spend (e.g. BBP 2x on that spend)
    sub_spend_points: Mapped[int] = mapped_column(Integer, default=0)

    # Recurring annual bonus points (e.g. Chase Ink Preferred 10k points per year)
    annual_bonus_points: Mapped[int] = mapped_column(Integer, default=0)

    # Chase Freedom cards earn more when a CSR/CSP/CIP is also held
    boosted_by_chase_premium: Mapped[bool] = mapped_column(Boolean, default=False)

    # Delta SkyMiles points are worth less when redeemed vs. transferred — track a discount factor
    # For most cards this is 1.0 (no adjustment). For Delta cobrand cards stored as 1/0.85 ≈ 1.1765
    points_adjustment_factor: Mapped[float] = mapped_column(Float, default=1.0)

    multipliers: Mapped[list["CardCategoryMultiplier"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )
    credits: Mapped[list["CardCredit"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )
    scenario_cards: Mapped[list["ScenarioCard"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Card id={self.id} name={self.name!r}>"


class CardCategoryMultiplier(Base):
    """Points multiplier for a card in a specific spend category."""

    __tablename__ = "card_category_multipliers"
    __table_args__ = (UniqueConstraint("card_id", "category"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"))
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    multiplier: Mapped[float] = mapped_column(Float, default=1.0)

    card: Mapped["Card"] = relationship(back_populates="multipliers")


class CardCredit(Base):
    """Monetary credit / perk value offered by a card."""

    __tablename__ = "card_credits"
    __table_args__ = (UniqueConstraint("card_id", "credit_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"))
    credit_name: Mapped[str] = mapped_column(String(120), nullable=False)
    credit_value: Mapped[float] = mapped_column(Float, default=0)

    card: Mapped["Card"] = relationship(back_populates="credits")


class SpendCategory(Base):
    """User's annual spend per category (synced from Google Sheet row 19–35 col E)."""

    __tablename__ = "spend_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    category: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    annual_spend: Mapped[float] = mapped_column(Float, default=0)


class Scenario(Base):
    """
    A named wallet scenario for roadmap modeling.
    Each scenario captures a set of cards that are active during a date range.
    """

    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # The reference date for "today" when evaluating this scenario
    as_of_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    scenario_cards: Mapped[list["ScenarioCard"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Scenario id={self.id} name={self.name!r}>"


class ScenarioCard(Base):
    """
    Maps a card to a scenario with an optional active date window.
    If end_date is None the card is still held.
    years_counted overrides the global setting for this card in this scenario.
    """

    __tablename__ = "scenario_cards"
    __table_args__ = (UniqueConstraint("scenario_id", "card_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scenario_id: Mapped[int] = mapped_column(
        ForeignKey("scenarios.id", ondelete="CASCADE")
    )
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"))
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    # How many years to amortize this card's annual fee / SUB over
    years_counted: Mapped[int] = mapped_column(Integer, default=2)

    scenario: Mapped["Scenario"] = relationship(back_populates="scenario_cards")
    card: Mapped["Card"] = relationship(back_populates="scenario_cards")

    def __repr__(self) -> str:
        return (
            f"<ScenarioCard scenario={self.scenario_id} card={self.card_id} "
            f"start={self.start_date} end={self.end_date}>"
        )
