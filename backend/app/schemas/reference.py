"""Issuer / co-brand / network-tier / issuer-rule schemas."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, model_validator


class IssuerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class CoBrandRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class NetworkTierRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    network_id: Optional[int] = None


class IssuerApplicationRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    issuer_id: Optional[int] = None
    issuer_name: Optional[str] = None
    rule_name: str
    description: Optional[str] = None
    max_count: int
    period_days: int
    personal_only: bool
    scope_all_issuers: bool

    @model_validator(mode="wrap")
    @classmethod
    def populate_issuer_name(cls, data: Any, handler: Any) -> Any:
        if not isinstance(data, dict) and "issuer" in getattr(data, "__dict__", {}):
            iss = data.__dict__["issuer"]
            return handler(
                {
                    "id": data.id,
                    "issuer_id": data.issuer_id,
                    "issuer_name": iss.name if iss else None,
                    "rule_name": data.rule_name,
                    "description": data.description,
                    "max_count": data.max_count,
                    "period_days": data.period_days,
                    "personal_only": data.personal_only,
                    "scope_all_issuers": data.scope_all_issuers,
                }
            )
        return handler(data)
