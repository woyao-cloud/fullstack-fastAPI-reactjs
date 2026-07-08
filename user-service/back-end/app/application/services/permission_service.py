"""权限服务."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.permission_repository import PermissionRepository


class PermissionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = PermissionRepository(db)

    async def get_grouped(self) -> dict[str, list[dict]]:
        """按类型分组返回权限列表."""
        perms = await self.repo.list()
        grouped: dict[str, list[dict]] = {}
        for p in perms:
            ptype = p.type
            if ptype not in grouped:
                grouped[ptype] = []
            grouped[ptype].append({
                "id": str(p.id),
                "name": p.name,
                "code": p.code,
                "type": p.type,
                "resource": p.resource,
                "action": p.action,
            })
        return grouped