# app/repositories/system_config_repository.py
"""系统配置、配置历史、邮件模板仓储."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.system_config import ConfigHistory, EmailTemplate, SystemConfig


class SystemConfigRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_key(self, key: str) -> SystemConfig | None:
        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
        return result.scalar_one_or_none()

    async def list_by_group(self, group: str) -> list[SystemConfig]:
        stmt = select(SystemConfig).where(SystemConfig.config_group == group)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
        stmt = select(SystemConfig)
        if group is not None:
            stmt = stmt.where(SystemConfig.config_group == group)
        stmt = stmt.order_by(SystemConfig.config_group, SystemConfig.config_key)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def upsert(self, key: str, value: str, group: str, type_: str,
                     is_encrypted: bool, updated_by: uuid.UUID | None,
                     description: str | None = None) -> SystemConfig:
        existing = await self.get_by_key(key)
        if existing is None:
            row = SystemConfig(config_key=key, config_value=value, config_group=group,
                               config_type=type_, is_encrypted=is_encrypted,
                               updated_by=updated_by, description=description)
            self.db.add(row)
            await self.db.flush()
            return row
        existing.config_value = value
        existing.config_group = group
        existing.config_type = type_
        existing.is_encrypted = is_encrypted
        existing.updated_by = updated_by
        if description is not None:
            existing.description = description
        await self.db.flush()
        return existing


class ConfigHistoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add(self, key: str, old_value: str | None, new_value: str | None,
                  changed_by: uuid.UUID) -> ConfigHistory:
        row = ConfigHistory(config_key=key, old_value=old_value, new_value=new_value,
                            changed_by=changed_by)
        self.db.add(row)
        await self.db.flush()
        return row

    async def list_by_key(self, key: str) -> list[ConfigHistory]:
        result = await self.db.execute(
            select(ConfigHistory).where(ConfigHistory.config_key == key)
            .order_by(ConfigHistory.changed_at.desc())
        )
        return list(result.scalars().all())


class EmailTemplateRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
        return await self.db.get(EmailTemplate, tpl_id)

    async def get_by_code(self, code: str) -> EmailTemplate | None:
        stmt = select(EmailTemplate).where(EmailTemplate.template_code == code)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
        total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
        total = int(total_result.scalar_one())
        result = await self.db.execute(
            select(EmailTemplate).order_by(EmailTemplate.template_code)
            .offset((page - 1) * size).limit(size)
        )
        return list(result.scalars().all()), total

    async def add(self, tpl: EmailTemplate) -> EmailTemplate:
        self.db.add(tpl)
        await self.db.flush()
        return tpl

    async def delete(self, tpl: EmailTemplate) -> None:
        await self.db.delete(tpl)


__all__ = [
    "SystemConfigRepository",
    "ConfigHistoryRepository",
    "EmailTemplateRepository",
]