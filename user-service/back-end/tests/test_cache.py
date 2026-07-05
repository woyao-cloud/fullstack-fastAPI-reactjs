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