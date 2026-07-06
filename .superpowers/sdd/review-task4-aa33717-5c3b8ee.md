## commits aa33717..5c3b8ee
5c3b8ee feat(cache): RedisDepartmentCache(key 规约/序列化/降级)

## stat
 .../back-end/app/core/cache/redis_cache.py         | 66 ++++++++++++++++++++++
 user-service/back-end/tests/test_cache.py          | 55 +++++++++++++++++-
 2 files changed, 120 insertions(+), 1 deletion(-)

## diff -U10
diff --git a/user-service/back-end/app/core/cache/redis_cache.py b/user-service/back-end/app/core/cache/redis_cache.py
new file mode 100644
index 0000000..59ff833
--- /dev/null
+++ b/user-service/back-end/app/core/cache/redis_cache.py
@@ -0,0 +1,66 @@
+"""Redis 部门缓存实现."""
+
+from __future__ import annotations
+
+import json
+import logging
+
+from redis.asyncio import Redis
+
+from app.core.cache import DepartmentCache
+
+logger = logging.getLogger(__name__)
+
+TREE_KEY = "um:dept:tree"
+SUBTREE_PREFIX = "um:dept:subtree:"
+TTL_SECONDS = 30 * 60
+
+
+async def build_redis_client() -> Redis:
+    from app.core.config import settings
+
+    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
+    await client.ping()
+    return client
+
+
+class RedisDepartmentCache(DepartmentCache):
+    def __init__(self, client: Redis):
+        self.client = client
+
+    async def get_tree(self) -> list[dict] | None:
+        try:
+            raw = await self.client.get(TREE_KEY)
+            return json.loads(raw) if raw else None
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("dept cache get_tree 失败,降级: %s", exc)
+            return None
+
+    async def set_tree(self, nodes: list[dict]) -> None:
+        try:
+            await self.client.set(TREE_KEY, json.dumps(nodes), ex=TTL_SECONDS)
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("dept cache set_tree 失败,降级: %s", exc)
+
+    async def get_subtree_ids(self, root_seq: str) -> list[str] | None:
+        try:
+            raw = await self.client.get(SUBTREE_PREFIX + root_seq)
+            return json.loads(raw) if raw else None
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("dept cache get_subtree_ids 失败,降级: %s", exc)
+            return None
+
+    async def set_subtree_ids(self, root_seq: str, ids: list[str]) -> None:
+        try:
+            await self.client.set(SUBTREE_PREFIX + root_seq, json.dumps(ids), ex=TTL_SECONDS)
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("dept cache set_subtree_ids 失败,降级: %s", exc)
+
+    async def invalidate(self) -> None:
+        try:
+            await self.client.delete(TREE_KEY)
+            _, keys = await self.client.scan(match=SUBTREE_PREFIX + "*")
+            if keys:
+                await self.client.delete(*[k.decode() if isinstance(k, bytes) else k for k in keys])
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("dept cache invalidate 失败,降级: %s", exc)
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_cache.py b/user-service/back-end/tests/test_cache.py
index 0899c39..be9185e 100644
--- a/user-service/back-end/tests/test_cache.py
+++ b/user-service/back-end/tests/test_cache.py
@@ -18,11 +18,64 @@ async def test_noop_miss_and_noop():
 
 
 async def test_department_cache_is_protocol():
     assert isinstance(NoopDepartmentCache(), DepartmentCache)  # Protocol 结构兼容
 
 
 async def test_factory_returns_noop_when_disabled(monkeypatch):
     from app.core.config import settings
     monkeypatch.setattr(settings, "CACHE_ENABLED", False)
     cache = await get_department_cache()
-    assert isinstance(cache, NoopDepartmentCache)
\ No newline at end of file
+    assert isinstance(cache, NoopDepartmentCache)
+
+
+# tests/test_cache.py —— 末尾追加
+import json
+
+
+class FakeRedis:
+    """内存 async redis 替身(仅本任务需要的命令)。"""
+
+    def __init__(self):
+        self.store: dict[str, str] = {}
+
+    async def get(self, key):
+        return self.store.get(key)
+
+    async def set(self, key, value, ex=None):
+        self.store[key] = value
+
+    async def delete(self, *keys):
+        for k in keys:
+            self.store.pop(k, None)
+
+    async def scan(self, cursor=0, match=None, count=None):
+        keys = [k.encode() for k in self.store if match is None or k.startswith(match.rstrip("*"))]
+        return (0, keys)
+
+
+async def test_redis_cache_set_get_tree():
+    from app.core.cache.redis_cache import RedisDepartmentCache
+    cache = RedisDepartmentCache(FakeRedis())
+    nodes = [{"id": "1", "children": [{"id": "2"}]}]
+    await cache.set_tree(nodes)
+    got = await cache.get_tree()
+    assert got == nodes
+
+
+async def test_redis_cache_invalidate_clears_keys():
+    from app.core.cache.redis_cache import RedisDepartmentCache
+    fake = FakeRedis()
+    cache = RedisDepartmentCache(fake)
+    await cache.set_tree([{"id": "1"}])
+    await cache.set_subtree_ids("1", ["1", "2"])
+    await cache.invalidate()
+    assert "um:dept:tree" not in fake.store
+    assert all(not k.startswith("um:dept:subtree:") for k in fake.store)
+
+
+async def test_redis_cache_subtree_ids_roundtrip():
+    from app.core.cache.redis_cache import RedisDepartmentCache
+    cache = RedisDepartmentCache(FakeRedis())
+    assert await cache.get_subtree_ids("1") is None
+    await cache.set_subtree_ids("1", ["1", "2", "3"])
+    assert await cache.get_subtree_ids("1") == ["1", "2", "3"]
\ No newline at end of file
