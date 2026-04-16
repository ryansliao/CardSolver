"""Travel portal read + wallet portal share schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TravelPortalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    card_ids: list[int] = []

    @model_validator(mode="wrap")
    @classmethod
    def populate_card_ids(cls, data: Any, handler: Any) -> Any:
        if not isinstance(data, dict):
            cards = getattr(data, "cards", None) or []
            return handler(
                {
                    "id": data.id,
                    "name": data.name,
                    "card_ids": [c.id for c in cards],
                }
            )
        return handler(data)


class WalletPortalSharePayload(BaseModel):
    travel_portal_id: int
    share: float = Field(..., ge=0.0, le=1.0)


class WalletPortalShareRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    wallet_id: int
    travel_portal_id: int
    share: float
    travel_portal_name: str = ""

    @model_validator(mode="wrap")
    @classmethod
    def populate_portal_name(cls, data: Any, handler: Any) -> Any:
        if not isinstance(data, dict):
            portal = getattr(data, "travel_portal", None)
            return handler(
                {
                    "id": data.id,
                    "wallet_id": data.wallet_id,
                    "travel_portal_id": data.travel_portal_id,
                    "share": data.share,
                    "travel_portal_name": portal.name if portal is not None else "",
                }
            )
        return handler(data)
