"""用户路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.user import UserCreate, UserListOut, UserOut, UserUpdate
from app.application.services.user_service import UserService
from app.core.security import get_current_user, require_permission
from app.domain.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UserListOut)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:read")),
) -> UserListOut:
    service = UserService(db)
    items, total = await service.list(page, size)
    return UserListOut(
        items=[UserOut.model_validate(u) for u in items], total=total, page=page, size=size
    )


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:create")),
) -> UserOut:
    service = UserService(db)
    return UserOut.model_validate(await service.create(req))


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current: User = Depends(get_current_user),
) -> UserOut:
    # 本人可直接查看；否则需要 user:read 权限
    if current.id != user_id:
        codes = await current.permission_codes()
        if "user:read" not in codes:
            from fastapi import HTTPException, status

            raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
        service = UserService(db)
        return UserOut.model_validate(await service.get(user_id))
    return UserOut.model_validate(current)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    req: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:update")),
) -> UserOut:
    service = UserService(db)
    return UserOut.model_validate(await service.update(user_id, req))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:delete")),
) -> None:
    service = UserService(db)
    await service.delete(user_id)


@router.post("/{user_id}/roles/{role_id}", response_model=UserOut)
async def assign_role(
    user_id: uuid.UUID,
    role_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("user:assign_role")),
) -> UserOut:
    service = UserService(db)
    return UserOut.model_validate(await service.assign_role(user_id, role_id))