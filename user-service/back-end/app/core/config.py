"""应用配置 - pydantic-settings 从环境变量/.env 加载."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # 应用
    APP_NAME: str = "User Management Service"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # 数据库（默认 SQLite 以便本地与测试无外部依赖；生产用 PostgreSQL）
    DATABASE_URL: str = "sqlite+aiosqlite:///./user_service.db"

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # 密码策略
    PASSWORD_MIN_LENGTH: int = 8

    # Redis（可选，测试不依赖）
    REDIS_URL: str = "redis://localhost:6379/0"

    # 缓存开关(测试置 False 强制 Noop 降级)
    CACHE_ENABLED: bool = True

    # 缓存 TTL（秒）
    CACHE_DEPT_TREE_TTL: int = 1800  # 部门树 30 分钟
    CACHE_DEPT_SUBTREE_TTL: int = 1800  # 子树 ID 30 分钟
    CACHE_CONFIG_TTL: int = 60  # 系统配置 1 分钟
    CACHE_USER_INFO_TTL: int = 300  # 用户信息 5 分钟
    CACHE_PERMISSION_TTL: int = 300  # 权限 5 分钟

    # 配置加密密钥(Fernet,启动期必须提供)
    CONFIG_ENCRYPTION_KEY: str = ""  # 生产由 .env 注入;测试由 fixture 注入
    # 配置缓存开关(测试置 False 强制 LocalTTLCache)
    CONFIG_CACHE_ENABLED: bool = True


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()