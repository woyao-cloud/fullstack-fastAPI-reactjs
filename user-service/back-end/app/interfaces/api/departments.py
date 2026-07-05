"""部门路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.department import (
    DepartmentCreate,
    DepartmentListOut,
    DepartmentMove,
    DepartmentOut,
    DepartmentTreeNode,
    DepartmentUpdate,
)
from app.application.services.department_service import DepartmentService
from app.core.cache import DepartmentCache, get_department_cache
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.department_repository import DepartmentRepository

router = APIRouter(prefix="/departments", tags=["departments"])


def _svc(db: AsyncSession, cache: DepartmentCache) -> DepartmentService:
    return DepartmentService(db, DepartmentRepository(db), cache)


@router.get("/tree", response_model=list[DepartmentTreeNode])
async def get_tree(
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> list[DepartmentTreeNode]:
    return await _svc(db, cache).get_tree()


@router.get("/{dept_id}/subtree", response_model=list[DepartmentTreeNode])
async def get_subtree(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> list[DepartmentTreeNode]:
    return await _svc(db, cache).get_subtree(dept_id)


@router.get("", response_model=DepartmentListOut)
async def list_departments(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> DepartmentListOut:
    svc = _svc(db, cache)
    flat = await svc.repo.list_active()
    start = (page - 1) * size
    items = flat[start:start + size]
    return DepartmentListOut(
        items=[DepartmentOut.model_validate(d) for d in items],
        total=len(flat), page=page, size=size,
    )


@router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> DepartmentOut:
    svc = _svc(db, cache)
    dept = await svc.repo.get_by_id(dept_id)
    if dept is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("部门不存在")
    return DepartmentOut.model_validate(dept)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    req: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:create")),
) -> DepartmentOut:
    dept = await _svc(db, cache).create(req)
    return DepartmentOut.model_validate(dept)


@router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: uuid.UUID,
    req: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:update")),
) -> DepartmentOut:
    return DepartmentOut.model_validate(await _svc(db, cache).update(dept_id, req))


@router.post("/{dept_id}/move", response_model=DepartmentOut)
async def move_department(
    dept_id: uuid.UUID,
    req: DepartmentMove,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:update")),
) -> DepartmentOut:
    return DepartmentOut.model_validate(await _svc(db, cache).move(dept_id, req.parent_id))


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:delete")),
) -> None:
    await _svc(db, cache).delete(dept_id)


@router.get("/{dept_id}/users", response_model=list)
async def list_dept_users(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
):
    from app.application.schemas.user import UserOut
    return await _svc(db, cache).list_users(dept_id)