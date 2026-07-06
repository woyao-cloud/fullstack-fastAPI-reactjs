"""FastAPI 应用入口."""

from __future__ import annotations

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
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import register_exception_handlers
from app.domain.models import Base
from app.interfaces.api import auth, departments, email_templates, health, system_config, users


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # 测试/开发环境自动建表；生产应使用 Alembic 迁移
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
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