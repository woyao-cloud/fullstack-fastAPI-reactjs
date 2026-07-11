# 部门管理模块(阶段2)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 FastAPI 后端实现五级部门树形管理(CRUD/树查询/层级调整/成员只读) + Redis 可选降级缓存,测试通过且覆盖率 ≥85%。

**Architecture:** 分层(domain model → repository → cache 抽象 → service → API)。path 用整数 `node_seq` 拼接(`/1/2/5`),UUID 主键保留。缓存以 `DepartmentCache` 协议注入 service,生产 Redis / 测试 Noop 降级。move 独立于 update,单事务批量更新子树 path/level。

**Tech Stack:** FastAPI 0.115+ / SQLAlchemy 2.x async / asyncpg / aiosqlite(测试)/ redis-py async / pydantic v2 / pytest + pytest-asyncio + httpx。

## Global Constraints

- Python ≥ 3.12;依赖经 `uv` 管理(`pyproject.toml`)。
- 跨库主键用 `sqlalchemy.Uuid`(SQLite 存字符串,PG 原生)。
- 测试用 SQLite 文件 + `StaticPool`?否——沿用现有 conftest 的文件 DB 方案(每测试临时文件,正斜杠 URL)。
- 测试无外部 Redis:`CACHE_ENABLED=False` 注入 `NoopDepartmentCache`。
- 命名沿用现有:service 类 `XxxService`、repository `XxxRepository`、schema `XxxOut/Create/Update`。
- 提交粒度:每个 Task 末尾一次 commit;TDD(先写失败测试→实现→通过→提交)。
- 现有 `back-end/` 为工作目录,所有命令在 `D:\claude-code-project\fullstack-fastAPI-reactjs\user-service\back-end` 下用 `uv run` 执行。

**设计文档:** `docs/superpowers/specs/2026-07-05-department-management-design.md`

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `app/domain/models/department.py` | Department 模型(node_seq/manager_id/deleted_at/CheckConstraint) | Modify |
| `app/repositories/department_repository.py` | 数据访问 | Create |
| `app/core/cache/__init__.py` | DepartmentCache 协议 + Noop + 工厂 + 配置项 | Create |
| `app/core/cache/redis_cache.py` | RedisDepartmentCache | Create |
| `app/application/schemas/department.py` | Pydantic schema | Create |
| `app/application/services/department_service.py` | 业务服务 | Create |
| `app/interfaces/api/departments.py` | 路由 | Create |
| `app/main.py` | 注册 departments 路由 | Modify |
| `app/core/config.py` | 新增 `CACHE_ENABLED` | Modify |
| `tests/conftest.py` | seed 扩展 dept 权限 + 基线部门 + cache override | Modify |
| `tests/test_department_repository.py` | repository 测试 | Create |
| `tests/test_cache.py` | 缓存序列化/Noop 测试 | Create |
| `tests/test_department_service.py` | service 测试 | Create |
| `tests/test_departments_api.py` | API 测试 | Create |

---

## Task 1: 调整 Department 模型

**Files:**
- Modify: `app/domain/models/department.py`
- Test: `tests/test_department_model.py` (Create)

**Interfaces:**
- Produces: `Department` 含字段 `node_seq: int`(unique index)、`manager_id: uuid.UUID | None`(FK user_account)、`deleted_at: datetime | None`;`CheckConstraint("level BETWEEN 1 AND 5")`。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_department_model.py
from __future__ import annotations

import pytest
from sqlalchemy import inspect

from app.domain.models import Base
import app.domain.models.associations  # noqa: F401
import app.domain.models.role  # noqa: F401
import app.domain.models.user  # noqa: F401
import app.domain.models.department  # noqa: F401

pytestmark = pytest.mark.asyncio


def test_department_columns():
    cols = {c["name"] for c in inspect(Base.metadata.tables["department"]).columns}
    assert {"id", "node_seq", "name", "code", "parent_id", "level", "path",
            "sort_order", "manager_id", "status", "deleted_at",
            "created_at", "updated_at"} <= cols


def test_department_node_seq_unique():
    node_seq = Base.metadata.tables["department"].columns["node_seq"]
    assert node_seq.unique is True


def test_department_level_check():
    table = Base.metadata.tables["department"]
    has_check = any(
        "level BETWEEN 1 AND 5" in str(c.sqltext).upper()
        for c in table.constraints
        if hasattr(c, "sqltext")
    )
    assert has_check
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_model.py -v`
Expected: FAIL (`node_seq`/`manager_id`/`deleted_at`/check 缺失)

- [ ] **Step 3: 修改模型**

```python
# app/domain/models/department.py
"""部门模型 - Materialized Path(node_seq 整数路径)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Uuid, func, select
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models import Base

UUIDType = Uuid


class Department(Base):
    __tablename__ = "department"
    __table_args__ = (CheckConstraint("level BETWEEN 1 AND 5", name="ck_dept_level"),)

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    node_seq: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("department.id"), nullable=True
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("user_account.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @classmethod
    def find_subtree(cls, root_path: str):
        """查询子树(path LIKE root_path%)."""
        return select(cls).where(cls.path.like(f"{root_path}%"))
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_model.py -v`
Expected: PASS(3 passed)

- [ ] **Step 5: 提交**

```bash
git add app/domain/models/department.py tests/test_department_model.py
git commit -m "feat(dept): Department 模型增加 node_seq/manager_id/deleted_at 与 level CHECK"
```

---

## Task 2: DepartmentRepository

**Files:**
- Create: `app/repositories/department_repository.py`
- Test: `tests/test_department_repository.py`

**Interfaces:**
- Consumes: `Department` 模型(Task 1)、`AsyncSession`。
- Produces: `DepartmentRepository(db)` 含方法:
  - `async next_node_seq() -> int`
  - `async get_by_id(id: uuid.UUID) -> Department | None`
  - `async get_by_code(code: str) -> Department | None`
  - `async list_active() -> list[Department]`(`status="ACTIVE"`,order `sort_order, code`)
  - `async find_subtree(root_path: str) -> list[Department]`
  - `async count_children(parent_id: uuid.UUID) -> int`
  - `async count_users(dept_id: uuid.UUID) -> int`
  - `async max_descendant_depth(root_path: str, root_level: int) -> int`(后代中 `max(level - root_level)`,无后代返 0)
  - `async add(dept: Department) -> Department`
  - `async replace_subtree_paths(old_prefix: str, new_prefix: str, level_delta: int, root_path: str) -> None`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_department_repository.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.domain.models.department import Department
from app.domain.models.user import User
from app.core.security import hash_password
from app.repositories.department_repository import DepartmentRepository

pytestmark = pytest.mark.asyncio


async def _seed_dept(db, **kw):
    dept = Department(node_seq=kw["node_seq"], name=kw["name"], code=kw["code"],
                      level=kw["level"], path=kw["path"],
                      parent_id=kw.get("parent_id"), sort_order=kw.get("sort_order", 0))
    db.add(dept)
    await db.flush()
    return dept


async def test_next_node_seq(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        assert await repo.next_node_seq() == 1
        await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await db.commit()
        assert await repo.next_node_seq() == 2


async def test_list_active_filters_soft_deleted(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="A", code="A", level=1, path="/1")
        d1.status = "INACTIVE"
        await _seed_dept(db, node_seq=2, name="B", code="B", level=1, path="/2")
        await db.commit()
        active = await repo.list_active()
        assert [d.code for d in active] == ["B"]


async def test_find_subtree(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=uuid.uuid4())
        await _seed_dept(db, node_seq=3, name="其他", code="OT", level=1, path="/3")
        await db.commit()
        sub = await repo.find_subtree("/1")
        assert {d.code for d in sub} == {"HQ", "RD"}


async def test_count_children_and_users(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=d1.id)
        user = User(email="u@t.com", password_hash=hash_password("X@1234567"),
                    first_name="U", last_name="L", department_id=d1.id)
        db.add(user)
        await db.commit()
        assert await repo.count_children(d1.id) == 1
        assert await repo.count_users(d1.id) == 1


async def test_max_descendant_depth(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=d1.id)
        await _seed_dept(db, node_seq=3, name="后端", code="BE", level=3, path="/1/2/3", parent_id=uuid.uuid4())
        await db.commit()
        assert await repo.max_descendant_depth("/1", 1) == 2


async def test_replace_subtree_paths(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        d2 = await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=d1.id)
        await db.commit()
        await repo.replace_subtree_paths(old_prefix="/1", new_prefix="/9", level_delta=1, root_path="/1")
        await db.commit()
        await db.refresh(d1)
        await db.refresh(d2)
        assert d1.path == "/9" and d1.level == 2
        assert d2.path == "/9/2" and d2.level == 3
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_repository.py -v`
Expected: FAIL (`ModuleNotFoundError: app.repositories.department_repository`)

- [ ] **Step 3: 实现 repository**

```python
# app/repositories/department_repository.py
"""部门数据访问."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.department import Department
from app.domain.models.user import User


class DepartmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def next_node_seq(self) -> int:
        result = await self.db.execute(select(func.coalesce(func.max(Department.node_seq), 0)))
        return int(result.scalar_one()) + 1

    async def get_by_id(self, dept_id: uuid.UUID) -> Department | None:
        return await self.db.get(Department, dept_id)

    async def get_by_code(self, code: str) -> Department | None:
        result = await self.db.execute(select(Department).where(Department.code == code))
        return result.scalar_one_or_none()

    async def list_active(self) -> list[Department]:
        result = await self.db.execute(
            select(Department)
            .where(Department.status == "ACTIVE")
            .order_by(Department.sort_order, Department.code)
        )
        return list(result.scalars().all())

    async def find_subtree(self, root_path: str) -> list[Department]:
        result = await self.db.execute(
            select(Department).where(Department.path.like(f"{root_path}%"))
        )
        return list(result.scalars().all())

    async def count_children(self, parent_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Department).where(Department.parent_id == parent_id)
        )
        return int(result.scalar_one())

    async def count_users(self, dept_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(User).where(User.department_id == dept_id)
        )
        return int(result.scalar_one())

    async def max_descendant_depth(self, root_path: str, root_level: int) -> int:
        """后代中最大 (level - root_level);无后代返 0。"""
        result = await self.db.execute(
            select(func.max(Department.level))
            .where(Department.path.like(f"{root_path}/%"))  # 排除自身
        )
        max_level = result.scalar_one()
        return (int(max_level) - root_level) if max_level is not None else 0

    async def add(self, dept: Department) -> Department:
        self.db.add(dept)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def replace_subtree_paths(
        self, old_prefix: str, new_prefix: str, level_delta: int, root_path: str
    ) -> None:
        """批量替换子树(含自身)path 前缀并调整 level。"""
        await self.db.execute(
            update(Department)
            .where(Department.path.like(f"{root_path}%"))
            .values(
                path=func.replace(Department.path, old_prefix, new_prefix),
                level=Department.level + level_delta,
            )
        )
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_repository.py -v`
Expected: PASS(6 passed)

- [ ] **Step 5: 提交**

```bash
git add app/repositories/department_repository.py tests/test_department_repository.py
git commit -m "feat(dept): DepartmentRepository(CRUD/子树/计数/路径批量更新)"
```

---

## Task 3: 缓存协议 + Noop + 工厂 + 配置

**Files:**
- Create: `app/core/cache/__init__.py`
- Modify: `app/core/config.py`(新增 `CACHE_ENABLED`)
- Test: `tests/test_cache.py`

**Interfaces:**
- Consumes: `app.core.config.settings`
- Produces:
  - `DepartmentCache`(Protocol):`get_tree()->list[dict]|None`、`set_tree(list[dict])`、`get_subtree_ids(str)->list[str]|None`、`set_subtree_ids(str,list[str])`、`invalidate()`
  - `NoopDepartmentCache`(实现上述,全 MISS/no-op)
  - `get_department_cache()`(FastAPI 依赖,依 `CACHE_ENABLED` 与启动期 Redis 探测返回 Noop 或 Redis)

- [ ] **Step 1: 写失败测试**

```python
# tests/test_cache.py
from __future__ import annotations

import pytest

from app.core.cache import DepartmentCache, NoopDepartmentCache, get_department_cache

pytestmark = pytest.mark.asyncio


async def test_noop_miss_and_noop():
    cache = NoopDepartmentCache()
    assert await cache.get_tree() is None
    assert await cache.get_subtree_ids("1") is None
    await cache.set_tree([{"x": 1}])      # 不抛错
    await cache.set_subtree_ids("1", ["a"])
    await cache.invalidate()


async def test_department_cache_is_protocol():
    assert isinstance(NoopDepartmentCache(), DepartmentCache)  # Protocol 结构兼容


async def test_factory_returns_noop_when_disabled(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "CACHE_ENABLED", False)
    cache = await get_department_cache()
    assert isinstance(cache, NoopDepartmentCache)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_cache.py -v`
Expected: FAIL (`ModuleNotFoundError: app.core.cache`)

- [ ] **Step 3: 实现缓存协议 + Noop + 工厂**

```python
# app/core/cache/__init__.py
"""部门缓存抽象 + Noop 降级 + 工厂."""

from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

from app.core.config import settings

logger = logging.getLogger(__name__)


@runtime_checkable
class DepartmentCache(Protocol):
    async def get_tree(self) -> list[dict] | None: ...
    async def set_tree(self, nodes: list[dict]) -> None: ...
    async def get_subtree_ids(self, root_seq: str) -> list[str] | None: ...
    async def set_subtree_ids(self, root_seq: str, ids: list[str]) -> None: ...
    async def invalidate(self) -> None: ...


class NoopDepartmentCache:
    """无操作缓存:全部 MISS,等价直查 DB。"""

    async def get_tree(self) -> list[dict] | None:
        return None

    async def set_tree(self, nodes: list[dict]) -> None:
        return None

    async def get_subtree_ids(self, root_seq: str) -> list[str] | None:
        return None

    async def set_subtree_ids(self, root_seq: str, ids: list[str]) -> None:
        return None

    async def invalidate(self) -> None:
        return None


_noop_singleton = NoopDepartmentCache()
_redis_singleton: DepartmentCache | None = None


async def get_department_cache() -> DepartmentCache:
    """FastAPI 依赖:依 CACHE_ENABLED 与 Redis 可用性返回缓存实现。"""
    global _redis_singleton
    if not settings.CACHE_ENABLED:
        return _noop_singleton
    if _redis_singleton is not None:
        return _redis_singleton
    # 启动期探测 Redis(失败降级 Noop);Redis 实现见 Task 4
    try:
        from app.core.cache.redis_cache import RedisDepartmentCache, build_redis_client

        client = await build_redis_client()
        _redis_singleton = RedisDepartmentCache(client)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis 不可用,降级为 Noop 缓存: %s", exc)
        _redis_singleton = _noop_singleton
    return _redis_singleton
```

- [ ] **Step 4: 修改 config 增加 CACHE_ENABLED**

```python
# app/core/config.py —— 在 Settings 类中新增字段(紧随 REDIS_URL 之后)
    # 缓存开关(测试置 False 强制 Noop 降级)
    CACHE_ENABLED: bool = True
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_cache.py -v`
Expected: PASS(3 passed)

- [ ] **Step 6: 提交**

```bash
git add app/core/cache/__init__.py app/core/config.py tests/test_cache.py
git commit -m "feat(cache): DepartmentCache 协议 + Noop 降级 + 工厂与 CACHE_ENABLED"
```

---

## Task 4: RedisDepartmentCache(序列化与 key 规约)

**Files:**
- Create: `app/core/cache/redis_cache.py`
- Test: `tests/test_cache.py`(追加用例,用内存 fake redis)

**Interfaces:**
- Consumes: redis-py async 客户端(duck-typed:`get/set/delete/scan`,async)。
- Produces: `RedisDepartmentCache(client)`、`build_redis_client() -> redis.asyncio.Redis`。
- Key:`um:dept:tree`、`um:dept:subtree:{seq}`;TTL 30min。

- [ ] **Step 1: 写失败测试(追加到 tests/test_cache.py)**

```python
# tests/test_cache.py —— 末尾追加
import json


class FakeRedis:
    """内存 async redis 替身(仅本任务需要的命令)。"""

    def __init__(self):
        self.store: dict[str, str] = {}

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value

    async def delete(self, *keys):
        for k in keys:
            self.store.pop(k, None)

    async def scan(self, cursor=0, match=None, count=None):
        keys = [k.encode() for k in self.store if match is None or k.startswith(match.rstrip("*"))]
        return (0, keys)


async def test_redis_cache_set_get_tree():
    from app.core.cache.redis_cache import RedisDepartmentCache
    cache = RedisDepartmentCache(FakeRedis())
    nodes = [{"id": "1", "children": [{"id": "2"}]}]
    await cache.set_tree(nodes)
    got = await cache.get_tree()
    assert got == nodes


async def test_redis_cache_invalidate_clears_keys():
    from app.core.cache.redis_cache import RedisDepartmentCache
    fake = FakeRedis()
    cache = RedisDepartmentCache(fake)
    await cache.set_tree([{"id": "1"}])
    await cache.set_subtree_ids("1", ["1", "2"])
    await cache.invalidate()
    assert "um:dept:tree" not in fake.store
    assert all(not k.startswith("um:dept:subtree:") for k in fake.store)


async def test_redis_cache_subtree_ids_roundtrip():
    from app.core.cache.redis_cache import RedisDepartmentCache
    cache = RedisDepartmentCache(FakeRedis())
    assert await cache.get_subtree_ids("1") is None
    await cache.set_subtree_ids("1", ["1", "2", "3"])
    assert await cache.get_subtree_ids("1") == ["1", "2", "3"]
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_cache.py -v`
Expected: FAIL (`ModuleNotFoundError: app.core.cache.redis_cache`)

- [ ] **Step 3: 实现 RedisDepartmentCache**

```python
# app/core/cache/redis_cache.py
"""Redis 部门缓存实现."""

from __future__ import annotations

import json
import logging

from redis.asyncio import Redis

from app.core.cache import DepartmentCache

logger = logging.getLogger(__name__)

TREE_KEY = "um:dept:tree"
SUBTREE_PREFIX = "um:dept:subtree:"
TTL_SECONDS = 30 * 60


async def build_redis_client() -> Redis:
    from app.core.config import settings

    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    await client.ping()
    return client


class RedisDepartmentCache(DepartmentCache):
    def __init__(self, client: Redis):
        self.client = client

    async def get_tree(self) -> list[dict] | None:
        try:
            raw = await self.client.get(TREE_KEY)
            return json.loads(raw) if raw else None
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache get_tree 失败,降级: %s", exc)
            return None

    async def set_tree(self, nodes: list[dict]) -> None:
        try:
            await self.client.set(TREE_KEY, json.dumps(nodes), ex=TTL_SECONDS)
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache set_tree 失败,降级: %s", exc)

    async def get_subtree_ids(self, root_seq: str) -> list[str] | None:
        try:
            raw = await self.client.get(SUBTREE_PREFIX + root_seq)
            return json.loads(raw) if raw else None
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache get_subtree_ids 失败,降级: %s", exc)
            return None

    async def set_subtree_ids(self, root_seq: str, ids: list[str]) -> None:
        try:
            await self.client.set(SUBTREE_PREFIX + root_seq, json.dumps(ids), ex=TTL_SECONDS)
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache set_subtree_ids 失败,降级: %s", exc)

    async def invalidate(self) -> None:
        try:
            await self.client.delete(TREE_KEY)
            _, keys = await self.client.scan(match=SUBTREE_PREFIX + "*")
            if keys:
                await self.client.delete(*[k.decode() if isinstance(k, bytes) else k for k in keys])
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache invalidate 失败: %s", exc)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_cache.py -v`
Expected: PASS(6 passed)

- [ ] **Step 5: 提交**

```bash
git add app/core/cache/redis_cache.py tests/test_cache.py
git commit -m "feat(cache): RedisDepartmentCache(key 规约/序列化/降级)"
```

---

## Task 5: 部门 Pydantic Schema

**Files:**
- Create: `app/application/schemas/department.py`
- Test: `tests/test_department_schema.py`

**Interfaces:**
- Produces:
  - `DepartmentCreate{ name, code, parent_id?: UUID, sort_order?: int=0, manager_id?: UUID }`
  - `DepartmentUpdate{ name?, code?, sort_order?, manager_id?, status? }`(不含 parent_id)
  - `DepartmentMove{ parent_id: UUID | None }`
  - `DepartmentOut{ id, node_seq, name, code, parent_id, level, path, sort_order, manager_id, status, created_at, updated_at }`(from_attributes)
  - `DepartmentTreeNode{ ...DepartmentOut 字段, children: list[DepartmentTreeNode] }`
  - `DepartmentListOut{ items: list[DepartmentOut], total, page, size }`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_department_schema.py
from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.application.schemas.department import (
    DepartmentCreate, DepartmentMove, DepartmentTreeNode, DepartmentUpdate,
)

pytestmark = pytest.mark.asyncio


def test_department_create_minimal():
    d = DepartmentCreate(name="总部", code="HQ")
    assert d.parent_id is None and d.sort_order == 0


def test_department_update_excludes_parent_id():
    fields = set(DepartmentUpdate.model_fields.keys())
    assert "parent_id" not in fields
    assert "status" in fields


def test_department_move_optional_parent():
    assert DepartmentMove(parent_id=None).parent_id is None
    uid = uuid.uuid4()
    assert DepartmentMove(parent_id=uid).parent_id == uid


def test_tree_node_recursive():
    node = DepartmentTreeNode(
        id=uuid.uuid4(), node_seq=1, name="A", code="A", parent_id=None,
        level=1, path="/1", sort_order=0, manager_id=None, status="ACTIVE",
        created_at="2026-07-05T00:00:00Z", updated_at="2026-07-05T00:00:00Z",
        children=[],
    )
    node.children.append(node.model_copy(update={"node_seq": 2, "level": 2}))
    assert node.children[0].level == 2
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_schema.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: 实现 schema**

```python
# app/application/schemas/department.py
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
    children: list["DepartmentTreeNode"] = Field(default_factory=list)


class DepartmentListOut(BaseModel):
    items: list[DepartmentOut]
    total: int
    page: int
    size: int
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_schema.py -v`
Expected: PASS(4 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/schemas/department.py tests/test_department_schema.py
git commit -m "feat(dept): 部门 Pydantic schema(Create/Update/Move/Out/TreeNode/ListOut)"
```

---

## Task 6: DepartmentService — create / update / delete

**Files:**
- Create: `app/application/services/department_service.py`
- Test: `tests/test_department_service.py`(create/update/delete 部分)

**Interfaces:**
- Consumes: `DepartmentRepository`(Task 2)、`DepartmentCache`(Task 3)、`AsyncSession`。
- Produces:`DepartmentService(db, repo, cache)` 与方法 `create/update/delete`(本任务),及后续任务补充 `move/get_tree/get_subtree/list_users`。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_department_service.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.schemas.department import DepartmentCreate, DepartmentUpdate
from app.application.services.department_service import DepartmentService
from app.core.cache import NoopDepartmentCache
from app.core.exceptions import BusinessException, ConflictError, NotFoundError
from app.domain.models.department import Department
from app.domain.models.user import User
from app.core.security import hash_password
from app.repositories.department_repository import DepartmentRepository

pytestmark = pytest.mark.asyncio


def _service(db):
    return DepartmentService(db, DepartmentRepository(db), NoopDepartmentCache())


async def test_create_root(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        dept = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        assert dept.level == 1 and dept.path == "/1" and dept.node_seq == 1


async def test_create_child(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        child = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        assert child.level == 2 and child.path == f"/1/{child.node_seq}"


async def test_create_code_conflict(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        await svc.create(DepartmentCreate(name="总部", code="HQ"))
        with pytest.raises(ConflictError):
            await svc.create(DepartmentCreate(name="总2", code="HQ"))


async def test_create_parent_at_level5(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        # 构造 5 级链
        prev = await svc.create(DepartmentCreate(name="L1", code="C1"))
        for i in range(4):
            prev = await svc.create(DepartmentCreate(name=f"L{i+2}", code=f"C{i+2}", parent_id=prev.id))
        assert prev.level == 5
        with pytest.raises(BusinessException):
            await svc.create(DepartmentCreate(name="L6", code="C6", parent_id=prev.id))


async def test_update_does_not_change_path(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        before = (root.path, root.level)
        updated = await svc.update(root.id, DepartmentUpdate(name="总部改"))
        assert (updated.path, updated.level) == before
        assert updated.name == "总部改"


async def test_delete_leaf_ok(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        await svc.delete(root.id)
        got = await db.get(Department, root.id)
        assert got.status == "INACTIVE"


async def test_delete_with_children_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        with pytest.raises(ConflictError):
            await svc.delete(root.id)


async def test_delete_with_users_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        db.add(User(email="u@t.com", password_hash=hash_password("X@1234567"),
                    first_name="U", last_name="L", department_id=root.id))
        await db.commit()
        with pytest.raises(ConflictError):
            await svc.delete(root.id)


async def test_update_not_found(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        with pytest.raises(NotFoundError):
            await svc.update(uuid.uuid4(), DepartmentUpdate(name="x"))
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: 实现 service(create/update/delete;move/get_tree/get_subtree/list_users 留占位,后续任务补)**

```python
# app/application/services/department_service.py
"""部门业务服务."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.department import DepartmentCreate, DepartmentUpdate
from app.core.cache import DepartmentCache, NoopDepartmentCache
from app.core.exceptions import BusinessException, ConflictError, NotFoundError
from app.domain.models.department import Department
from app.repositories.department_repository import DepartmentRepository

MAX_LEVEL = 5


class DepartmentService:
    def __init__(self, db: AsyncSession, repo: DepartmentRepository, cache: DepartmentCache):
        self.db = db
        self.repo = repo
        self.cache = cache

    async def _get_or_404(self, dept_id: uuid.UUID) -> Department:
        dept = await self.repo.get_by_id(dept_id)
        if dept is None:
            raise NotFoundError("部门不存在")
        return dept

    async def create(self, req: DepartmentCreate) -> Department:
        if await self.repo.get_by_code(req.code) is not None:
            raise ConflictError("部门编码已存在")
        node_seq = await self.repo.next_node_seq()
        if req.parent_id is not None:
            parent = await self.repo.get_by_id(req.parent_id)
            if parent is None:
                raise NotFoundError("父部门不存在")
            if parent.level >= MAX_LEVEL:
                raise BusinessException(f"父部门已达第 {MAX_LEVEL} 级,无法添加子部门")
            level = parent.level + 1
            path = f"{parent.path}/{node_seq}"
            parent_id = parent.id
        else:
            level = 1
            path = f"/{node_seq}"
            parent_id = None
        dept = Department(
            node_seq=node_seq, name=req.name, code=req.code, parent_id=parent_id,
            level=level, path=path, sort_order=req.sort_order, manager_id=req.manager_id,
        )
        async with self.db.begin():
            self.db.add(dept)
            await self.db.flush()
            await self.db.refresh(dept)
        await self.cache.invalidate()
        return dept

    async def update(self, dept_id: uuid.UUID, req: DepartmentUpdate) -> Department:
        dept = await self._get_or_404(dept_id)
        if req.code is not None and req.code != dept.code:
            if await self.repo.get_by_code(req.code) is not None:
                raise ConflictError("部门编码已存在")
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(dept, field, value)
        async with self.db.begin():
            await self.db.flush()
            await self.db.refresh(dept)
        await self.cache.invalidate()
        return dept

    async def delete(self, dept_id: uuid.UUID) -> None:
        dept = await self._get_or_404(dept_id)
        if await self.repo.count_children(dept_id) > 0:
            raise ConflictError("存在子部门,无法删除")
        if await self.repo.count_users(dept_id) > 0:
            raise ConflictError("存在关联用户,无法删除")
        from datetime import datetime, timezone

        dept.status = "INACTIVE"
        dept.deleted_at = datetime.now(timezone.utc)
        async with self.db.begin():
            await self.db.flush()
        await self.cache.invalidate()

    # move / get_tree / get_subtree / list_users 见 Task 7、Task 8
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: PASS(9 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/services/department_service.py tests/test_department_service.py
git commit -m "feat(dept): DepartmentService create/update/delete(含严格删除拒绝)"
```

---

## Task 7: DepartmentService — move

**Files:**
- Modify: `app/application/services/department_service.py`(补 `move`)
- Test: `tests/test_department_service.py`(追加 move 用例)

**Interfaces:**
- Produces:`async move(dept_id: uuid.UUID, new_parent_id: uuid.UUID | None) -> Department`。

- [ ] **Step 1: 写失败测试(追加)**

```python
# tests/test_department_service.py —— 末尾追加
async def test_move_subtree_updates_paths(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        be = await svc.create(DepartmentCreate(name="后端", code="BE", parent_id=rd.id))
        other = await svc.create(DepartmentCreate(name="销售", code="SL"))
        moved = await svc.move(rd.id, other.id)
        assert moved.parent_id == other.id
        assert moved.path == f"/{other.node_seq}/{rd.node_seq}" and moved.level == 2
        # 后代路径/层级跟随
        be_db = await db.get(Department, be.id)
        assert be_db.path == f"/{other.node_seq}/{rd.node_seq}/{be.node_seq}" and be_db.level == 3


async def test_move_to_root(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        moved = await svc.move(rd.id, None)
        assert moved.parent_id is None and moved.level == 1 and moved.path == f"/{rd.node_seq}"


async def test_move_circular_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        # 把 root 移到 rd 之下 → 循环
        with pytest.raises(BusinessException):
            await svc.move(root.id, rd.id)


async def test_move_exceeds_5levels_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        prev = await svc.create(DepartmentCreate(name="L1", code="C1"))
        for i in range(4):
            prev = await svc.create(DepartmentCreate(name=f"L{i+2}", code=f"C{i+2}", parent_id=prev.id))
        # prev.level==5;另起一棵 root2,把 prev 子树挂到 root2 下 → root2.level1, prev 变 2,后代变 6 → 超限
        root2 = await svc.create(DepartmentCreate(name="R2", code="R2"))
        with pytest.raises(BusinessException):
            await svc.move(prev.id, root2.id)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: 4 个新用例 FAIL(AttributeError: move 方法不存在)

- [ ] **Step 3: 实现 move(追加到 DepartmentService 类)**

```python
# app/application/services/department_service.py —— 在 delete 方法后追加
    async def move(self, dept_id: uuid.UUID, new_parent_id: uuid.UUID | None) -> Department:
        dept = await self._get_or_404(dept_id)
        old_path = dept.path
        old_level = dept.level

        if new_parent_id is None:
            new_parent = None
            new_level = 1
            new_prefix = f"/{dept.node_seq}"
        else:
            if new_parent_id == dept_id:
                raise BusinessException("不能将部门移动到自身之下")
            new_parent = await self.repo.get_by_id(new_parent_id)
            if new_parent is None:
                raise NotFoundError("父部门不存在")
            # 防循环:新父不能是自身或自身后代
            if new_parent.path == old_path or new_parent.path.startswith(old_path + "/"):
                raise BusinessException("不能形成循环依赖")
            new_level = new_parent.level + 1
            new_prefix = f"{new_parent.path}/{dept.node_seq}"

        # 深度校验:移动后子树最大深度不超过 5
        max_depth = await self.repo.max_descendant_depth(old_path, old_level)
        if new_level + max_depth > MAX_LEVEL:
            raise BusinessException("移动后层级超过 5 级限制")

        level_delta = new_level - old_level
        # 注意:replace_subtree_paths 用 dept.path 作为根前缀;先把自身 path 换好再批量
        async with self.db.begin():
            dept.parent_id = new_parent_id if new_parent else None
            dept.level = new_level
            dept.path = new_prefix
            await self.db.flush()
            # 批量更新后代(排除自身,自身已更新)
            await self.repo.replace_subtree_paths(
                old_prefix=old_path, new_prefix=new_prefix,
                level_delta=level_delta, root_path=old_path + "/",
            )
            await self.db.refresh(dept)
        await self.cache.invalidate()
        return dept
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: PASS(13 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/services/department_service.py tests/test_department_service.py
git commit -m "feat(dept): DepartmentService.move(防循环/深度校验/子树批量路径更新)"
```

---

## Task 8: DepartmentService — get_tree / get_subtree / list_users

**Files:**
- Modify: `app/application/services/department_service.py`(补方法)
- Modify: `app/application/schemas/department.py`(无需改,已有 TreeNode/Out)
- Test: `tests/test_department_service.py`(追加用例)

**Interfaces:**
- Produces:
  - `async get_tree() -> list[DepartmentTreeNode]`
  - `async get_subtree(root_id: uuid.UUID) -> list[DepartmentTreeNode]`
  - `async list_users(dept_id: uuid.UUID) -> list[UserOut]`

- [ ] **Step 1: 写失败测试(追加)**

```python
# tests/test_department_service.py —— 末尾追加
from app.application.schemas.department import DepartmentTreeNode
from app.application.schemas.user import UserOut


async def test_get_tree_nested(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        tree = await svc.get_tree()
        assert len(tree) == 1 and tree[0].code == "HQ"
        assert [c.code for c in tree[0].children] == ["RD"]


async def test_get_subtree(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        other = await svc.create(DepartmentCreate(name="销售", code="SL"))
        sub = await svc.get_subtree(root.id)
        assert len(sub) == 1 and sub[0].code == "HQ"
        assert [c.code for c in sub[0].children] == ["RD"]


async def test_get_tree_excludes_inactive(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        a = await svc.create(DepartmentCreate(name="A", code="A"))
        b = await svc.create(DepartmentCreate(name="B", code="B"))
        await svc.delete(a.id)
        tree = await svc.get_tree()
        assert [n.code for n in tree] == ["B"]


async def test_list_users(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        db.add(User(email="u1@t.com", password_hash=hash_password("X@1234567"),
                    first_name="U", last_name="L", department_id=root.id))
        db.add(User(email="u2@t.com", password_hash=hash_password("X@1234567"),
                    first_name="U2", last_name="L", department_id=root.id))
        await db.commit()
        users = await svc.list_users(root.id)
        assert {u.email for u in users} == {"u1@t.com", "u2@t.com"}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: 4 个新用例 FAIL

- [ ] **Step 3: 实现 get_tree/get_subtree/list_users(追加到类)**

```python
# app/application/services/department_service.py —— 顶部导入补充
from app.application.schemas.department import DepartmentTreeNode
from app.application.schemas.user import UserOut
from app.domain.models.user import User
from sqlalchemy import select

# —— 类内追加方法 ——
    @staticmethod
    def _build_tree(flat: list[Department]) -> list[DepartmentTreeNode]:
        nodes: dict[uuid.UUID, DepartmentTreeNode] = {}
        for d in flat:
            nodes[d.id] = DepartmentTreeNode(
                id=d.id, node_seq=d.node_seq, name=d.name, code=d.code,
                parent_id=d.parent_id, level=d.level, path=d.path,
                sort_order=d.sort_order, manager_id=d.manager_id, status=d.status,
                created_at=d.created_at, updated_at=d.updated_at, children=[],
            )
        roots: list[DepartmentTreeNode] = []
        for d in flat:
            node = nodes[d.id]
            if d.parent_id is not None and d.parent_id in nodes:
                nodes[d.parent_id].children.append(node)
            else:
                roots.append(node)
        return roots

    async def get_tree(self) -> list[DepartmentTreeNode]:
        cached = await self.cache.get_tree()
        if cached is not None:
            return [DepartmentTreeNode.model_validate(n) for n in cached]
        flat = await self.repo.list_active()
        tree = self._build_tree(flat)
        await self.cache.set_tree([n.model_dump() for n in tree])
        return tree

    async def get_subtree(self, root_id: uuid.UUID) -> list[DepartmentTreeNode]:
        root = await self._get_or_404(root_id)
        flat = await self.repo.find_subtree(root.path)
        # 以 root 为根组装
        nodes: dict[uuid.UUID, DepartmentTreeNode] = {}
        for d in flat:
            nodes[d.id] = DepartmentTreeNode(
                id=d.id, node_seq=d.node_seq, name=d.name, code=d.code,
                parent_id=d.parent_id, level=d.level, path=d.path,
                sort_order=d.sort_order, manager_id=d.manager_id, status=d.status,
                created_at=d.created_at, updated_at=d.updated_at, children=[],
            )
        roots: list[DepartmentTreeNode] = []
        for d in flat:
            node = nodes[d.id]
            if d.id == root.id:
                roots.append(node)
            elif d.parent_id is not None and d.parent_id in nodes:
                nodes[d.parent_id].children.append(node)
        return roots

    async def list_users(self, dept_id: uuid.UUID) -> list[UserOut]:
        await self._get_or_404(dept_id)
        result = await self.db.execute(select(User).where(User.department_id == dept_id))
        return [UserOut.model_validate(u) for u in result.scalars().all()]
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: PASS(17 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/services/department_service.py tests/test_department_service.py
git commit -m "feat(dept): DepartmentService.get_tree/get_subtree/list_users(Cache Aside)"
```

---

## Task 9: API 路由 + main 注册 + seed 扩展

**Files:**
- Create: `app/interfaces/api/departments.py`
- Modify: `app/main.py`(注册路由)
- Modify: `tests/conftest.py`(seed 加 dept:* 权限 + cache override)
- Test: `tests/test_departments_api.py`

**Interfaces:**
- Consumes: `DepartmentService`、`get_department_cache`、`get_db`、`require_permission`、schemas。
- Produces:路由前缀 `/api/v1/departments`,端点见 spec §7。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_departments_api.py
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

DEPT = {"name": "总部", "code": "HQ"}


async def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def test_create_and_get_tree(client, admin_token):
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    assert resp.status_code == 201, resp.text
    assert resp.json()["level"] == 1
    tree = await client.get("/api/v1/departments/tree", headers=await _h(admin_token))
    assert tree.status_code == 200
    assert tree.json()[0]["code"] == "HQ"


async def test_create_code_conflict(client, admin_token):
    await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    assert resp.status_code == 409


async def test_move_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    sl = (await client.post("/api/v1/departments", json={"name": "销售", "code": "SL"},
                            headers=await _h(admin_token))).json()
    rd = (await client.post("/api/v1/departments",
                            json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
                            headers=await _h(admin_token))).json()
    resp = await client.post(f"/api/v1/departments/{rd['id']}/move",
                             json={"parent_id": sl["id"]}, headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["parent_id"] == sl["id"]


async def test_delete_with_children_409(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    await client.post("/api/v1/departments",
                      json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
                      headers=await _h(admin_token))
    resp = await client.delete(f"/api/v1/departments/{hq['id']}", headers=await _h(admin_token))
    assert resp.status_code == 409


async def test_regular_user_forbidden(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
    assert reg.status_code == 201
    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
    token = login.json()["access_token"]
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(token))
    assert resp.status_code == 403


async def test_list_users_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    resp = await client.get(f"/api/v1/departments/{hq['id']}/users", headers=await _h(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_departments_api.py -v`
Expected: FAIL(`ModuleNotFoundError` 或 404)

- [ ] **Step 3: 扩展 conftest seed(dept 权限 + ADMIN 绑定 + cache override)**

```python
# tests/conftest.py —— 修改 seed fixture 的 perms 列表,在末尾追加 dept 权限
    perms = [
        Permission(name="用户读取", code="user:read", type="ACTION", resource="user", action="read"),
        Permission(name="用户创建", code="user:create", type="ACTION", resource="user", action="create"),
        Permission(name="用户更新", code="user:update", type="ACTION", resource="user", action="update"),
        Permission(name="用户删除", code="user:delete", type="ACTION", resource="user", action="delete"),
        Permission(name="用户分配角色", code="user:assign_role", type="ACTION", resource="user", action="assign_role"),
        Permission(name="部门读取", code="dept:read", type="ACTION", resource="dept", action="read"),
        Permission(name="部门创建", code="dept:create", type="ACTION", resource="dept", action="create"),
        Permission(name="部门更新", code="dept:update", type="ACTION", resource="dept", action="update"),
        Permission(name="部门删除", code="dept:delete", type="ACTION", resource="dept", action="delete"),
    ]
```

```python
# tests/conftest.py —— 在 client fixture 内 dependency_overrides 增加 cache override
    from app.core.cache import NoopDepartmentCache, get_department_cache
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
```
> 注:`get_department_cache` 是 async 依赖,覆盖用同步 lambda 返回 Noop 实例即可(FastAPI 接受同步依赖函数)。在 `app.dependency_overrides.clear()` 之前生效。

- [ ] **Step 4: 实现路由**

```python
# app/interfaces/api/departments.py
"""部门路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.department import (
    DepartmentCreate, DepartmentListOut, DepartmentMove, DepartmentOut,
    DepartmentTreeNode, DepartmentUpdate,
)
from app.application.services.department_service import DepartmentService
from app.core.cache import DepartmentCache, get_department_cache
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.department_repository import DepartmentRepository

router = APIRouter(prefix="/departments", tags=["departments"])


def _svc(db: AsyncSession, cache: DepartmentCache) -> DepartmentService:
    return DepartmentService(db, DepartmentRepository(db), cache)


@router.get("/tree", response_model=list[DepartmentTreeNode])
async def get_tree(
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> list[DepartmentTreeNode]:
    return await _svc(db, cache).get_tree()


@router.get("/{dept_id}/subtree", response_model=list[DepartmentTreeNode])
async def get_subtree(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> list[DepartmentTreeNode]:
    return await _svc(db, cache).get_subtree(dept_id)


@router.get("", response_model=DepartmentListOut)
async def list_departments(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> DepartmentListOut:
    svc = _svc(db, cache)
    flat = await svc.repo.list_active()
    start = (page - 1) * size
    items = flat[start:start + size]
    return DepartmentListOut(
        items=[DepartmentOut.model_validate(d) for d in items],
        total=len(flat), page=page, size=size,
    )


@router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> DepartmentOut:
    svc = _svc(db, cache)
    dept = await svc.repo.get_by_id(dept_id)
    if dept is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("部门不存在")
    return DepartmentOut.model_validate(dept)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    req: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:create")),
) -> DepartmentOut:
    dept = await _svc(db, cache).create(req)
    return DepartmentOut.model_validate(dept)


@router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: uuid.UUID,
    req: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:update")),
) -> DepartmentOut:
    return DepartmentOut.model_validate(await _svc(db, cache).update(dept_id, req))


@router.post("/{dept_id}/move", response_model=DepartmentOut)
async def move_department(
    dept_id: uuid.UUID,
    req: DepartmentMove,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:update")),
) -> DepartmentOut:
    return DepartmentOut.model_validate(await _svc(db, cache).move(dept_id, req.parent_id))


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:delete")),
) -> None:
    await _svc(db, cache).delete(dept_id)


@router.get("/{dept_id}/users", response_model=list)
async def list_dept_users(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
):
    from app.application.schemas.user import UserOut
    return await _svc(db, cache).list_users(dept_id)
```

- [ ] **Step 5: main.py 注册路由**

```python
# app/main.py —— 在 from app.interfaces.api import auth, health, users 之后追加 departments
from app.interfaces.api import auth, departments, health, users

# 在 app.include_router(users.router, prefix=settings.API_V1_PREFIX) 之后追加
    app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
```

- [ ] **Step 6: 运行测试确认通过**

Run: `uv run pytest tests/test_departments_api.py -v`
Expected: PASS(6 passed)

- [ ] **Step 7: 提交**

```bash
git add app/interfaces/api/departments.py app/main.py tests/conftest.py tests/test_departments_api.py
git commit -m "feat(dept): 部门 API 路由 + main 注册 + seed dept 权限"
```

---

## Task 10: 全量回归 + 覆盖率 + ruff

**Files:** 无新增(验证性任务)

- [ ] **Step 1: 全量测试 + 覆盖率**

Run: `uv run pytest --cov=app --cov-report=term-missing`
Expected: 全部 PASS;`app.application.services.department_service`、`app.repositories.department_repository`、`app.interfaces.api.departments` 覆盖率 ≥ 85%;TOTAL ≥ 85%。

- [ ] **Step 2: ruff 检查**

Run: `uv run ruff check app tests`
Expected: 无 error(若有 E501 等,按提示修复:换行/缩短)。

- [ ] **Step 3: 修复任何失败后再次运行**

如 Step 1/2 失败,修复后重跑直至 PASS 且无 ruff error。

- [ ] **Step 4: 提交(如有修复)**

```bash
git add -A
git commit -m "test(dept): 全量回归通过,覆盖率≥85%,ruff 清零"
```

- [ ] **Step 5: 验证 OpenAPI 文档可访问(可选冒烟)**

Run: `uv run python -c "from app.main import app; print([r.path for r in app.routes if 'departments' in getattr(r,'path','')])"`
Expected: 输出包含 `/api/v1/departments`、`/api/v1/departments/tree`、`/api/v1/departments/{dept_id}/move` 等。

---

## Self-Review 结论

**Spec coverage**:
- §3 模块边界 → Task 1-9 文件结构对应 ✓
- §4 数据模型 → Task 1 ✓
- §5 缓存层 → Task 3、Task 4 ✓
- §6 业务层(create/update/move/delete/get_tree/get_subtree/list_users)→ Task 6、7、8 ✓
- §7 API → Task 9 ✓
- §8 错误处理 → 各 service 任务内异常 + Task 9 路由 ✓
- §9 测试矩阵 → Task 6-9 测试覆盖矩阵各用例 ✓

**Placeholder scan**:无 TBD/TODO;每步含完整代码与命令。

**Type consistency**:`DepartmentCache` 方法名、`DepartmentRepository` 方法名、`DepartmentService` 方法签名、schema 类名在各任务间一致;`move(dept_id, new_parent_id)` 与路由 `DepartmentMove.parent_id` 对齐;`list_users` 返回 `UserOut` 与 `app.application.schemas.user.UserOut` 一致。