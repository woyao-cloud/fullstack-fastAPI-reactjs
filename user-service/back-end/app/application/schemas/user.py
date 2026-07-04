"""用户相关 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.domain.models.enums import UserStatus


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    department_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    department_id: uuid.UUID | None = None
    status: UserStatus | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    phone: str | None
    status: UserStatus
    email_verified: bool
    department_id: uuid.UUID | None
    created_at: datetime
    last_login_at: str | None


class UserListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: list[UserOut]
    total: int
    page: int
    size: int