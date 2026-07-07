# app/application/services/data_permission_filter.py
"""数据权限过滤:按用户有效 data_scope 叠加 where."""

from __future__ import annotations

import uuid

from sqlalchemy import false
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.enums import DataScope
from app.domain.models.user import User
from app.repositories.department_repository import DepartmentRepository


class DataPermissionFilter:
    def __init__(self, db: AsyncSession, dept_repo: DepartmentRepository):
        self.db = db
        self.dept_repo = dept_repo

    @staticmethod
    def _effective_scope(user: User) -> DataScope:
        scopes = {r.data_scope for r in user.roles}
        if DataScope.ALL in scopes:
            return DataScope.ALL
        if DataScope.DEPT in scopes:
            return DataScope.DEPT
        if DataScope.SELF in scopes:
            return DataScope.SELF
        return DataScope.SELF  # CUSTOM / 无角色 → SELF 回退

    async def _accessible_dept_ids(self, user: User) -> list[uuid.UUID]:
        if user.department_id is None:
            return []
        ids = await self.dept_repo.get_sub_department_ids(user.department_id)
        ids.append(user.department_id)
        return ids

    async def apply(self, stmt, current_user: User):
        scope = self._effective_scope(current_user)
        if scope is DataScope.ALL:
            return stmt
        if scope is DataScope.SELF:
            return stmt.where(User.created_by == current_user.id)
        if scope is DataScope.DEPT:
            dept_ids = await self._accessible_dept_ids(current_user)
            if not dept_ids:
                return stmt.where(false())
            return stmt.where(User.department_id.in_(dept_ids))
        return stmt.where(User.created_by == current_user.id)  # CUSTOM 回退 SELF