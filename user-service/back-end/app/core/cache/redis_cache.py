"""Redis 部门缓存实现 + Pipeline 批量操作."""

from __future__ import annotations

import json
import logging

from redis.asyncio import Redis

from app.core.cache import DepartmentCache
from app.core.config import settings

logger = logging.getLogger(__name__)

TREE_KEY = "um:dept:tree"
SUBTREE_PREFIX = "um:dept:subtree:"
TTL_SECONDS = settings.CACHE_DEPT_TREE_TTL


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
            async with self.client.pipeline(transaction=True) as pipe:
                pipe.delete(TREE_KEY)
                _, keys = await self.client.scan(match=SUBTREE_PREFIX + "*")
                if keys:
                    decoded = [k.decode() if isinstance(k, bytes) else k for k in keys]
                    pipe.delete(*decoded)
                await pipe.execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache invalidate 失败,降级: %s", exc)

    async def mget_subtree_ids(self, root_seqs: list[str]) -> dict[str, list[str] | None]:
        """Pipeline 批量获取子树 ID."""
        try:
            async with self.client.pipeline(transaction=False) as pipe:
                keys = [SUBTREE_PREFIX + s for s in root_seqs]
                for k in keys:
                    pipe.get(k)
                results = await pipe.execute()
            return {seq: json.loads(r) if r else None for seq, r in zip(root_seqs, results, strict=False)}
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache mget_subtree_ids 失败,降级: %s", exc)
            return {}

    async def mset_subtree_ids(self, items: dict[str, list[str]]) -> None:
        """Pipeline 批量设置子树 ID."""
        try:
            async with self.client.pipeline(transaction=False) as pipe:
                for seq, ids in items.items():
                    pipe.set(SUBTREE_PREFIX + seq, json.dumps(ids), ex=TTL_SECONDS)
                await pipe.execute()
        except Exception as exc:  # noqa: BLE001
            logger.warning("dept cache mset_subtree_ids 失败,降级: %s", exc)