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