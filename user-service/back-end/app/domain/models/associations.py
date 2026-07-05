"""关联表: user_role, role_permission."""

from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Table, Uuid

from app.domain.models import Base

UUIDType = Uuid

user_role = Table(
    "user_role",
    Base.metadata,
    Column("user_id", UUIDType, ForeignKey("user_account.id"), primary_key=True),
    Column("role_id", UUIDType, ForeignKey("role.id"), primary_key=True),
)

role_permission = Table(
    "role_permission",
    Base.metadata,
    Column("role_id", UUIDType, ForeignKey("role.id"), primary_key=True),
    Column("permission_id", UUIDType, ForeignKey("permission.id"), primary_key=True),
)


# 确保关联表在模型导入时注册（避免 SQLAlchemy "permission" 表名冲突）
__all__ = ["user_role", "role_permission", "UUIDType"]