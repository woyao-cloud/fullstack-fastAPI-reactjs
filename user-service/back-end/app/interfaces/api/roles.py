"""角色与权限路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.role import PermissionOut, RoleCreate, RoleOut, RoleUpdate
from app.application.services.permission_service import PermissionService
from app.application.services.role_service import RoleService
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.permission_repository import PermissionRepository

router = APIRouter()


@router.get("/roles", response_model=list[RoleOut])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
) -> list[RoleOut]:
    svc = RoleService(db)
    return [RoleOut.model_validate(r) for r in await svc.list()]


@router.get("/roles/{role_id}", response_model=RoleOut)
async def get_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
) -> RoleOut:
    svc = RoleService(db)
    return RoleOut.model_validate(await svc.get(role_id))


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    req: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:create")),
) -> RoleOut:
    svc = RoleService(db)
    return RoleOut.model_validate(
        await svc.create(req.name, req.code, req.description, req.permission_ids)
    )


@router.put("/roles/{role_id}", response_model=RoleOut)
async def update_role(
    role_id: uuid.UUID,
    req: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:update")),
) -> RoleOut:
    svc = RoleService(db)
    return RoleOut.model_validate(
        await svc.update(role_id, req.name, req.code, req.description,
                         req.permission_ids, req.data_scope, req.status)
    )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:delete")),
) -> None:
    svc = RoleService(db)
    await svc.delete(role_id)


@router.get("/permissions", response_model=list[PermissionOut])
async def list_permissions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
) -> list[PermissionOut]:
    repo = PermissionRepository(db)
    return [PermissionOut.model_validate(p) for p in await repo.list()]


@router.get("/permissions/grouped")
async def list_permissions_grouped(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("role:read")),
) -> dict[str, list[dict]]:
    svc = PermissionService(db)
    return await svc.get_grouped()