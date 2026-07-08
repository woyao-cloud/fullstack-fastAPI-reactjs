"""权限数据访问."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.role import Permission


class PermissionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self) -> list[Permission]:
        result = await self.db.execute(select(Permission))
        return list(result.unique().scalars().all())

    async def get_by_id(self, perm_id: uuid.UUID) -> Permission | None:
        result = await self.db.execute(select(Permission).where(Permission.id == perm_id))
        return result.unique().scalar_one_or_none()

    async def get_by_ids(self, perm_ids: list[uuid.UUID]) -> list[Permission]:
        result = await self.db.execute(select(Permission).where(Permission.id.in_(perm_ids)))
        return list(result.unique().scalars().all())