"""用户服务: CRUD + 角色分配."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.user import UserCreate, UserUpdate
from app.core.exceptions import ConflictError, NotFoundError
from app.core.security import hash_password
from app.domain.models.enums import UserStatus
from app.domain.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)
        self.roles = RoleRepository(db)

    async def create(self, req: UserCreate, actor: User | None = None) -> User:
        if await self.users.get_by_email(req.email) is not None:
            raise ConflictError("邮箱已注册")
        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone,
            department_id=req.department_id,
            status=UserStatus.ACTIVE,
            created_by=actor.id if actor is not None else None,
        )
        await self.users.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get(self, user_id: uuid.UUID) -> User:
        user = await self.users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("用户不存在")
        return user

    async def list(self, page: int = 1, size: int = 20) -> tuple[Sequence[User], int]:
        return await self.users.list(page, size)

    async def update(self, user_id: uuid.UUID, req: UserUpdate) -> User:
        user = await self.get(user_id)
        data = req.model_dump(exclude_unset=True)
        for field, value in data.items():
            setattr(user, field, value)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def delete(self, user_id: uuid.UUID) -> None:
        user = await self.get(user_id)
        await self.users.delete(user)
        await self.db.commit()

    async def assign_role(self, user_id: uuid.UUID, role_id: uuid.UUID) -> User:
        user = await self.get(user_id)
        role = await self.roles.get_by_id(role_id)
        if role is None:
            raise NotFoundError("角色不存在")
        await self.users.assign_role(user, role)
        await self.db.commit()
        await self.db.refresh(user)
        return user