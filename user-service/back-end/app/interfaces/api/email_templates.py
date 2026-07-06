"""邮件模板路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.system_config import (
    EmailTemplateCreate, EmailTemplateListOut, EmailTemplateOut, EmailTemplateUpdate,
)
from app.application.services.email_template_service import EmailTemplateService
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.system_config_repository import EmailTemplateRepository

router = APIRouter(prefix="/email-templates", tags=["email-templates"])


def _svc(db: AsyncSession) -> EmailTemplateService:
    return EmailTemplateService(db, EmailTemplateRepository(db))


@router.get("", response_model=EmailTemplateListOut)
async def list_templates(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:read")),
) -> EmailTemplateListOut:
    items, total = await _svc(db).list(page, size)
    return EmailTemplateListOut(
        items=[EmailTemplateOut.model_validate(i) for i in items],
        total=total, page=page, size=size)


@router.get("/{tpl_id}", response_model=EmailTemplateOut)
async def get_template(
    tpl_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:read")),
) -> EmailTemplateOut:
    return EmailTemplateOut.model_validate(await _svc(db).get(tpl_id))


@router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    req: EmailTemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:create")),
) -> EmailTemplateOut:
    return EmailTemplateOut.model_validate(await _svc(db).create(req))


@router.put("/{tpl_id}", response_model=EmailTemplateOut)
async def update_template(
    tpl_id: uuid.UUID, req: EmailTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:update")),
) -> EmailTemplateOut:
    return EmailTemplateOut.model_validate(await _svc(db).update(tpl_id, req))


@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    tpl_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:delete")),
) -> None:
    await _svc(db).delete(tpl_id)