"""异步数据库引擎与会话工厂 + 连接池调优."""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

# 根据数据库类型选择连接池配置
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    # SQLite 不支持连接池
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL / 生产数据库 — 连接池调优
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        future=True,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        pool_pre_ping=settings.DB_POOL_PRE_PING,
        echo_pool=settings.DB_ECHO_POOL,
        pool_recycle=settings.DB_POOL_RECYCLE,
        # asyncpg 特定优化
        connect_args={
            "statement_cache_size": 0,  # 禁用 statement cache（减少内存）
            "prepared_statement_cache_size": 0,
        } if "asyncpg" in settings.DATABASE_URL else {},
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖：提供异步会话，请求结束自动关闭。"""
    async with AsyncSessionLocal() as session:
        yield session