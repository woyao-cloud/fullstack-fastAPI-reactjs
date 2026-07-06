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