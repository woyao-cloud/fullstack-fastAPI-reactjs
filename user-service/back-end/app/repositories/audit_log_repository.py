"""审计日志数据访问."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.audit_log import AuditLog


class AuditLogRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add(self, log: AuditLog) -> AuditLog:
        self.db.add(log)
        await self.db.flush()
        return log

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
        stmt = select(AuditLog)
        if user_id is not None:
            stmt = stmt.where(AuditLog.user_id == user_id)
        if action is not None:
            stmt = stmt.where(AuditLog.action == action)
        if resource is not None:
            stmt = stmt.where(AuditLog.resource == resource)
        if date_from is not None:
            stmt = stmt.where(AuditLog.created_at >= date_from)
        if date_to is not None:
            stmt = stmt.where(AuditLog.created_at <= date_to)
        stmt = stmt.order_by(AuditLog.created_at.desc())
        total_result = await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        total = total_result.scalar_one()
        offset = (page - 1) * size
        result = await self.db.execute(stmt.offset(offset).limit(size))
        return list(result.unique().scalars().all()), total