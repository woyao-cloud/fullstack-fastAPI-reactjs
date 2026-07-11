"""系统配置分组 Pydantic 模型 + key→组映射."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr

_PREFIX_TO_GROUP = {"mail": "MAIL", "security": "SECURITY",
                    "performance": "PERFORMANCE", "system": "SYSTEM"}


def group_of_key(key: str) -> str:
    prefix = key.split(".", 1)[0]
    group = _PREFIX_TO_GROUP.get(prefix)
    if group is None:
        raise ValueError(f"未知配置组前缀: {prefix}")
    return group


class MailConfig(BaseModel):
    host: str = Field(min_length=1, max_length=255)
    port: int = Field(ge=1, le=65535)
    username: str = Field(min_length=1, max_length=255)
    password: SecretStr
    protocol: Literal["smtp", "smtps"] = "smtp"
    starttls: bool = True


class SecurityPolicy(BaseModel):
    password_min_length: int = Field(ge=6, le=128)
    password_require_uppercase: bool
    password_require_lowercase: bool
    password_require_digits: bool
    password_require_special: bool
    password_history_size: int = Field(ge=0, le=20)
    password_expiration_days: int = Field(ge=0, le=365)
    login_max_attempts: int = Field(ge=1, le=20)
    login_lock_minutes: int = Field(ge=1, le=1440)
    session_timeout_minutes: int = Field(ge=1, le=1440)


class PerformanceConfig(BaseModel):
    cache_user_info_ttl: int = Field(ge=10, le=3600)
    cache_permission_ttl: int = Field(ge=10, le=3600)
    cache_department_tree_ttl: int = Field(ge=10, le=3600)
    db_max_pool_size: int = Field(ge=1, le=100)
    api_response_threshold_ms: int = Field(ge=10, le=10000)


class SystemParams(BaseModel):
    site_name: str = Field(min_length=1, max_length=100)
    default_locale: str = Field(pattern=r"^[a-z]{2}_[A-Z]{2}$")
    support_email: EmailStr


GROUP_MODELS = {
    "MAIL": MailConfig,
    "SECURITY": SecurityPolicy,
    "PERFORMANCE": PerformanceConfig,
    "SYSTEM": SystemParams,
}


class ConfigValueUpdate(BaseModel):
    value: str | int | bool | dict


class EmailTemplateCreate(BaseModel):
    template_code: str = Field(min_length=1, max_length=50)
    template_name: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    variables: list[dict] | None = None
    is_active: bool = True


class EmailTemplateUpdate(BaseModel):
    template_code: str | None = Field(default=None, min_length=1, max_length=50)
    template_name: str | None = Field(default=None, min_length=1, max_length=100)
    subject: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    variables: list[dict] | None = None
    is_active: bool | None = None


class EmailTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    template_code: str
    template_name: str
    subject: str
    content: str
    variables: list[dict] | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmailTemplateListOut(BaseModel):
    items: list[EmailTemplateOut]
    total: int
    page: int
    size: int