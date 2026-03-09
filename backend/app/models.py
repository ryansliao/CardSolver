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


class Issuer(Base):
    """A credit card issuer (e.g. Chase, American Express, Citi)."""

    __tablename__ = "issuers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)

    currencies: Mapped[list["Currency"]] = relationship(
        back_populates="issuer", cascade="all, delete-orphan"
    )
    ecosystem_boosts: Mapped[list["EcosystemBoost"]] = relationship(
        back_populates="issuer", cascade="all, delete-orphan"
    )
    cards: Mapped[list["Card"]] = relationship(back_populates="issuer")

    def __repr__(self) -> str:
        return f"<Issuer id={self.id} name={self.name!r}>"


class Currency(Base):
    """
    A reward currency tied to an issuer.

    Cashback variants (is_cashback=True) represent earnings on cards that have
    no premium anchor in the wallet — e.g. 'Chase UR Cash' for Freedom Unlimited
    held alone.  When the ecosystem boost activates, the card's effective currency
    switches to the non-cashback transferable variant (e.g. 'Chase UR').
    """

    __tablename__ = "currencies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issuer_id: Mapped[int] = mapped_column(
        ForeignKey("issuers.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    cents_per_point: Mapped[float] = mapped_column(Float, default=1.0)
    # True for cash-back earnings (no transfer partners); False for point currencies
    is_cashback: Mapped[bool] = mapped_column(Boolean, default=False)
    # True when points can be transferred to airline/hotel partners
    is_transferable: Mapped[bool] = mapped_column(Boolean, default=True)
    # Normalization factor for wallet comparison: 1.0 for most currencies.
    # Set < 1.0 for currencies whose redemption value is structurally discounted
    # relative to transferable points (e.g. 0.85 for Delta SkyMiles).
    comparison_factor: Mapped[float] = mapped_column(Float, default=1.0)

    issuer: Mapped["Issuer"] = relationship(back_populates="currencies")
    cards: Mapped[list["Card"]] = relationship(
        back_populates="currency_obj",
        foreign_keys="Card.currency_id",
    )
    boosted_by: Mapped[list["EcosystemBoost"]] = relationship(
        back_populates="boosted_currency",
        foreign_keys="EcosystemBoost.boosted_currency_id",
    )

    def __repr__(self) -> str:
        return f"<Currency id={self.id} name={self.name!r}>"


class EcosystemBoost(Base):
    """
    Issuer-level wallet upgrade: when at least one anchor card is held, every
    beneficiary card switches its effective currency from its default (cashback)
    currency to boosted_currency — a transferable point currency of the same issuer.

    Examples
    --------
    - Chase UR Upgrade: anchors = CSR / CSP / CIP,
        beneficiaries = Freedom Unlimited / Freedom Flex,
        boosted_currency = 'Chase UR' (cpp=1.5, is_transferable=True)
    - Citi TY Upgrade: anchors = Strata Elite,
        beneficiaries = Strata Premier / Custom Cash / Double Cash,
        boosted_currency = 'Citi TY' (cpp=1.5, is_transferable=True)
    """

    __tablename__ = "ecosystem_boosts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issuer_id: Mapped[int] = mapped_column(
        ForeignKey("issuers.id", ondelete="CASCADE"), nullable=False
    )
    # The currency cards switch TO when this boost is active
    boosted_currency_id: Mapped[int] = mapped_column(
        ForeignKey("currencies.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    issuer: Mapped["Issuer"] = relationship(back_populates="ecosystem_boosts")
    boosted_currency: Mapped["Currency"] = relationship(
        back_populates="boosted_by",
        foreign_keys=[boosted_currency_id],
    )
    anchors: Mapped[list["EcosystemBoostAnchor"]] = relationship(
        back_populates="boost", cascade="all, delete-orphan"
    )
    beneficiary_cards: Mapped[list["Card"]] = relationship(
        back_populates="ecosystem_boost",
        foreign_keys="Card.ecosystem_boost_id",
    )

    def __repr__(self) -> str:
        return f"<EcosystemBoost id={self.id} name={self.name!r}>"


class EcosystemBoostAnchor(Base):
    """A card that, when present in the wallet, activates an EcosystemBoost."""

    __tablename__ = "ecosystem_boost_anchors"
    __table_args__ = (UniqueConstraint("boost_id", "card_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    boost_id: Mapped[int] = mapped_column(
        ForeignKey("ecosystem_boosts.id", ondelete="CASCADE"), nullable=False
    )
    card_id: Mapped[int] = mapped_column(
        ForeignKey("cards.id", ondelete="CASCADE"), nullable=False
    )

    boost: Mapped["EcosystemBoost"] = relationship(back_populates="anchors")
    card: Mapped["Card"] = relationship(back_populates="anchor_for_boosts")

    def __repr__(self) -> str:
        return f"<EcosystemBoostAnchor boost={self.boost_id} card={self.card_id}>"


class Card(Base):
    """Static data for a single credit card."""

    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    issuer_id: Mapped[int] = mapped_column(
        ForeignKey("issuers.id", ondelete="RESTRICT"), nullable=False
    )
    # Default currency for this card (may be a cashback currency)
    currency_id: Mapped[int] = mapped_column(
        ForeignKey("currencies.id", ondelete="RESTRICT"), nullable=False
    )
    # If set, this card benefits from the referenced ecosystem boost (its
    # effective currency switches to boost.boosted_currency when the boost fires)
    ecosystem_boost_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ecosystem_boosts.id", ondelete="SET NULL"), nullable=True
    )

    annual_fee: Mapped[float] = mapped_column(Float, default=0)

    # Sign-up bonus
    sub_points: Mapped[int] = mapped_column(Integer, default=0)
    sub_min_spend: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sub_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Points earned just from hitting the SUB spend (e.g. BBP 2x on that spend)
    sub_spend_points: Mapped[int] = mapped_column(Integer, default=0)

    # Recurring annual bonus points (e.g. Chase Ink Preferred 10k points/year)
    annual_bonus_points: Mapped[int] = mapped_column(Integer, default=0)

    issuer: Mapped["Issuer"] = relationship(
        back_populates="cards", foreign_keys=[issuer_id]
    )
    currency_obj: Mapped["Currency"] = relationship(
        back_populates="cards", foreign_keys=[currency_id]
    )
    ecosystem_boost: Mapped[Optional["EcosystemBoost"]] = relationship(
        back_populates="beneficiary_cards", foreign_keys=[ecosystem_boost_id]
    )
    # Boosts this card activates as an anchor card
    anchor_for_boosts: Mapped[list["EcosystemBoostAnchor"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )

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
    """User's annual spend per category."""

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
    years_counted: Mapped[int] = mapped_column(Integer, default=2)

    scenario: Mapped["Scenario"] = relationship(back_populates="scenario_cards")
    card: Mapped["Card"] = relationship(back_populates="scenario_cards")

    def __repr__(self) -> str:
        return (
            f"<ScenarioCard scenario={self.scenario_id} card={self.card_id} "
            f"start={self.start_date} end={self.end_date}>"
        )
