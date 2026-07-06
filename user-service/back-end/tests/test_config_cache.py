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


class FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}
        self.published: list[tuple[str, str]] = []
        self._subs: list = []

    async def get(self, key):
        return self.store.get(key)

    async def set(self, key, value, ex=None):
        self.store[key] = value

    async def publish(self, channel, message):
        self.published.append((channel, message))

    def pubsub(self):
        class _PubSub:
            def __init__(self, parent):
                self.parent = parent
                self._queue: list = []

            async def subscribe(self, *channels):
                self.parent._subs.append(self)

            async def get_message(self, ignore_subscribe_messages=True, timeout=None):
                if self._queue:
                    return self._queue.pop(0)
                return None

            def push(self, channel, message):
                import types
                self._queue.append(types.SimpleNamespace(type="message", channel=channel, data=message))

            async def close(self):
                pass

        return _PubSub(self)

    async def ping(self):
        return True

    async def close(self):
        pass


async def test_redis_cache_uses_local_and_publishes_invalidate():
    from app.core.redis_config_cache import RedisPubSubConfigCache
    cache = RedisPubSubConfigCache(FakeRedis())
    await cache.set_group("MAIL", {"host": "smtp"})
    assert await cache.get_group("MAIL") == {"host": "smtp"}
    await cache.invalidate("MAIL")
    assert await cache.get_group("MAIL") is None
    assert ("config-change", "MAIL") in cache._redis.published  # noqa: SLF001


async def test_redis_cache_subscriber_invalidates_local():
    import asyncio

    from app.core.redis_config_cache import RedisPubSubConfigCache

    fake = FakeRedis()
    cache = RedisPubSubConfigCache(fake)
    await cache.set_group("MAIL", {"host": "smtp"})
    # 启动订阅 task
    task = asyncio.create_task(cache.start_subscriber())
    await asyncio.sleep(0.05)  # 让订阅注册
    assert fake._subs, "subscriber registered"  # noqa: SLF001
    # 模拟收到失效消息
    fake._subs[0].push("config-change", "MAIL")
    await asyncio.sleep(0.05)
    assert await cache.get_group("MAIL") is None  # 本地被失效
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass