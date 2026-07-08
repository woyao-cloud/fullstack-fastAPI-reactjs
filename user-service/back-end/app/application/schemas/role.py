"""角色与权限相关 Pydantic 模型."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, Field


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    type: str
    resource: str
    action: str | None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    description: str | None
    data_scope: str
    status: str
    permissions: list[PermissionOut] = []


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    code: str = Field(min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    permission_ids: list[uuid.UUID] | None = None


class RoleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=50)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    permission_ids: list[uuid.UUID] | None = None
    data_scope: str | None = None
    status: str | None = None