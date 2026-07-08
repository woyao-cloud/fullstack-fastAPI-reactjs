# app/core/config_cache.py
"""系统配置缓存抽象 + 多级缓存(L1:LocalTTLCache + L2:Redis) + 工厂."""

from __future__ import annotations

import logging
from typing import Protocol, runtime_checkable

from cachetools import TTLCache

from app.core.config import settings

logger = logging.getLogger(__name__)

L1_TTL = settings.CACHE_CONFIG_TTL
L2_TTL = L1_TTL * 2  # L2 缓存 TTL 为 L1 的两倍


@runtime_checkable
class ConfigCache(Protocol):
    async def get_group(self, group: str) -> dict | None: ...
    async def set_group(self, group: str, values: dict) -> None: ...
    async def invalidate(self, group: str | None = None) -> None: ...
    async def start_subscriber(self) -> None: ...


class LocalTTLCache:
    """L1 本地缓存: cachetools TTLCache, 进程内最快."""

    def __init__(self) -> None:
        self._store: TTLCache = TTLCache(maxsize=128, ttl=L1_TTL)

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


class MultiLevelConfigCache:
    """L1(LocalTTLCache) + L2(Redis) 多级缓存.

    读: L1 → MISS → L2 → MISS → DB
    写: L2 → L1 (同时更新)
    失效: L1 + L2 同时清除
    """

    def __init__(self, l1: LocalTTLCache, l2: ConfigCache) -> None:
        self.l1 = l1
        self.l2 = l2

    async def get_group(self, group: str) -> dict | None:
        # L1 命中直接返回
        val = await self.l1.get_group(group)
        if val is not None:
            return val
        # L2 命中 → 回填 L1
        val = await self.l2.get_group(group)
        if val is not None:
            await self.l1.set_group(group, val)
        return val

    async def set_group(self, group: str, values: dict) -> None:
        await self.l2.set_group(group, values)
        await self.l1.set_group(group, values)

    async def invalidate(self, group: str | None = None) -> None:
        await self.l1.invalidate(group)
        await self.l2.invalidate(group)

    async def start_subscriber(self) -> None:
        return await self.l2.start_subscriber()


_local_singleton = LocalTTLCache()
_redis_singleton: ConfigCache | None = None


async def _build_redis_or_fallback() -> ConfigCache:
    try:
        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client

        redis_cache = RedisPubSubConfigCache(await build_redis_client())
        return MultiLevelConfigCache(_local_singleton, redis_cache)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
        return _local_singleton


async def get_config_cache() -> ConfigCache:
    global _redis_singleton
    if not settings.CONFIG_CACHE_ENABLED:
        return _local_singleton
    if _redis_singleton is not None:
        return _redis_singleton
    _redis_singleton = await _build_redis_or_fallback()
    return _redis_singleton