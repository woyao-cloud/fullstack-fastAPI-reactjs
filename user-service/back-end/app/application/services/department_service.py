"""部门业务服务."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.department import DepartmentCreate, DepartmentUpdate
from app.core.cache import DepartmentCache, NoopDepartmentCache
from app.core.exceptions import BusinessException, ConflictError, NotFoundError
from app.domain.models.department import Department
from app.repositories.department_repository import DepartmentRepository

MAX_LEVEL = 5


class DepartmentService:
    def __init__(self, db: AsyncSession, repo: DepartmentRepository, cache: DepartmentCache):
        self.db = db
        self.repo = repo
        self.cache = cache

    async def _get_or_404(self, dept_id: uuid.UUID) -> Department:
        dept = await self.repo.get_by_id(dept_id)
        if dept is None:
            raise NotFoundError("部门不存在")
        return dept

    async def create(self, req: DepartmentCreate) -> Department:
        if await self.repo.get_by_code(req.code) is not None:
            raise ConflictError("部门编码已存在")
        node_seq = await self.repo.next_node_seq()
        if req.parent_id is not None:
            parent = await self.repo.get_by_id(req.parent_id)
            if parent is None:
                raise NotFoundError("父部门不存在")
            if parent.level >= MAX_LEVEL:
                raise BusinessException(f"父部门已达第 {MAX_LEVEL} 级,无法添加子部门")
            level = parent.level + 1
            path = f"{parent.path}/{node_seq}"
            parent_id = parent.id
        else:
            level = 1
            path = f"/{node_seq}"
            parent_id = None
        dept = Department(
            node_seq=node_seq, name=req.name, code=req.code, parent_id=parent_id,
            level=level, path=path, sort_order=req.sort_order, manager_id=req.manager_id,
        )
        # 注: brief 使用 `async with self.db.begin()`,但预检读取已触发 autobegin,
        # 再次 begin 会抛 InvalidRequestError。改为 flush+commit(与本仓 user_service 一致)。
        self.db.add(dept)
        await self.db.flush()
        await self.db.refresh(dept)
        await self.db.commit()
        await self.cache.invalidate()
        return dept

    async def update(self, dept_id: uuid.UUID, req: DepartmentUpdate) -> Department:
        dept = await self._get_or_404(dept_id)
        if req.code is not None and req.code != dept.code:
            if await self.repo.get_by_code(req.code) is not None:
                raise ConflictError("部门编码已存在")
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(dept, field, value)
        await self.db.flush()
        await self.db.refresh(dept)
        await self.db.commit()
        await self.cache.invalidate()
        return dept

    async def delete(self, dept_id: uuid.UUID) -> None:
        dept = await self._get_or_404(dept_id)
        if await self.repo.count_children(dept_id) > 0:
            raise ConflictError("存在子部门,无法删除")
        if await self.repo.count_users(dept_id) > 0:
            raise ConflictError("存在关联用户,无法删除")
        from datetime import datetime, timezone

        dept.status = "INACTIVE"
        dept.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()
        await self.db.commit()
        await self.cache.invalidate()

    # move / get_tree / get_subtree / list_users 见 Task 7、Task 8