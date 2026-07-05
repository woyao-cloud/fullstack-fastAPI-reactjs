"""认证服务: 注册、登录、刷新."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.core.config import settings
from app.core.exceptions import AuthError, ConflictError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.domain.models.enums import UserStatus
from app.domain.models.user import User
from app.repositories.role_repository import RoleRepository
from app.repositories.user_repository import UserRepository

DEFAULT_USER_ROLE_CODE = "USER"


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)
        self.roles = RoleRepository(db)

    async def register(self, req: RegisterRequest) -> User:
        existing = await self.users.get_by_email(req.email)
        if existing is not None:
            raise ConflictError("邮箱已注册")
        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone,
            status=UserStatus.ACTIVE,
            email_verified=False,
        )
        await self.users.add(user)
        # 默认分配 USER 角色（若存在）
        role = await self.roles.get_by_code(DEFAULT_USER_ROLE_CODE)
        if role is not None:
            await self.users.assign_role(user, role)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def login(self, req: LoginRequest) -> TokenResponse:
        user = await self.users.get_by_email(req.email)
        if user is None or not user.is_active:
            raise AuthError("邮箱或密码错误")
        if not verify_password(req.password, user.password_hash):
            raise AuthError("邮箱或密码错误")
        user.last_login_at = datetime.now(UTC).isoformat()
        await self.db.commit()
        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    async def refresh(self, refresh_token: str) -> TokenResponse:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthError("无效的刷新令牌")
        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("无效的刷新令牌")
        user = await self.users.get_by_id(uuid.UUID(user_id))
        if user is None or not user.is_active:
            raise AuthError("用户不存在或已禁用")
        return TokenResponse(
            access_token=create_access_token(user.id),
            refresh_token=create_refresh_token(user.id),
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )