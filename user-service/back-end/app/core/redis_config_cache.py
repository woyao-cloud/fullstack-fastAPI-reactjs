# app/core/redis_config_cache.py
"""Redis pub/sub 配置缓存(组合 LocalTTLCache + 跨 worker 即时失效)."""

from __future__ import annotations

import asyncio
import logging

from redis.asyncio import Redis

from app.core.config_cache import LocalTTLCache

logger = logging.getLogger(__name__)
CHANNEL = "config-change"


async def build_redis_client() -> Redis:
    from app.core.config import settings

    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    await client.ping()
    return client


class RedisPubSubConfigCache:
    def __init__(self, client: Redis):
        self._local = LocalTTLCache()
        self._redis = client

    async def get_group(self, group: str) -> dict | None:
        return await self._local.get_group(group)

    async def set_group(self, group: str, values: dict) -> None:
        await self._local.set_group(group, values)

    async def invalidate(self, group: str | None = None) -> None:
        await self._local.invalidate(group)
        try:
            await self._redis.publish(CHANNEL, group or "*")
        except Exception as exc:  # noqa: BLE001
            logger.warning("config cache publish 失败,降级: %s", exc)

    async def start_subscriber(self) -> None:
        pubsub = self._redis.pubsub()
        try:
            await pubsub.subscribe(CHANNEL)
            while True:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg is None:
                    await asyncio.sleep(0.05)
                    continue
                type_ = msg.get("type") if isinstance(msg, dict) else getattr(msg, "type", None)
                if type_ != "message":
                    continue
                group = msg.get("data") if isinstance(msg, dict) else getattr(msg, "data", None)
                if group in (None, "*"):
                    await self._local.invalidate()
                else:
                    await self._local.invalidate(group)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("config cache 订阅断开,降级为本地 TTL: %s", exc)
        finally:
            close = getattr(pubsub, "aclose", None) or getattr(pubsub, "close", None)
            if close is not None:
                await close()