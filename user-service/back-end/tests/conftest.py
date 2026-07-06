"""pytest 配置 - SQLite 内存异步库 + httpx AsyncClient + 种子角色/权限."""

from __future__ import annotations

import asyncio
import os
import tempfile
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# 确保所有模型注册到 Base.metadata
import app.domain.models.associations  # noqa: F401  pylint: disable=unused-import
import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
import app.domain.models.system_config  # noqa: F401  pylint: disable=unused-import
from app.core.database import get_db
from app.domain.models import Base
from app.domain.models.enums import DataScope
from app.domain.models.role import Permission, Role
from app.main import app


@pytest.fixture(autouse=True)
def _encryption_key(monkeypatch):
    from cryptography.fernet import Fernet

    from app.core import config as _config

    monkeypatch.setattr(
        _config.settings, "CONFIG_ENCRYPTION_KEY", Fernet.generate_key().decode()
    )
    # crypto 模块缓存了 _fernet,重置以用新密钥
    from app.core import crypto
    crypto._fernet = None


@pytest.fixture(scope="session")
def db_file():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    yield path
    try:
        os.remove(path)
    except OSError:
        pass


@pytest.fixture
def database_url(db_file):
    # Windows 路径反斜杠在 SQLAlchemy URL 中无效，转正斜杠
    return f"sqlite+aiosqlite:///{db_file.replace(os.sep, '/')}"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def engine(database_url):
    eng = create_async_engine(database_url, future=True, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as session:
        yield session


@pytest_asyncio.fixture
async def seed(db_session):
    """种子权限与角色。"""
    perms = [
        Permission(name="用户读取", code="user:read", type="ACTION",
                   resource="user", action="read"),
        Permission(name="用户创建", code="user:create", type="ACTION",
                   resource="user", action="create"),
        Permission(name="用户更新", code="user:update", type="ACTION",
                   resource="user", action="update"),
        Permission(name="用户删除", code="user:delete", type="ACTION",
                   resource="user", action="delete"),
        Permission(name="用户分配角色", code="user:assign_role", type="ACTION",
                   resource="user", action="assign_role"),
        Permission(name="部门读取", code="dept:read", type="ACTION",
                   resource="dept", action="read"),
        Permission(name="部门创建", code="dept:create", type="ACTION",
                   resource="dept", action="create"),
        Permission(name="部门更新", code="dept:update", type="ACTION",
                   resource="dept", action="update"),
        Permission(name="部门删除", code="dept:delete", type="ACTION",
                   resource="dept", action="delete"),
    ]
    db_session.add_all(perms)
    await db_session.flush()

    admin = Role(name="管理员", code="ADMIN", data_scope=DataScope.ALL)
    admin.permissions = perms
    user_role = Role(name="普通用户", code="USER", data_scope=DataScope.SELF)
    db_session.add_all([admin, user_role])
    await db_session.commit()
    return {"admin": admin, "user": user_role, "permissions": perms}


@pytest_asyncio.fixture
async def client(engine, seed) -> AsyncIterator[AsyncClient]:
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    async def override_get_db():
        async with Session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    from app.core.cache import NoopDepartmentCache, get_department_cache
    app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_token(client, engine) -> str:
    # 注册一个管理员账号并通过直接数据库操作赋予 ADMIN 角色
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@test.com",
            "password": "Admin@1234",
            "first_name": "Admin",
            "last_name": "User",
        },
    )
    assert resp.status_code == 201, resp.text
    # 直接更新数据库赋予 ADMIN 角色
    from sqlalchemy import select

    from app.domain.models.role import Role
    from app.repositories.user_repository import UserRepository

    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as session:
        user = await UserRepository(session).get_by_email("admin@test.com")
        admin_role = (await session.execute(select(Role).where(Role.code == "ADMIN"))).scalar_one()
        assert user is not None
        user.roles.append(admin_role)
        await session.commit()

    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "Admin@1234"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]