## commits cbb531e..bad2805
bad2805 feat(config): lifespan 集成订阅+init;全量回归通过,覆盖率≥85%,ruff 清零

## stat
 user-service/back-end/app/core/config_cache.py     | 19 +++---
 .../back-end/app/domain/models/system_config.py    | 11 +++-
 .../back-end/app/interfaces/api/email_templates.py |  5 +-
 .../back-end/app/interfaces/api/system_config.py   | 67 ++++++++++++----------
 user-service/back-end/app/main.py                  | 29 +++++++++-
 .../app/repositories/system_config_repository.py   |  9 ++-
 user-service/back-end/tests/conftest.py            |  2 +-
 user-service/back-end/tests/test_config_cache.py   | 41 ++++++++++++-
 .../back-end/tests/test_config_group_models.py     |  6 +-
 user-service/back-end/tests/test_config_service.py | 10 +++-
 .../back-end/tests/test_system_config_api.py       |  5 +-
 .../back-end/tests/test_system_config_model.py     |  4 +-
 .../tests/test_system_config_repository.py         |  6 +-
 13 files changed, 156 insertions(+), 58 deletions(-)

## diff -U10
diff --git a/user-service/back-end/app/core/config_cache.py b/user-service/back-end/app/core/config_cache.py
index 97f7489..2d09a9b 100644
--- a/user-service/back-end/app/core/config_cache.py
+++ b/user-service/back-end/app/core/config_cache.py
@@ -40,25 +40,28 @@ class LocalTTLCache:
             self._store.pop(group, None)
 
     async def start_subscriber(self) -> None:
         return None
 
 
 _local_singleton = LocalTTLCache()
 _redis_singleton: ConfigCache | None = None
 
 
+async def _build_redis_or_fallback() -> ConfigCache:
+    try:
+        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client
+
+        return RedisPubSubConfigCache(await build_redis_client())
+    except Exception as exc:  # noqa: BLE001
+        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
+        return _local_singleton
+
+
 async def get_config_cache() -> ConfigCache:
     global _redis_singleton
     if not settings.CONFIG_CACHE_ENABLED:
         return _local_singleton
     if _redis_singleton is not None:
         return _redis_singleton
-    try:
-        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client
-
-        client = await build_redis_client()
-        _redis_singleton = RedisPubSubConfigCache(client)
-    except Exception as exc:  # noqa: BLE001
-        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
-        _redis_singleton = _local_singleton
+    _redis_singleton = await _build_redis_or_fallback()
     return _redis_singleton
\ No newline at end of file
diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
index 8cad7c0..755a483 100644
--- a/user-service/back-end/app/domain/models/system_config.py
+++ b/user-service/back-end/app/domain/models/system_config.py
@@ -13,35 +13,40 @@ from app.domain.models import Base
 UUIDType = Uuid
 
 
 class SystemConfig(Base):
     __tablename__ = "system_config"
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
     config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
     config_value: Mapped[str] = mapped_column(Text, nullable=False)
     config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
-    config_type: Mapped[str] = mapped_column(String(20), nullable=False)  # STRING/INT/BOOL/JSON/SECRET
+    # STRING/INT/BOOL/JSON/SECRET
+    config_type: Mapped[str] = mapped_column(String(20), nullable=False)
     is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
     description: Mapped[str | None] = mapped_column(String(500), nullable=True)
-    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey("user_account.id"), nullable=True)
+    updated_by: Mapped[uuid.UUID | None] = mapped_column(
+        UUIDType, ForeignKey("user_account.id"), nullable=True
+    )
 
 
 class ConfigHistory(Base):
     __tablename__ = "config_history"
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
     config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
     old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
     new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
     changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
-    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False, server_default=func.now())
+    changed_at: Mapped[datetime] = mapped_column(
+        DateTime(timezone=True), index=True, nullable=False, server_default=func.now()
+    )
 
 
 class EmailTemplate(Base):
     __tablename__ = "email_template"
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
     template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
     template_name: Mapped[str] = mapped_column(String(100), nullable=False)
     subject: Mapped[str] = mapped_column(String(200), nullable=False)
     content: Mapped[str] = mapped_column(Text, nullable=False)
diff --git a/user-service/back-end/app/interfaces/api/email_templates.py b/user-service/back-end/app/interfaces/api/email_templates.py
index c84c936..44532d3 100644
--- a/user-service/back-end/app/interfaces/api/email_templates.py
+++ b/user-service/back-end/app/interfaces/api/email_templates.py
@@ -2,21 +2,24 @@
 
 from __future__ import annotations
 
 import uuid
 
 from fastapi import APIRouter, Depends, Query, status
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.application.deps import get_db
 from app.application.schemas.system_config import (
-    EmailTemplateCreate, EmailTemplateListOut, EmailTemplateOut, EmailTemplateUpdate,
+    EmailTemplateCreate,
+    EmailTemplateListOut,
+    EmailTemplateOut,
+    EmailTemplateUpdate,
 )
 from app.application.services.email_template_service import EmailTemplateService
 from app.core.security import require_permission
 from app.domain.models.user import User
 from app.repositories.system_config_repository import EmailTemplateRepository
 
 router = APIRouter(prefix="/email-templates", tags=["email-templates"])
 
 
 def _svc(db: AsyncSession) -> EmailTemplateService:
diff --git a/user-service/back-end/app/interfaces/api/system_config.py b/user-service/back-end/app/interfaces/api/system_config.py
index f464678..ed98897 100644
--- a/user-service/back-end/app/interfaces/api/system_config.py
+++ b/user-service/back-end/app/interfaces/api/system_config.py
@@ -1,29 +1,28 @@
 """系统配置路由."""
 
 from __future__ import annotations
 
-import uuid
-
 from fastapi import APIRouter, Depends, Query
 from pydantic import BaseModel
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.application.deps import get_db
+from app.application.services.config_service import ConfigService
+from app.core import crypto
 from app.core.config_cache import ConfigCache, get_config_cache
 from app.core.security import require_permission
 from app.domain.models.user import User
 from app.repositories.system_config_repository import (
-    ConfigHistoryRepository, SystemConfigRepository,
+    ConfigHistoryRepository,
+    SystemConfigRepository,
 )
-from app.application.services.config_service import ConfigService
-from app.core import crypto
 
 router = APIRouter(prefix="/config", tags=["config"])
 
 
 def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
     return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
 
 
 class ConfigValueUpdate(BaseModel):
     value: str | int | bool | dict
@@ -35,84 +34,90 @@ def _mask(values: dict, group: str) -> dict:
     masked = {}
     for k, v in values.items():
         fi = model.model_fields.get(k)
         if fi is not None and "SecretStr" in str(fi.annotation):
             masked[k] = "***"
         else:
             masked[k] = v
     return masked
 
 
+def _format_history(rows, key: str) -> list[dict]:
+    from app.application.schemas.system_config import GROUP_MODELS, group_of_key
+    group = group_of_key(key)
+    field = key.split(".", 1)[1]
+    fi = GROUP_MODELS[group].model_fields.get(field)
+    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
+    return [
+        {
+            "key": r.config_key,
+            "old_value": "***" if is_secret else r.old_value,
+            "new_value": "***" if is_secret else r.new_value,
+            "changed_by": str(r.changed_by),
+            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
+        }
+        for r in rows
+    ]
+
+
+def _get_value_result(values: dict, key: str, group: str) -> dict:
+    from app.application.schemas.system_config import GROUP_MODELS
+    field = key.split(".", 1)[1]
+    val = values.get(field)
+    fi = GROUP_MODELS[group].model_fields.get(field)
+    if fi is not None and "SecretStr" in str(fi.annotation):
+        val = "***"
+    return {"key": key, "group": group, "value": val}
+
+
 @router.get("/groups")
 async def list_groups(
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
     user: User = Depends(require_permission("config:read")),
 ) -> list[str]:
     return _svc(db, cache).list_groups()
 
 
 @router.get("")
 async def get_group(
     group: str = Query(...),
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
     user: User = Depends(require_permission("config:read")),
 ) -> dict:
     svc = _svc(db, cache)
-    values = await svc.get_group(group)
-    return {"group": group, "values": _mask(values, group)}
+    return {"group": group, "values": _mask(await svc.get_group(group), group)}
 
 
 @router.get("/history")
 async def history(
     key: str = Query(...),
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
     user: User = Depends(require_permission("config:read")),
 ) -> list[dict]:
     repo = ConfigHistoryRepository(db)
-    rows = await repo.list_by_key(key)
-    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
-    group = group_of_key(key)
-    field = key.split(".", 1)[1]
-    fi = GROUP_MODELS[group].model_fields.get(field)
-    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
-    out = []
-    for r in rows:
-        out.append({
-            "key": r.config_key,
-            "old_value": "***" if is_secret else r.old_value,
-            "new_value": "***" if is_secret else r.new_value,
-            "changed_by": str(r.changed_by),
-            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
-        })
-    return out
+    return _format_history(await repo.list_by_key(key), key)
 
 
 @router.get("/{key}")
 async def get_value(
     key: str,
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
     user: User = Depends(require_permission("config:read")),
 ) -> dict:
+    from app.application.schemas.system_config import group_of_key
     svc = _svc(db, cache)
-    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
     group = group_of_key(key)
-    values = await svc.get_group(group)
-    field = key.split(".", 1)[1]
-    val = values.get(field)
-    fi = GROUP_MODELS[group].model_fields.get(field)
-    if fi is not None and "SecretStr" in str(fi.annotation):
-        val = "***"
-    return {"key": key, "group": group, "value": val}
+    return _get_value_result(await svc.get_group(group), key, group)
 
 
 @router.put("/{key}")
 async def put_value(
     key: str,
     req: ConfigValueUpdate,
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
     user: User = Depends(require_permission("config:update")),
 ) -> dict:
diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
index 1ba7e1f..99483b6 100644
--- a/user-service/back-end/app/main.py
+++ b/user-service/back-end/app/main.py
@@ -1,39 +1,66 @@
 """FastAPI 应用入口."""
 
 from __future__ import annotations
 
+import asyncio
+import uuid
 from collections.abc import AsyncIterator
 from contextlib import asynccontextmanager
 
 from fastapi import FastAPI
 from fastapi.middleware.cors import CORSMiddleware
 
 # 确保关联表与模型在导入时注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401
 import app.domain.models.department  # noqa: F401
 import app.domain.models.role  # noqa: F401
 import app.domain.models.system_config  # noqa: F401
 import app.domain.models.user  # noqa: F401
+from app.application.services.config_service import ConfigService
+from app.core import crypto
 from app.core.config import settings
-from app.core.database import engine
+from app.core.config_cache import get_config_cache
+from app.core.database import AsyncSessionLocal, engine
 from app.core.exceptions import register_exception_handlers
 from app.domain.models import Base
 from app.interfaces.api import auth, departments, email_templates, health, system_config, users
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository,
+    SystemConfigRepository,
+)
 
 
 @asynccontextmanager
 async def lifespan(_: FastAPI) -> AsyncIterator[None]:
     # 测试/开发环境自动建表；生产应使用 Alembic 迁移
     async with engine.begin() as conn:
         await conn.run_sync(Base.metadata.create_all)
+    # 配置缓存订阅(Redis 实现时;本地 no-op)
+    cache = await get_config_cache()
+    subscriber_task = asyncio.create_task(cache.start_subscriber())
+    # 幂等初始化默认配置(全零 UUID 作为系统操作人)
+    async with AsyncSessionLocal() as session:
+        svc = ConfigService(
+            session,
+            SystemConfigRepository(session),
+            ConfigHistoryRepository(session),
+            crypto,
+            cache,
+        )
+        await svc.init_default_configs(uuid.UUID(int=0))
     yield
+    subscriber_task.cancel()
+    try:
+        await subscriber_task
+    except asyncio.CancelledError:
+        pass
     await engine.dispose()
 
 
 def create_app() -> FastAPI:
     app = FastAPI(
         title=settings.APP_NAME,
         version="0.1.0",
         openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
         docs_url="/docs",
     )
diff --git a/user-service/back-end/app/repositories/system_config_repository.py b/user-service/back-end/app/repositories/system_config_repository.py
index 28478e6..33b7ea4 100644
--- a/user-service/back-end/app/repositories/system_config_repository.py
+++ b/user-service/back-end/app/repositories/system_config_repository.py
@@ -13,28 +13,30 @@ from app.domain.models.system_config import ConfigHistory, EmailTemplate, System
 
 class SystemConfigRepository:
     def __init__(self, db: AsyncSession):
         self.db = db
 
     async def get_by_key(self, key: str) -> SystemConfig | None:
         result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
         return result.scalar_one_or_none()
 
     async def list_by_group(self, group: str) -> list[SystemConfig]:
-        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_group == group))
+        stmt = select(SystemConfig).where(SystemConfig.config_group == group)
+        result = await self.db.execute(stmt)
         return list(result.scalars().all())
 
     async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
         stmt = select(SystemConfig)
         if group is not None:
             stmt = stmt.where(SystemConfig.config_group == group)
-        result = await self.db.execute(stmt.order_by(SystemConfig.config_group, SystemConfig.config_key))
+        stmt = stmt.order_by(SystemConfig.config_group, SystemConfig.config_key)
+        result = await self.db.execute(stmt)
         return list(result.scalars().all())
 
     async def upsert(self, key: str, value: str, group: str, type_: str,
                      is_encrypted: bool, updated_by: uuid.UUID | None,
                      description: str | None = None) -> SystemConfig:
         existing = await self.get_by_key(key)
         if existing is None:
             row = SystemConfig(config_key=key, config_value=value, config_group=group,
                                config_type=type_, is_encrypted=is_encrypted,
                                updated_by=updated_by, description=description)
@@ -73,21 +75,22 @@ class ConfigHistoryRepository:
 
 
 class EmailTemplateRepository:
     def __init__(self, db: AsyncSession):
         self.db = db
 
     async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
         return await self.db.get(EmailTemplate, tpl_id)
 
     async def get_by_code(self, code: str) -> EmailTemplate | None:
-        result = await self.db.execute(select(EmailTemplate).where(EmailTemplate.template_code == code))
+        stmt = select(EmailTemplate).where(EmailTemplate.template_code == code)
+        result = await self.db.execute(stmt)
         return result.scalar_one_or_none()
 
     async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
         total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
         total = int(total_result.scalar_one())
         result = await self.db.execute(
             select(EmailTemplate).order_by(EmailTemplate.template_code)
             .offset((page - 1) * size).limit(size)
         )
         return list(result.scalars().all()), total
diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
index e8116a6..8428248 100644
--- a/user-service/back-end/tests/conftest.py
+++ b/user-service/back-end/tests/conftest.py
@@ -9,22 +9,22 @@ from collections.abc import AsyncIterator
 
 import pytest
 import pytest_asyncio
 from httpx import ASGITransport, AsyncClient
 from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
 
 # 确保所有模型注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
-import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.system_config  # noqa: F401  pylint: disable=unused-import
+import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
 from app.core.database import get_db
 from app.domain.models import Base
 from app.domain.models.enums import DataScope
 from app.domain.models.role import Permission, Role
 from app.main import app
 
 
 @pytest.fixture(autouse=True)
 def _encryption_key(monkeypatch):
     from cryptography.fernet import Fernet
diff --git a/user-service/back-end/tests/test_config_cache.py b/user-service/back-end/tests/test_config_cache.py
index ba9a3bb..5c7fb33 100644
--- a/user-service/back-end/tests/test_config_cache.py
+++ b/user-service/back-end/tests/test_config_cache.py
@@ -31,20 +31,56 @@ async def test_local_cache_start_subscriber_noop():
     await cache.start_subscriber()  # 不抛错
 
 
 async def test_factory_returns_local_when_disabled(monkeypatch):
     from app.core.config import settings
     monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
     cache = await get_config_cache()
     assert isinstance(cache, LocalTTLCache)
 
 
+async def test_factory_builds_redis_when_enabled(monkeypatch):
+    import app.core.config_cache as mod
+    from app.core.config import settings
+    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", True)
+    monkeypatch.setattr(mod, "_redis_singleton", None)
+
+    async def fake_build():
+        return FakeRedis()
+
+    monkeypatch.setattr(
+        "app.core.redis_config_cache.build_redis_client", fake_build
+    )
+    cache = await get_config_cache()
+    from app.core.redis_config_cache import RedisPubSubConfigCache
+    assert isinstance(cache, RedisPubSubConfigCache)
+    # 第二次调用返回缓存的 singleton
+    cache2 = await get_config_cache()
+    assert cache2 is cache
+
+
+async def test_factory_fallback_on_redis_error(monkeypatch):
+    import app.core.config_cache as mod
+    from app.core.config import settings
+    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", True)
+    monkeypatch.setattr(mod, "_redis_singleton", None)
+
+    async def boom():
+        raise RuntimeError("no redis")
+
+    monkeypatch.setattr(
+        "app.core.redis_config_cache.build_redis_client", boom
+    )
+    cache = await get_config_cache()
+    assert isinstance(cache, LocalTTLCache)
+
+
 def test_protocol_compat():
     assert isinstance(LocalTTLCache(), ConfigCache)
 
 
 class FakeRedis:
     def __init__(self):
         self.store: dict[str, str] = {}
         self.published: list[tuple[str, str]] = []
         self._subs: list = []
 
@@ -66,21 +102,24 @@ class FakeRedis:
             async def subscribe(self, *channels):
                 self.parent._subs.append(self)
 
             async def get_message(self, ignore_subscribe_messages=True, timeout=None):
                 if self._queue:
                     return self._queue.pop(0)
                 return None
 
             def push(self, channel, message):
                 import types
-                self._queue.append(types.SimpleNamespace(type="message", channel=channel, data=message))
+                msg = types.SimpleNamespace(
+                    type="message", channel=channel, data=message
+                )
+                self._queue.append(msg)
 
             async def close(self):
                 pass
 
         return _PubSub(self)
 
     async def ping(self):
         return True
 
     async def close(self):
diff --git a/user-service/back-end/tests/test_config_group_models.py b/user-service/back-end/tests/test_config_group_models.py
index d321df7..d664a23 100644
--- a/user-service/back-end/tests/test_config_group_models.py
+++ b/user-service/back-end/tests/test_config_group_models.py
@@ -1,17 +1,21 @@
 from __future__ import annotations
 
 import pytest
 from pydantic import ValidationError
 
 from app.application.schemas.system_config import (
-    GROUP_MODELS, MailConfig, SecurityPolicy, SystemParams, group_of_key,
+    GROUP_MODELS,
+    MailConfig,
+    SecurityPolicy,
+    SystemParams,
+    group_of_key,
 )
 
 pytestmark = pytest.mark.asyncio
 
 
 def test_group_of_key():
     assert group_of_key("mail.host") == "MAIL"
     assert group_of_key("security.password_min_length") == "SECURITY"
     assert group_of_key("performance.cache_user_info_ttl") == "PERFORMANCE"
     assert group_of_key("system.site_name") == "SYSTEM"
diff --git a/user-service/back-end/tests/test_config_service.py b/user-service/back-end/tests/test_config_service.py
index 41028df..89f09c0 100644
--- a/user-service/back-end/tests/test_config_service.py
+++ b/user-service/back-end/tests/test_config_service.py
@@ -2,23 +2,24 @@
 from __future__ import annotations
 
 import uuid
 
 import pytest
 from sqlalchemy.ext.asyncio import async_sessionmaker
 
 from app.application.services.config_service import ConfigService
 from app.core import crypto
 from app.core.config_cache import LocalTTLCache
-from app.core.exceptions import BusinessException, NotFoundError
+from app.core.exceptions import BusinessException
 from app.repositories.system_config_repository import (
-    ConfigHistoryRepository, SystemConfigRepository,
+    ConfigHistoryRepository,
+    SystemConfigRepository,
 )
 
 pytestmark = pytest.mark.asyncio
 
 
 def _svc(db):
     return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
                           crypto, LocalTTLCache())
 
 
@@ -115,16 +116,19 @@ async def test_cache_invalidation_on_set(engine, seed):
     class SpyCache(LocalTTLCache):
         def __init__(self):
             super().__init__()
             self.invalidated: list = []
 
         async def invalidate(self, group=None):
             self.invalidated.append(group)
 
     async with Session() as db:
         spy = SpyCache()
-        svc = ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, spy)
+        svc = ConfigService(
+            db, SystemConfigRepository(db),
+            ConfigHistoryRepository(db), crypto, spy,
+        )
         await svc.init_default_configs(uuid.uuid4())
         await db.commit()
         await svc.set_value("system.site_name", "Z", uuid.uuid4())
         await db.commit()
         assert "SYSTEM" in spy.invalidated
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_system_config_api.py b/user-service/back-end/tests/test_system_config_api.py
index bfbe3b9..b8745bc 100644
--- a/user-service/back-end/tests/test_system_config_api.py
+++ b/user-service/back-end/tests/test_system_config_api.py
@@ -50,15 +50,18 @@ async def test_history(client, admin_token):
     resp = await client.get("/api/v1/config/history?key=system.site_name",
                             headers=await _h(admin_token))
     assert resp.status_code == 200
     assert len(resp.json()) >= 1
 
 
 async def test_regular_user_forbidden(client):
     reg = await client.post("/api/v1/auth/register", json={
         "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
     assert reg.status_code == 201
-    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
+    login = await client.post(
+        "/api/v1/auth/login",
+        json={"email": "r@t.com", "password": "Rr@12345"},
+    )
     token = login.json()["access_token"]
     resp = await client.put("/api/v1/config/system.site_name",
                             json={"value": "x"}, headers=await _h(token))
     assert resp.status_code == 403
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
index 2d1b4c7..a430fbe 100644
--- a/user-service/back-end/tests/test_system_config_model.py
+++ b/user-service/back-end/tests/test_system_config_model.py
@@ -1,22 +1,22 @@
 # tests/test_system_config_model.py
 from __future__ import annotations
 
 import pytest
 from sqlalchemy import inspect
 
-from app.domain.models import Base
 import app.domain.models.associations  # noqa: F401
 import app.domain.models.department  # noqa: F401
 import app.domain.models.role  # noqa: F401
-import app.domain.models.user  # noqa: F401
 import app.domain.models.system_config  # noqa: F401
+import app.domain.models.user  # noqa: F401
+from app.domain.models import Base
 
 pytestmark = pytest.mark.asyncio
 
 
 def test_system_config_columns():
     cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
     assert {"id", "config_key", "config_value", "config_group", "config_type",
             "is_encrypted", "description", "updated_by",
             "created_at", "updated_at"} <= cols
     assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
diff --git a/user-service/back-end/tests/test_system_config_repository.py b/user-service/back-end/tests/test_system_config_repository.py
index 0238cf8..78a94d2 100644
--- a/user-service/back-end/tests/test_system_config_repository.py
+++ b/user-service/back-end/tests/test_system_config_repository.py
@@ -1,21 +1,23 @@
 # tests/test_system_config_repository.py
 from __future__ import annotations
 
 import uuid
 
 import pytest
 from sqlalchemy.ext.asyncio import async_sessionmaker
 
-from app.domain.models.system_config import EmailTemplate, SystemConfig
+from app.domain.models.system_config import EmailTemplate
 from app.repositories.system_config_repository import (
-    ConfigHistoryRepository, EmailTemplateRepository, SystemConfigRepository,
+    ConfigHistoryRepository,
+    EmailTemplateRepository,
+    SystemConfigRepository,
 )
 
 pytestmark = pytest.mark.asyncio
 
 
 async def test_upsert_inserts_and_updates(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         repo = SystemConfigRepository(db)
         await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
