"""系统配置分组 Pydantic 模型 + key→组映射."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, SecretStr

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