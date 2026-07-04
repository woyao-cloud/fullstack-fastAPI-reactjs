# app/repositories/department_repository.py
"""部门数据访问."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.department import Department
from app.domain.models.user import User


class DepartmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def next_node_seq(self) -> int:
        result = await self.db.execute(select(func.coalesce(func.max(Department.node_seq), 0)))
        return int(result.scalar_one()) + 1

    async def get_by_id(self, dept_id: uuid.UUID) -> Department | None:
        return await self.db.get(Department, dept_id)

    async def get_by_code(self, code: str) -> Department | None:
        result = await self.db.execute(select(Department).where(Department.code == code))
        return result.scalar_one_or_none()

    async def list_active(self) -> list[Department]:
        result = await self.db.execute(
            select(Department)
            .where(Department.status == "ACTIVE")
            .order_by(Department.sort_order, Department.code)
        )
        return list(result.scalars().all())

    async def find_subtree(self, root_path: str) -> list[Department]:
        result = await self.db.execute(
            select(Department).where(Department.path.like(f"{root_path}%"))
        )
        return list(result.scalars().all())

    async def count_children(self, parent_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Department).where(Department.parent_id == parent_id)
        )
        return int(result.scalar_one())

    async def count_users(self, dept_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(User).where(User.department_id == dept_id)
        )
        return int(result.scalar_one())

    async def max_descendant_depth(self, root_path: str, root_level: int) -> int:
        """后代中最大 (level - root_level);无后代返回 0."""
        result = await self.db.execute(
            select(func.max(Department.level))
            .where(Department.path.like(f"{root_path}/%"))  # 排除自身
        )
        max_level = result.scalar_one()
        return (int(max_level) - root_level) if max_level is not None else 0

    async def add(self, dept: Department) -> Department:
        self.db.add(dept)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def replace_subtree_paths(
        self, old_prefix: str, new_prefix: str, level_delta: int, root_path: str
    ) -> None:
        """批量替换子树(含自身)path 前缀并调整 level."""
        await self.db.execute(
            update(Department)
            .where(Department.path.like(f"{root_path}%"))
            .values(
                path=func.replace(Department.path, old_prefix, new_prefix),
                level=Department.level + level_delta,
            )
        )


__all__ = ["DepartmentRepository"]