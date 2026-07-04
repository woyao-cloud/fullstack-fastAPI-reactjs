"""部门模型 - Materialized Path."""

from __future__ import annotations

import uuid

from sqlalchemy import String, ForeignKey, Uuid, select
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models import Base

UUIDType = Uuid


class Department(Base):
    __tablename__ = "department"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("department.id"), nullable=True
    )
    level: Mapped[int] = mapped_column(nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)

    @classmethod
    def find_subtree(cls, root_path: str):
        """查询子树（path LIKE root_path/%）。"""
        return select(cls).where(cls.path.like(f"{root_path}%"))