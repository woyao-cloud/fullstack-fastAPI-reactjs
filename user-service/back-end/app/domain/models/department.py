"""部门模型 - Materialized Path(node_seq 整数路径)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Uuid, func, select
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models import Base

UUIDType = Uuid


class Department(Base):
    __tablename__ = "department"
    __table_args__ = (CheckConstraint("level BETWEEN 1 AND 5", name="ck_dept_level"),)

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    node_seq: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("department.id"), nullable=True
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("user_account.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @classmethod
    def find_subtree(cls, root_path: str):
        """查询子树(path LIKE root_path%)."""
        return select(cls).where(cls.path.like(f"{root_path}%"))