## commits 190fef4..aa33717
aa33717 feat(cache): DepartmentCache 协议 + Noop 降级 + 工厂与 CACHE_ENABLED

## stat
 user-service/back-end/app/core/cache/__init__.py | 61 ++++++++++++++++++++++++
 user-service/back-end/app/core/config.py         |  3 ++
 user-service/back-end/tests/test_cache.py        | 28 +++++++++++
 3 files changed, 92 insertions(+)

## diff -U10
diff --git a/user-service/back-end/app/core/cache/__init__.py b/user-service/back-end/app/core/cache/__init__.py
new file mode 100644
index 0000000..a2bd579
--- /dev/null
+++ b/user-service/back-end/app/core/cache/__init__.py
@@ -0,0 +1,61 @@
+"""部门缓存抽象 + Noop 降级 + 工厂."""
+
+from __future__ import annotations
+
+import logging
+from typing import Protocol, runtime_checkable
+
+from app.core.config import settings
+
+logger = logging.getLogger(__name__)
+
+
+@runtime_checkable
+class DepartmentCache(Protocol):
+    async def get_tree(self) -> list[dict] | None: ...
+    async def set_tree(self, nodes: list[dict]) -> None: ...
+    async def get_subtree_ids(self, root_seq: str) -> list[str] | None: ...
+    async def set_subtree_ids(self, root_seq: str, ids: list[str]) -> None: ...
+    async def invalidate(self) -> None: ...
+
+
+class NoopDepartmentCache:
+    """无操作缓存:全部 MISS,等价直查 DB。"""
+
+    async def get_tree(self) -> list[dict] | None:
+        return None
+
+    async def set_tree(self, nodes: list[dict]) -> None:
+        return None
+
+    async def get_subtree_ids(self, root_seq: str) -> list[str] | None:
+        return None
+
+    async def set_subtree_ids(self, root_seq: str, ids: list[str]) -> None:
+        return None
+
+    async def invalidate(self) -> None:
+        return None
+
+
+_noop_singleton = NoopDepartmentCache()
+_redis_singleton: DepartmentCache | None = None
+
+
+async def get_department_cache() -> DepartmentCache:
+    """FastAPI 依赖:依 CACHE_ENABLED 与 Redis 可用性返回缓存实现。"""
+    global _redis_singleton
+    if not settings.CACHE_ENABLED:
+        return _noop_singleton
+    if _redis_singleton is not None:
+        return _redis_singleton
+    # 启动期探测 Redis(失败降级 Noop);Redis 实现见 Task 4
+    try:
+        from app.core.cache.redis_cache import RedisDepartmentCache, build_redis_client
+
+        client = await build_redis_client()
+        _redis_singleton = RedisDepartmentCache(client)
+    except Exception as exc:  # noqa: BLE001
+        logger.warning("Redis 不可用,降级为 Noop 缓存: %s", exc)
+        _redis_singleton = _noop_singleton
+    return _redis_singleton
\ No newline at end of file
diff --git a/user-service/back-end/app/core/config.py b/user-service/back-end/app/core/config.py
index 8851daf..5041d52 100644
--- a/user-service/back-end/app/core/config.py
+++ b/user-service/back-end/app/core/config.py
@@ -25,17 +25,20 @@ class Settings(BaseSettings):
     JWT_ALGORITHM: str = "HS256"
     ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
     REFRESH_TOKEN_EXPIRE_DAYS: int = 7
 
     # 密码策略
     PASSWORD_MIN_LENGTH: int = 8
 
     # Redis（可选，测试不依赖）
     REDIS_URL: str = "redis://localhost:6379/0"
 
+    # 缓存开关(测试置 False 强制 Noop 降级)
+    CACHE_ENABLED: bool = True
+
 
 @lru_cache(maxsize=1)
 def get_settings() -> Settings:
     return Settings()
 
 
 settings = get_settings()
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_cache.py b/user-service/back-end/tests/test_cache.py
new file mode 100644
index 0000000..0899c39
--- /dev/null
+++ b/user-service/back-end/tests/test_cache.py
@@ -0,0 +1,28 @@
+# tests/test_cache.py
+from __future__ import annotations
+
+import pytest
+
+from app.core.cache import DepartmentCache, NoopDepartmentCache, get_department_cache
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_noop_miss_and_noop():
+    cache = NoopDepartmentCache()
+    assert await cache.get_tree() is None
+    assert await cache.get_subtree_ids("1") is None
+    await cache.set_tree([{"x": 1}])      # 不抛错
+    await cache.set_subtree_ids("1", ["a"])
+    await cache.invalidate()
+
+
+async def test_department_cache_is_protocol():
+    assert isinstance(NoopDepartmentCache(), DepartmentCache)  # Protocol 结构兼容
+
+
+async def test_factory_returns_noop_when_disabled(monkeypatch):
+    from app.core.config import settings
+    monkeypatch.setattr(settings, "CACHE_ENABLED", False)
+    cache = await get_department_cache()
+    assert isinstance(cache, NoopDepartmentCache)
\ No newline at end of file
