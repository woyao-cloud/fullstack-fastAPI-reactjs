"""邮件模板服务(CRUD,不含发送)."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
from app.core.exceptions import ConflictError, NotFoundError
from app.domain.models.system_config import EmailTemplate
from app.repositories.system_config_repository import EmailTemplateRepository


class EmailTemplateService:
    def __init__(self, db: AsyncSession, repo: EmailTemplateRepository):
        self.db = db
        self.repo = repo

    async def create(self, req: EmailTemplateCreate) -> EmailTemplate:
        if await self.repo.get_by_code(req.template_code) is not None:
            raise ConflictError("模板编码已存在")
        tpl = EmailTemplate(template_code=req.template_code, template_name=req.template_name,
                           subject=req.subject, content=req.content,
                           variables=req.variables, is_active=req.is_active)
        await self.repo.add(tpl)
        await self.db.commit()
        await self.db.refresh(tpl)
        return tpl

    async def update(self, tpl_id: uuid.UUID, req: EmailTemplateUpdate) -> EmailTemplate:
        tpl = await self.repo.get_by_id(tpl_id)
        if tpl is None:
            raise NotFoundError("模板不存在")
        if req.template_code is not None and req.template_code != tpl.template_code:
            if await self.repo.get_by_code(req.template_code) is not None:
                raise ConflictError("模板编码已存在")
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(tpl, field, value)
        await self.db.commit()
        await self.db.refresh(tpl)
        return tpl

    async def get(self, tpl_id: uuid.UUID) -> EmailTemplate:
        tpl = await self.repo.get_by_id(tpl_id)
        if tpl is None:
            raise NotFoundError("模板不存在")
        return tpl

    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
        return await self.repo.list(page, size)

    async def delete(self, tpl_id: uuid.UUID) -> None:
        tpl = await self.repo.get_by_id(tpl_id)
        if tpl is None:
            raise NotFoundError("模板不存在")
        await self.repo.delete(tpl)
        await self.db.commit()

    async def get_by_code(self, code: str) -> EmailTemplate | None:
        return await self.repo.get_by_code(code)