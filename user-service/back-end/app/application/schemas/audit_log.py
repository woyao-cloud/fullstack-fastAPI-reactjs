"""审计日志 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    username: str | None
    action: str
    resource: str
    resource_id: str | None
    detail: str | None
    ip_address: str | None
    result: str
    created_at: datetime


class AuditLogListOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    size: int