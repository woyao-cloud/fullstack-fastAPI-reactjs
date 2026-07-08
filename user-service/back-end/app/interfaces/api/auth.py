"""认证路由."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
)
from app.application.schemas.user import UserOut, UserWithPermissionsOut
from app.application.services.auth_service import AuthService
from app.core.security import get_current_user
from app.domain.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserOut:
    service = AuthService(db)
    user = await service.register(req)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    service = AuthService(db)
    return await service.login(req)


@router.post("/login/oauth", response_model=TokenResponse, include_in_schema=False)
async def login_oauth_form(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    service = AuthService(db)
    return await service.login(LoginRequest(email=form.username, password=form.password))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    service = AuthService(db)
    return await service.refresh(req.refresh_token)


@router.get("/me", response_model=UserWithPermissionsOut)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserWithPermissionsOut:
    return UserWithPermissionsOut(
        **UserOut.model_validate(current_user).model_dump(),
        permissions=list(await current_user.permission_codes()),
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    req: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = AuthService(db)
    await service.change_password(current_user.id, req)