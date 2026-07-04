"""角色与权限模型."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String, Uuid, select
from sqlalchemy.orm import Mapped, mapped_column, relationship, selectinload

from app.domain.models import Base
from app.domain.models.enums import DataScope

if TYPE_CHECKING:
    from app.domain.models.user import User


UUIDType = Uuid


class Permission(Base):
    __tablename__ = "permission"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # MENU/ACTION/FIELD/DATA
    resource: Mapped[str] = mapped_column(String(50), nullable=False)
    action: Mapped[str | None] = mapped_column(String(50), nullable=True)

    roles: Mapped[list["Role"]] = relationship(
        secondary="role_permission", back_populates="permissions", lazy="selectin"
    )


class Role(Base):
    __tablename__ = "role"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    data_scope: Mapped[DataScope] = mapped_column(
        String(20), default=DataScope.SELF, nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)

    users: Mapped[list["User"]] = relationship(
        secondary="user_role", back_populates="roles", lazy="selectin"
    )
    permissions: Mapped[list["Permission"]] = relationship(
        secondary="role_permission", back_populates="roles", lazy="selectin"
    )

    @classmethod
    def with_permissions(cls):
        return select(cls).options(selectinload(cls.permissions))