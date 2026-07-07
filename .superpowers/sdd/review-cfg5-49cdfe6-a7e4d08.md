## commits 49cdfe6..a7e4d08
a7e4d08 feat(config): RedisPubSubConfigCache(pub/sub 即时失效)

## stat
 .../back-end/app/core/redis_config_cache.py        | 63 +++++++++++++++++
 user-service/back-end/tests/test_config_cache.py   | 80 +++++++++++++++++++++-
 2 files changed, 142 insertions(+), 1 deletion(-)

## diff -U10
diff --git a/user-service/back-end/app/core/redis_config_cache.py b/user-service/back-end/app/core/redis_config_cache.py
new file mode 100644
index 0000000..709b344
--- /dev/null
+++ b/user-service/back-end/app/core/redis_config_cache.py
@@ -0,0 +1,63 @@
+# app/core/redis_config_cache.py
+"""Redis pub/sub 配置缓存(组合 LocalTTLCache + 跨 worker 即时失效)."""
+
+from __future__ import annotations
+
+import asyncio
+import logging
+
+from redis.asyncio import Redis
+
+from app.core.config_cache import LocalTTLCache
+
+logger = logging.getLogger(__name__)
+CHANNEL = "config-change"
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
+class RedisPubSubConfigCache:
+    def __init__(self, client: Redis):
+        self._local = LocalTTLCache()
+        self._redis = client
+
+    async def get_group(self, group: str) -> dict | None:
+        return await self._local.get_group(group)
+
+    async def set_group(self, group: str, values: dict) -> None:
+        await self._local.set_group(group, values)
+
+    async def invalidate(self, group: str | None = None) -> None:
+        await self._local.invalidate(group)
+        try:
+            await self._redis.publish(CHANNEL, group or "*")
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("config cache publish 失败,降级: %s", exc)
+
+    async def start_subscriber(self) -> None:
+        try:
+            pubsub = self._redis.pubsub()
+            await pubsub.subscribe(CHANNEL)
+            while True:
+                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
+                if msg is None:
+                    await asyncio.sleep(0.05)
+                    continue
+                type_ = msg.get("type") if isinstance(msg, dict) else getattr(msg, "type", None)
+                if type_ != "message":
+                    continue
+                group = msg.get("data") if isinstance(msg, dict) else getattr(msg, "data", None)
+                if group in (None, "*"):
+                    await self._local.invalidate()
+                else:
+                    await self._local.invalidate(group)
+        except asyncio.CancelledError:
+            raise
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("config cache 订阅断开,降级为本地 TTL: %s", exc)
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_config_cache.py b/user-service/back-end/tests/test_config_cache.py
index b27ffc3..ba9a3bb 100644
--- a/user-service/back-end/tests/test_config_cache.py
+++ b/user-service/back-end/tests/test_config_cache.py
@@ -32,11 +32,89 @@ async def test_local_cache_start_subscriber_noop():
 
 
 async def test_factory_returns_local_when_disabled(monkeypatch):
     from app.core.config import settings
     monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
     cache = await get_config_cache()
     assert isinstance(cache, LocalTTLCache)
 
 
 def test_protocol_compat():
-    assert isinstance(LocalTTLCache(), ConfigCache)
\ No newline at end of file
+    assert isinstance(LocalTTLCache(), ConfigCache)
+
+
+class FakeRedis:
+    def __init__(self):
+        self.store: dict[str, str] = {}
+        self.published: list[tuple[str, str]] = []
+        self._subs: list = []
+
+    async def get(self, key):
+        return self.store.get(key)
+
+    async def set(self, key, value, ex=None):
+        self.store[key] = value
+
+    async def publish(self, channel, message):
+        self.published.append((channel, message))
+
+    def pubsub(self):
+        class _PubSub:
+            def __init__(self, parent):
+                self.parent = parent
+                self._queue: list = []
+
+            async def subscribe(self, *channels):
+                self.parent._subs.append(self)
+
+            async def get_message(self, ignore_subscribe_messages=True, timeout=None):
+                if self._queue:
+                    return self._queue.pop(0)
+                return None
+
+            def push(self, channel, message):
+                import types
+                self._queue.append(types.SimpleNamespace(type="message", channel=channel, data=message))
+
+            async def close(self):
+                pass
+
+        return _PubSub(self)
+
+    async def ping(self):
+        return True
+
+    async def close(self):
+        pass
+
+
+async def test_redis_cache_uses_local_and_publishes_invalidate():
+    from app.core.redis_config_cache import RedisPubSubConfigCache
+    cache = RedisPubSubConfigCache(FakeRedis())
+    await cache.set_group("MAIL", {"host": "smtp"})
+    assert await cache.get_group("MAIL") == {"host": "smtp"}
+    await cache.invalidate("MAIL")
+    assert await cache.get_group("MAIL") is None
+    assert ("config-change", "MAIL") in cache._redis.published  # noqa: SLF001
+
+
+async def test_redis_cache_subscriber_invalidates_local():
+    import asyncio
+
+    from app.core.redis_config_cache import RedisPubSubConfigCache
+
+    fake = FakeRedis()
+    cache = RedisPubSubConfigCache(fake)
+    await cache.set_group("MAIL", {"host": "smtp"})
+    # 启动订阅 task
+    task = asyncio.create_task(cache.start_subscriber())
+    await asyncio.sleep(0.05)  # 让订阅注册
+    assert fake._subs, "subscriber registered"  # noqa: SLF001
+    # 模拟收到失效消息
+    fake._subs[0].push("config-change", "MAIL")
+    await asyncio.sleep(0.05)
+    assert await cache.get_group("MAIL") is None  # 本地被失效
+    task.cancel()
+    try:
+        await task
+    except asyncio.CancelledError:
+        pass
\ No newline at end of file
