"""SpendCategory hierarchy + WalletSpendItem schemas."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SpendCategoryRead(BaseModel):
    """SpendCategory with optional children for hierarchical display."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    category: str
    parent_id: Optional[int] = None
    is_system: bool = False
    is_housing: bool = False
    is_foreign_eligible: bool = False
    children: list["SpendCategoryRead"] = []

    @model_validator(mode="wrap")
    @classmethod
    def populate_children(cls, data: Any, handler: Any) -> Any:
        if not isinstance(data, dict):
            children = getattr(data, "children", []) or []
            return handler(
                {
                    "id": data.id,
                    "category": data.category,
                    "parent_id": data.parent_id,
                    "is_housing": getattr(data, "is_housing", False),
                    "is_foreign_eligible": getattr(data, "is_foreign_eligible", False),
                    "is_system": data.is_system,
                    "children": children,
                }
            )
        return handler(data)


SpendCategoryRead.model_rebuild()


class WalletSpendItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    wallet_id: int
    spend_category_id: int
    amount: float
    spend_category: SpendCategoryRead


class WalletSpendItemCreate(BaseModel):
    spend_category_id: int
    amount: float = Field(default=0.0, ge=0.0)


class WalletSpendItemUpdate(BaseModel):
    amount: float = Field(..., ge=0.0)
