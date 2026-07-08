"""审计日志路由."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.audit_log import AuditLogListOut, AuditLogOut
from app.application.services.audit_log_service import AuditLogService
from app.core.security import get_current_user, require_permission
from app.domain.models.user import User

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=AuditLogListOut)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user_id: uuid.UUID | None = Query(None),
    action: str | None = Query(None),
    resource: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("audit:read")),
) -> AuditLogListOut:
    svc = AuditLogService(db)
    items, total = await svc.list(page, size, user_id, action, resource, date_from, date_to)
    return AuditLogListOut(
        items=[AuditLogOut.model_validate(i) for i in items],
        total=total, page=page, size=size,
    )


@router.get("/my", response_model=AuditLogListOut)
async def my_audit_logs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AuditLogListOut:
    svc = AuditLogService(db)
    items, total = await svc.list(page, size, user_id=current_user.id, action=action,
                                   date_from=date_from, date_to=date_to)
    return AuditLogListOut(
        items=[AuditLogOut.model_validate(i) for i in items],
        total=total, page=page, size=size,
    )