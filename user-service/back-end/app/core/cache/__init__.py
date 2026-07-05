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