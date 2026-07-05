"""部门 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=50)
    parent_id: uuid.UUID | None = None
    sort_order: int = 0
    manager_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    sort_order: int | None = None
    manager_id: uuid.UUID | None = None
    status: str | None = Field(default=None, max_length=20)


class DepartmentMove(BaseModel):
    parent_id: uuid.UUID | None = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_seq: int
    name: str
    code: str
    parent_id: uuid.UUID | None
    level: int
    path: str
    sort_order: int
    manager_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class DepartmentTreeNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_seq: int
    name: str
    code: str
    parent_id: uuid.UUID | None
    level: int
    path: str
    sort_order: int
    manager_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime
    children: list[DepartmentTreeNode] = Field(default_factory=list)


DepartmentTreeNode.model_rebuild()


class DepartmentListOut(BaseModel):
    items: list[DepartmentOut]
    total: int
    page: int
    size: int