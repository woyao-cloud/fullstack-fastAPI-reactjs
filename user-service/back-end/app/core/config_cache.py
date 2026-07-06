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