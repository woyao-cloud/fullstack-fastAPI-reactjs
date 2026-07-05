"""用户数据访问."""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.associations import user_role
from app.domain.models.role import Role
from app.domain.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        stmt = User.with_roles().where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        stmt = User.with_roles().where(User.email == email)
        result = await self.db.execute(stmt)
        return result.unique().scalar_one_or_none()

    async def list(self, page: int = 1, size: int = 20) -> tuple[Sequence[User], int]:
        offset = (page - 1) * size
        total_result = await self.db.execute(select(func.count()).select_from(User))
        total = total_result.scalar_one()
        stmt = User.with_roles().offset(offset).limit(size)
        result = await self.db.execute(stmt)
        return result.unique().scalars().all(), total

    async def add(self, user: User) -> User:
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        await self.db.delete(user)

    async def assign_role(self, user: User, role: Role) -> None:
        if role not in user.roles:
            user.roles.append(role)
            await self.db.flush()

    async def count(self) -> int:
        result = await self.db.execute(select(func.count()).select_from(User))
        return result.scalar_one()


__all__ = ["UserRepository", "user_role", "Role"]