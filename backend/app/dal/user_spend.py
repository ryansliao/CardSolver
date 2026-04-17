from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import Base

if TYPE_CHECKING:
    from .reference import SpendCategory
    from .wallet_spend import WalletSpendItem


class UserSpendCategory(Base):
    """
    Simplified user-facing spend categories (15 categories).
    Users enter their annual spend in these intuitive buckets.
    The system distributes to granular earn categories via UserSpendCategoryMapping.
    """

    __tablename__ = "user_spend_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    mappings: Mapped[list["UserSpendCategoryMapping"]] = relationship(
        back_populates="user_category", cascade="all, delete-orphan"
    )
    wallet_spend_items: Mapped[list["WalletSpendItem"]] = relationship(
        back_populates="user_spend_category"
    )

    def __repr__(self) -> str:
        return f"<UserSpendCategory {self.id}: {self.name}>"


class UserSpendCategoryMapping(Base):
    """
    Maps user-facing spend categories to granular earn categories.
    default_weight determines the distribution ratio when a user category
    maps to multiple earn categories (weights are normalized at query time).
    """

    __tablename__ = "user_spend_category_mappings"
    __table_args__ = (UniqueConstraint("user_category_id", "earn_category_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_category_id: Mapped[int] = mapped_column(
        ForeignKey("user_spend_categories.id", ondelete="CASCADE"), nullable=False
    )
    earn_category_id: Mapped[int] = mapped_column(
        ForeignKey("spend_categories.id", ondelete="NO ACTION"), nullable=False
    )
    default_weight: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user_category: Mapped["UserSpendCategory"] = relationship(back_populates="mappings")
    earn_category: Mapped["SpendCategory"] = relationship()

    def __repr__(self) -> str:
        return f"<UserSpendCategoryMapping {self.user_category_id} -> {self.earn_category_id} ({self.default_weight})>"
