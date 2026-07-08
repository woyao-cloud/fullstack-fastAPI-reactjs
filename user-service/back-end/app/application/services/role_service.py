"""角色业务服务."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.domain.models.role import Role
from app.repositories.permission_repository import PermissionRepository
from app.repositories.role_repository import RoleRepository


class RoleService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.roles = RoleRepository(db)
        self.permissions = PermissionRepository(db)

    async def list(self) -> list[Role]:
        return await self.roles.list()

    async def get(self, role_id: uuid.UUID) -> Role:
        role = await self.roles.get_by_id(role_id)
        if role is None:
            raise NotFoundError("角色不存在")
        return role

    async def create(self, name: str, code: str, description: str | None = None, permission_ids: list[uuid.UUID] | None = None) -> Role:
        if await self.roles.get_by_code(code) is not None:
            raise ConflictError("角色编码已存在")
        role = Role(name=name, code=code, description=description)
        if permission_ids:
            perms = await self.permissions.get_by_ids(permission_ids)
            role.permissions = perms
        self.db.add(role)
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def update(self, role_id: uuid.UUID, name: str | None = None, code: str | None = None,
                     description: str | None = None, permission_ids: list[uuid.UUID] | None = None,
                     data_scope: str | None = None, status: str | None = None) -> Role:
        role = await self.get(role_id)
        if name is not None:
            role.name = name
        if code is not None:
            if code != role.code and await self.roles.get_by_code(code) is not None:
                raise ConflictError("角色编码已存在")
            role.code = code
        if description is not None:
            role.description = description
        if data_scope is not None:
            role.data_scope = data_scope
        if status is not None:
            role.status = status
        if permission_ids is not None:
            perms = await self.permissions.get_by_ids(permission_ids)
            role.permissions = perms
        await self.db.commit()
        await self.db.refresh(role)
        return role

    async def delete(self, role_id: uuid.UUID) -> None:
        role = await self.get(role_id)
        await self.db.delete(role)
        await self.db.commit()