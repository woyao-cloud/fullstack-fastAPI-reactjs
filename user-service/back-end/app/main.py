"""FastAPI 应用入口."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# 确保关联表与模型在导入时注册到 Base.metadata
import app.domain.models.associations  # noqa: F401
import app.domain.models.department  # noqa: F401
import app.domain.models.role  # noqa: F401
import app.domain.models.system_config  # noqa: F401
import app.domain.models.user  # noqa: F401
from app.application.services.config_service import ConfigService
from app.core import crypto
from app.core.config import settings
from app.core.config_cache import get_config_cache
from app.core.database import AsyncSessionLocal, engine
from app.core.exceptions import register_exception_handlers
from app.domain.models import Base
from app.interfaces.api import auth, departments, email_templates, health, system_config, users
from app.repositories.system_config_repository import (
    ConfigHistoryRepository,
    SystemConfigRepository,
)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # 测试/开发环境自动建表；生产应使用 Alembic 迁移
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # 配置缓存订阅(Redis 实现时;本地 no-op)
    cache = await get_config_cache()
    subscriber_task = asyncio.create_task(cache.start_subscriber())
    # 幂等初始化默认配置(全零 UUID 作为系统操作人)
    async with AsyncSessionLocal() as session:
        svc = ConfigService(
            session,
            SystemConfigRepository(session),
            ConfigHistoryRepository(session),
            crypto,
            cache,
        )
        await svc.init_default_configs(None)
    yield
    subscriber_task.cancel()
    try:
        await subscriber_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url="/docs",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)

    app.include_router(health.router)
    app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
    app.include_router(users.router, prefix=settings.API_V1_PREFIX)
    app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
    app.include_router(system_config.router, prefix=settings.API_V1_PREFIX)
    app.include_router(email_templates.router, prefix=settings.API_V1_PREFIX)

    return app


app = create_app()