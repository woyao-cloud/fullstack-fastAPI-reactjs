## Task 4: ConfigCache 协议 + LocalTTLCache + 工厂

**Files:**
- Create: `app/core/config_cache.py`
- Test: `tests/test_config_cache.py`

**Interfaces:**
- Produces: `ConfigCache`(Protocol):`get_group(group)->dict|None`、`set_group(group, values)`、`invalidate(group=None)`、`start_subscriber()`;`LocalTTLCache`(cachetools TTLCache,TTL 60s);`get_config_cache()`(async 依赖,`CONFIG_CACHE_ENABLED=False` 或 Redis 不可用→`LocalTTLCache`)。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_config_cache.py
from __future__ import annotations

import pytest

from app.core.config_cache import ConfigCache, LocalTTLCache, get_config_cache

pytestmark = pytest.mark.asyncio


async def test_local_cache_miss_and_set():
    cache = LocalTTLCache()
    assert await cache.get_group("MAIL") is None
    await cache.set_group("MAIL", {"host": "smtp"})
    assert await cache.get_group("MAIL") == {"host": "smtp"}


async def test_local_cache_invalidate():
    cache = LocalTTLCache()
    await cache.set_group("MAIL", {"a": 1})
    await cache.set_group("SECURITY", {"b": 2})
    await cache.invalidate("MAIL")
    assert await cache.get_group("MAIL") is None
    assert await cache.get_group("SECURITY") == {"b": 2}
    await cache.invalidate()  # 全清
    assert await cache.get_group("SECURITY") is None


async def test_local_cache_start_subscriber_noop():
    cache = LocalTTLCache()
    await cache.start_subscriber()  # 不抛错


async def test_factory_returns_local_when_disabled(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
    cache = await get_config_cache()
    assert isinstance(cache, LocalTTLCache)


def test_protocol_compat():
    assert isinstance(LocalTTLCache(), ConfigCache)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_config_cache.py -v`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现**

```python
# app/core/config_cache.py
"""系统配置缓存抽象 + 本地 TTL + 工厂(Redis 实现见 Task 5)."""

from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

from cachetools import TTLCache

from app.core.config import settings

logger = logging.getLogger(__name__)

TTL_SECONDS = 60


@runtime_checkable
class ConfigCache(Protocol):
    async def get_group(self, group: str) -> dict | None: ...
    async def set_group(self, group: str, values: dict) -> None: ...
    async def invalidate(self, group: str | None = None) -> None: ...
    async def start_subscriber(self) -> None: ...


class LocalTTLCache:
    def __init__(self) -> None:
        self._store: TTLCache = TTLCache(maxsize=128, ttl=TTL_SECONDS)

    async def get_group(self, group: str) -> dict | None:
        return self._store.get(group)

    async def set_group(self, group: str, values: dict) -> None:
        self._store[group] = values

    async def invalidate(self, group: str | None = None) -> None:
        if group is None:
            self._store.clear()
        else:
            self._store.pop(group, None)

    async def start_subscriber(self) -> None:
        return None


_local_singleton = LocalTTLCache()
_redis_singleton: ConfigCache | None = None


async def get_config_cache() -> ConfigCache:
    global _redis_singleton
    if not settings.CONFIG_CACHE_ENABLED:
        return _local_singleton
    if _redis_singleton is not None:
        return _redis_singleton
    try:
        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client

        client = await build_redis_client()
        _redis_singleton = RedisPubSubConfigCache(client)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
        _redis_singleton = _local_singleton
    return _redis_singleton
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_config_cache.py -v`
Expected: PASS(5 passed);全量无回归。

- [ ] **Step 5: 提交**

```bash
git add app/core/config_cache.py tests/test_config_cache.py
git commit -m "feat(config): ConfigCache 协议 + LocalTTLCache + 工厂"
```

---

