"""审计日志服务."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.audit_log import AuditLog
from app.repositories.audit_log_repository import AuditLogRepository


class AuditLogService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AuditLogRepository(db)

    async def list(
        self,
        page: int = 1,
        size: int = 20,
        user_id: uuid.UUID | None = None,
        action: str | None = None,
        resource: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> tuple[Sequence[AuditLog], int]:
        return await self.repo.list(page, size, user_id, action, resource, date_from, date_to)

    async def log(
        self,
        user_id: uuid.UUID | None,
        username: str | None,
        action: str,
        resource: str,
        resource_id: str | None = None,
        detail: str | None = None,
        ip_address: str | None = None,
        result: str = "SUCCESS",
    ) -> AuditLog:
        log = AuditLog(
            user_id=user_id,
            username=username,
            action=action,
            resource=resource,
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
            result=result,
        )
        return await self.repo.add(log)