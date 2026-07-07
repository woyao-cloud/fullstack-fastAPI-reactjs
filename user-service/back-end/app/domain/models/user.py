"""用户模型."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Uuid, select
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload

from app.domain.models import Base
from app.domain.models.enums import UserStatus
from app.domain.models.role import Role

if TYPE_CHECKING:
    pass


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


# SQLAlchemy 2.0 Uuid 类型：PostgreSQL 原生 UUID，SQLite 存为字符串，自动转换
UUIDType = Uuid


class User(Base):
    __tablename__ = "user_account"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("department.id"), nullable=True
    )
    status: Mapped[UserStatus] = mapped_column(
        String(20), default=UserStatus.PENDING, nullable=False
    )
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[str | None] = mapped_column(String(40), nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("user_account.id"), nullable=True, index=True
    )

    roles: Mapped[list[Role]] = relationship(
        secondary="user_role", back_populates="users", lazy="selectin"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    async def permission_codes(self) -> set[str]:
        """获取用户所有权限代码（含角色继承，简化为直接角色权限）。"""
        codes: set[str] = set()
        for role in self.roles:
            for perm in role.permissions:
                codes.add(perm.code)
        return codes

    @classmethod
    def with_roles(cls):
        """加载用户及其角色、权限的查询选项。"""
        return select(cls).options(selectinload(cls.roles).selectinload(Role.permissions))