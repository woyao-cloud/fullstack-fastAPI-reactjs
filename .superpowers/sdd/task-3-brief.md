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

