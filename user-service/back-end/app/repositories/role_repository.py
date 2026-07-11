"""角色数据访问."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.role import Role


class RoleRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, role_id: uuid.UUID) -> Role | None:
        result = await self.db.execute(Role.with_permissions().where(Role.id == role_id))
        return result.unique().scalar_one_or_none()

    async def get_by_code(self, code: str) -> Role | None:
        result = await self.db.execute(Role.with_permissions().where(Role.code == code))
        return result.unique().scalar_one_or_none()

    async def list(self) -> list[Role]:
        result = await self.db.execute(Role.with_permissions())
        return list(result.unique().scalars().all())