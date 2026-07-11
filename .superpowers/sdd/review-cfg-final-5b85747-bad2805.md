## commits 5b85747..bad2805 (config feature)
bad2805 feat(config): lifespan 集成订阅+init;全量回归通过,覆盖率≥85%,ruff 清零
cbb531e feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展
15a2e54 feat(config): EmailTemplateService + schema
24a8981 fix(config): ConfigService 清理(删除错误 DepartmentCache import + SecretStr 提顶 + _PREFIX 复用 + list_keys 返回类型)
58d3bd1 feat(config): ConfigService(CRUD/分组校验/加解密/历史/缓存)
1065e8e feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储
a7e4d08 feat(config): RedisPubSubConfigCache(pub/sub 即时失效)
49cdfe6 feat(config): ConfigCache 协议 + LocalTTLCache + 工厂
16a4cc2 feat(config): 分组 Pydantic 模型 + key→组映射
33cf225 feat(config): Fernet 加密模块 + CONFIG_ENCRYPTION_KEY
d1e9ac1 fix(config): ConfigHistory.changed_at 加索引 + 测试断言
cae4272 feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型

## stat
 .../app/application/schemas/system_config.py       | 102 ++++++++++++
 .../app/application/services/config_service.py     | 176 +++++++++++++++++++++
 .../application/services/email_template_service.py |  61 +++++++
 user-service/back-end/app/core/config.py           |   5 +
 user-service/back-end/app/core/config_cache.py     |  67 ++++++++
 user-service/back-end/app/core/crypto.py           |  26 +++
 .../back-end/app/core/redis_config_cache.py        |  63 ++++++++
 .../back-end/app/domain/models/system_config.py    |  54 +++++++
 .../back-end/app/interfaces/api/email_templates.py |  74 +++++++++
 .../back-end/app/interfaces/api/system_config.py   | 137 ++++++++++++++++
 user-service/back-end/app/main.py                  |  34 +++-
 .../app/repositories/system_config_repository.py   | 111 +++++++++++++
 user-service/back-end/pyproject.toml               |   1 +
 user-service/back-end/tests/conftest.py            |  29 ++++
 user-service/back-end/tests/test_config_cache.py   | 159 +++++++++++++++++++
 .../back-end/tests/test_config_group_models.py     |  51 ++++++
 user-service/back-end/tests/test_config_service.py | 134 ++++++++++++++++
 user-service/back-end/tests/test_crypto.py         |  26 +++
 .../back-end/tests/test_email_template_service.py  |  69 ++++++++
 .../back-end/tests/test_email_templates_api.py     |  37 +++++
 .../back-end/tests/test_system_config_api.py       |  67 ++++++++
 .../back-end/tests/test_system_config_model.py     |  35 ++++
 .../tests/test_system_config_repository.py         |  69 ++++++++
 user-service/back-end/uv.lock                      |   2 +
 24 files changed, 1587 insertions(+), 2 deletions(-)

## diff -U5
diff --git a/user-service/back-end/app/application/schemas/system_config.py b/user-service/back-end/app/application/schemas/system_config.py
new file mode 100644
index 0000000..1d1755d
--- /dev/null
+++ b/user-service/back-end/app/application/schemas/system_config.py
@@ -0,0 +1,102 @@
+"""系统配置分组 Pydantic 模型 + key→组映射."""
+
+from __future__ import annotations
+
+import uuid
+from datetime import datetime
+from typing import Literal
+
+from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr
+
+_PREFIX_TO_GROUP = {"mail": "MAIL", "security": "SECURITY",
+                    "performance": "PERFORMANCE", "system": "SYSTEM"}
+
+
+def group_of_key(key: str) -> str:
+    prefix = key.split(".", 1)[0]
+    group = _PREFIX_TO_GROUP.get(prefix)
+    if group is None:
+        raise ValueError(f"未知配置组前缀: {prefix}")
+    return group
+
+
+class MailConfig(BaseModel):
+    host: str = Field(min_length=1, max_length=255)
+    port: int = Field(ge=1, le=65535)
+    username: str = Field(min_length=1, max_length=255)
+    password: SecretStr
+    protocol: Literal["smtp", "smtps"] = "smtp"
+    starttls: bool = True
+
+
+class SecurityPolicy(BaseModel):
+    password_min_length: int = Field(ge=6, le=128)
+    password_require_uppercase: bool
+    password_require_lowercase: bool
+    password_require_digits: bool
+    password_require_special: bool
+    password_history_size: int = Field(ge=0, le=20)
+    password_expiration_days: int = Field(ge=0, le=365)
+    login_max_attempts: int = Field(ge=1, le=20)
+    login_lock_minutes: int = Field(ge=1, le=1440)
+    session_timeout_minutes: int = Field(ge=1, le=1440)
+
+
+class PerformanceConfig(BaseModel):
+    cache_user_info_ttl: int = Field(ge=10, le=3600)
+    cache_permission_ttl: int = Field(ge=10, le=3600)
+    cache_department_tree_ttl: int = Field(ge=10, le=3600)
+    db_max_pool_size: int = Field(ge=1, le=100)
+    api_response_threshold_ms: int = Field(ge=10, le=10000)
+
+
+class SystemParams(BaseModel):
+    site_name: str = Field(min_length=1, max_length=100)
+    default_locale: str = Field(pattern=r"^[a-z]{2}_[A-Z]{2}$")
+    support_email: EmailStr
+
+
+GROUP_MODELS = {
+    "MAIL": MailConfig,
+    "SECURITY": SecurityPolicy,
+    "PERFORMANCE": PerformanceConfig,
+    "SYSTEM": SystemParams,
+}
+
+
+class EmailTemplateCreate(BaseModel):
+    template_code: str = Field(min_length=1, max_length=50)
+    template_name: str = Field(min_length=1, max_length=100)
+    subject: str = Field(min_length=1, max_length=200)
+    content: str = Field(min_length=1)
+    variables: list[dict] | None = None
+    is_active: bool = True
+
+
+class EmailTemplateUpdate(BaseModel):
+    template_code: str | None = Field(default=None, min_length=1, max_length=50)
+    template_name: str | None = Field(default=None, min_length=1, max_length=100)
+    subject: str | None = Field(default=None, min_length=1, max_length=200)
+    content: str | None = Field(default=None, min_length=1)
+    variables: list[dict] | None = None
+    is_active: bool | None = None
+
+
+class EmailTemplateOut(BaseModel):
+    model_config = ConfigDict(from_attributes=True)
+    id: uuid.UUID
+    template_code: str
+    template_name: str
+    subject: str
+    content: str
+    variables: list[dict] | None
+    is_active: bool
+    created_at: datetime
+    updated_at: datetime
+
+
+class EmailTemplateListOut(BaseModel):
+    items: list[EmailTemplateOut]
+    total: int
+    page: int
+    size: int
\ No newline at end of file
diff --git a/user-service/back-end/app/application/services/config_service.py b/user-service/back-end/app/application/services/config_service.py
new file mode 100644
index 0000000..bffa2ad
--- /dev/null
+++ b/user-service/back-end/app/application/services/config_service.py
@@ -0,0 +1,176 @@
+# app/application/services/config_service.py
+"""系统配置服务:CRUD + 分组校验 + 加解密 + 历史 + 缓存."""
+
+from __future__ import annotations
+
+import json
+import uuid
+from typing import Any
+
+from pydantic import SecretStr
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.schemas.system_config import GROUP_MODELS, group_of_key
+from app.core.config_cache import ConfigCache
+from app.core.exceptions import BusinessException, NotFoundError
+from app.domain.models.system_config import SystemConfig
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository,
+    SystemConfigRepository,
+)
+
+# 默认配置(每组模型默认值的扁平 key 形式)
+_DEFAULTS: dict[str, dict] = {
+    "MAIL": {"host": "smtp.example.com", "port": "587", "username": "noreply@example.com",
+             "password": "change-me", "protocol": "smtp", "starttls": "true"},
+    "SECURITY": {"password_min_length": "8", "password_require_uppercase": "true",
+                 "password_require_lowercase": "true", "password_require_digits": "true",
+                 "password_require_special": "true", "password_history_size": "5",
+                 "password_expiration_days": "90", "login_max_attempts": "5",
+                 "login_lock_minutes": "30", "session_timeout_minutes": "15"},
+    "PERFORMANCE": {"cache_user_info_ttl": "180", "cache_permission_ttl": "300",
+                    "cache_department_tree_ttl": "600", "db_max_pool_size": "50",
+                    "api_response_threshold_ms": "200"},
+    "SYSTEM": {"site_name": "User Management", "default_locale": "zh_CN",
+               "support_email": "support@example.com"},
+}
+
+# key → config_type(由默认值推断:password 为 SECRET,纯数字为 INT,true/false 为 BOOL,其余 STRING)
+_PREFIX = {"MAIL": "mail", "SECURITY": "security", "PERFORMANCE": "performance", "SYSTEM": "system"}
+
+
+def _infer_type(field: str, value: str) -> str:
+    if field == "password":
+        return "SECRET"
+    if value.isdigit():
+        return "INT"
+    if value in ("true", "false"):
+        return "BOOL"
+    return "STRING"
+
+
+_TYPES: dict[str, str] = {
+    f"{_PREFIX[g]}.{f}": _infer_type(f, v)
+    for g, fields in _DEFAULTS.items()
+    for f, v in fields.items()
+}
+
+
+def _cast_value(raw: str, type_: str) -> Any:
+    if type_ == "INT":
+        return int(raw)
+    if type_ == "BOOL":
+        return raw.lower() == "true"
+    if type_ == "JSON":
+        return json.loads(raw)
+    return raw
+
+
+def _to_storage(value: Any, type_: str, crypto) -> tuple[str, bool]:
+    """返回 (存储值, is_encrypted)。SECRET 加密。"""
+    if type_ == "SECRET":
+        return crypto.encrypt(str(value)), True
+    if type_ == "JSON":
+        return json.dumps(value), False
+    return str(value), False
+
+
+def _from_storage(raw: str, type_: str, crypto) -> Any:
+    if type_ == "SECRET":
+        return crypto.decrypt(raw)
+    return _cast_value(raw, type_)
+
+
+class ConfigService:
+    def __init__(self, db: AsyncSession, repo: SystemConfigRepository,
+                 history_repo: ConfigHistoryRepository, crypto, cache: ConfigCache):
+        self.db = db
+        self.repo = repo
+        self.history_repo = history_repo
+        self.crypto = crypto
+        self.cache = cache
+
+    def _group_and_field(self, key: str) -> tuple[str, str]:
+        group = group_of_key(key)
+        prefix = key.split(".", 1)[0]
+        field = key[len(prefix) + 1:]
+        return group, field
+
+    async def _load_group_dict(self, group: str) -> dict[str, Any]:
+        rows = await self.repo.list_by_group(group)
+        out: dict[str, Any] = {}
+        for r in rows:
+            _, field = self._group_and_field(r.config_key)
+            out[field] = _from_storage(r.config_value, r.config_type, self.crypto)
+        return out
+
+    async def get_group(self, group: str) -> dict:
+        cached = await self.cache.get_group(group)
+        if cached is not None:
+            return cached
+        values = await self._load_group_dict(group)
+        await self.cache.set_group(group, values)
+        return values
+
+    async def get_value(self, key: str) -> Any:
+        group, field = self._group_and_field(key)
+        values = await self.get_group(group)
+        if field not in values:
+            raise NotFoundError(f"配置不存在: {key}")
+        return values[field]
+
+    async def set_value(self, key: str, value: Any, updated_by: uuid.UUID) -> None:
+        try:
+            group = group_of_key(key)
+        except ValueError as exc:
+            raise BusinessException(str(exc)) from exc
+        _, field = self._group_and_field(key)
+        type_ = _TYPES.get(key, "STRING")
+        # 组装整组并校验
+        group_dict = await self._load_group_dict(group)
+        group_dict[field] = value
+        model_cls = GROUP_MODELS[group]
+        # SECRET 字段用 SecretStr,其余用原值
+        validate_dict = {}
+        for k, v in group_dict.items():
+            field_info = model_cls.model_fields.get(k)
+            if field_info is not None and "SecretStr" in str(field_info.annotation):
+                validate_dict[k] = SecretStr(str(v))
+            else:
+                validate_dict[k] = v
+        try:
+            model_cls(**validate_dict)
+        except Exception as exc:
+            raise BusinessException(f"配置校验失败: {exc}") from exc
+        # 持久化
+        existing = await self.repo.get_by_key(key)
+        old_storage = existing.config_value if existing else None
+        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
+        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by)
+        # 历史(密文/原样存)
+        await self.history_repo.add(key, old_storage, storage_value, updated_by)
+        await self.db.commit()
+        await self.cache.invalidate(group)
+
+    async def create_or_init(self, key: str, value: Any, group: str, type_: str,
+                             description: str | None, updated_by: uuid.UUID) -> None:
+        if await self.repo.get_by_key(key) is not None:
+            return  # 幂等
+        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
+        await self.repo.upsert(key, storage_value, group, type_, is_encrypted,
+                               updated_by, description)
+        await self.db.commit()
+
+    async def init_default_configs(self, updated_by: uuid.UUID) -> None:
+        for group, fields in _DEFAULTS.items():
+            for field, value in fields.items():
+                key = f"{_PREFIX[group]}.{field}"
+                type_ = _TYPES[key]
+                await self.create_or_init(key, value, group, type_, None, updated_by)
+        await self.cache.invalidate()
+
+    def list_groups(self) -> list[str]:
+        return list(GROUP_MODELS.keys())
+
+    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
+        return await self.repo.list_keys(group)
\ No newline at end of file
diff --git a/user-service/back-end/app/application/services/email_template_service.py b/user-service/back-end/app/application/services/email_template_service.py
new file mode 100644
index 0000000..458036a
--- /dev/null
+++ b/user-service/back-end/app/application/services/email_template_service.py
@@ -0,0 +1,61 @@
+"""邮件模板服务(CRUD,不含发送)."""
+
+from __future__ import annotations
+
+import uuid
+
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
+from app.core.exceptions import ConflictError, NotFoundError
+from app.domain.models.system_config import EmailTemplate
+from app.repositories.system_config_repository import EmailTemplateRepository
+
+
+class EmailTemplateService:
+    def __init__(self, db: AsyncSession, repo: EmailTemplateRepository):
+        self.db = db
+        self.repo = repo
+
+    async def create(self, req: EmailTemplateCreate) -> EmailTemplate:
+        if await self.repo.get_by_code(req.template_code) is not None:
+            raise ConflictError("模板编码已存在")
+        tpl = EmailTemplate(template_code=req.template_code, template_name=req.template_name,
+                           subject=req.subject, content=req.content,
+                           variables=req.variables, is_active=req.is_active)
+        await self.repo.add(tpl)
+        await self.db.commit()
+        await self.db.refresh(tpl)
+        return tpl
+
+    async def update(self, tpl_id: uuid.UUID, req: EmailTemplateUpdate) -> EmailTemplate:
+        tpl = await self.repo.get_by_id(tpl_id)
+        if tpl is None:
+            raise NotFoundError("模板不存在")
+        if req.template_code is not None and req.template_code != tpl.template_code:
+            if await self.repo.get_by_code(req.template_code) is not None:
+                raise ConflictError("模板编码已存在")
+        for field, value in req.model_dump(exclude_unset=True).items():
+            setattr(tpl, field, value)
+        await self.db.commit()
+        await self.db.refresh(tpl)
+        return tpl
+
+    async def get(self, tpl_id: uuid.UUID) -> EmailTemplate:
+        tpl = await self.repo.get_by_id(tpl_id)
+        if tpl is None:
+            raise NotFoundError("模板不存在")
+        return tpl
+
+    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
+        return await self.repo.list(page, size)
+
+    async def delete(self, tpl_id: uuid.UUID) -> None:
+        tpl = await self.repo.get_by_id(tpl_id)
+        if tpl is None:
+            raise NotFoundError("模板不存在")
+        await self.repo.delete(tpl)
+        await self.db.commit()
+
+    async def get_by_code(self, code: str) -> EmailTemplate | None:
+        return await self.repo.get_by_code(code)
\ No newline at end of file
diff --git a/user-service/back-end/app/core/config.py b/user-service/back-end/app/core/config.py
index 5041d52..a291e3d 100644
--- a/user-service/back-end/app/core/config.py
+++ b/user-service/back-end/app/core/config.py
@@ -33,10 +33,15 @@ class Settings(BaseSettings):
     REDIS_URL: str = "redis://localhost:6379/0"
 
     # 缓存开关(测试置 False 强制 Noop 降级)
     CACHE_ENABLED: bool = True
 
+    # 配置加密密钥(Fernet,启动期必须提供)
+    CONFIG_ENCRYPTION_KEY: str = ""  # 生产由 .env 注入;测试由 fixture 注入
+    # 配置缓存开关(测试置 False 强制 LocalTTLCache)
+    CONFIG_CACHE_ENABLED: bool = True
+
 
 @lru_cache(maxsize=1)
 def get_settings() -> Settings:
     return Settings()
 
diff --git a/user-service/back-end/app/core/config_cache.py b/user-service/back-end/app/core/config_cache.py
new file mode 100644
index 0000000..2d09a9b
--- /dev/null
+++ b/user-service/back-end/app/core/config_cache.py
@@ -0,0 +1,67 @@
+# app/core/config_cache.py
+"""系统配置缓存抽象 + 本地 TTL + 工厂(Redis 实现见 Task 5)."""
+
+from __future__ import annotations
+
+import logging
+from typing import Protocol, runtime_checkable
+
+from cachetools import TTLCache
+
+from app.core.config import settings
+
+logger = logging.getLogger(__name__)
+
+TTL_SECONDS = 60
+
+
+@runtime_checkable
+class ConfigCache(Protocol):
+    async def get_group(self, group: str) -> dict | None: ...
+    async def set_group(self, group: str, values: dict) -> None: ...
+    async def invalidate(self, group: str | None = None) -> None: ...
+    async def start_subscriber(self) -> None: ...
+
+
+class LocalTTLCache:
+    def __init__(self) -> None:
+        self._store: TTLCache = TTLCache(maxsize=128, ttl=TTL_SECONDS)
+
+    async def get_group(self, group: str) -> dict | None:
+        return self._store.get(group)
+
+    async def set_group(self, group: str, values: dict) -> None:
+        self._store[group] = values
+
+    async def invalidate(self, group: str | None = None) -> None:
+        if group is None:
+            self._store.clear()
+        else:
+            self._store.pop(group, None)
+
+    async def start_subscriber(self) -> None:
+        return None
+
+
+_local_singleton = LocalTTLCache()
+_redis_singleton: ConfigCache | None = None
+
+
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
+async def get_config_cache() -> ConfigCache:
+    global _redis_singleton
+    if not settings.CONFIG_CACHE_ENABLED:
+        return _local_singleton
+    if _redis_singleton is not None:
+        return _redis_singleton
+    _redis_singleton = await _build_redis_or_fallback()
+    return _redis_singleton
\ No newline at end of file
diff --git a/user-service/back-end/app/core/crypto.py b/user-service/back-end/app/core/crypto.py
new file mode 100644
index 0000000..27decdb
--- /dev/null
+++ b/user-service/back-end/app/core/crypto.py
@@ -0,0 +1,26 @@
+"""Fernet 对称加密(敏感配置)."""
+
+from __future__ import annotations
+
+from cryptography.fernet import Fernet
+
+from app.core.config import settings
+
+_fernet: Fernet | None = None
+
+
+def _get_fernet() -> Fernet:
+    global _fernet
+    if _fernet is None:
+        if not settings.CONFIG_ENCRYPTION_KEY:
+            raise RuntimeError("CONFIG_ENCRYPTION_KEY 未配置:无法加解密敏感配置")
+        _fernet = Fernet(settings.CONFIG_ENCRYPTION_KEY.encode())
+    return _fernet
+
+
+def encrypt(plain: str) -> str:
+    return _get_fernet().encrypt(plain.encode()).decode()
+
+
+def decrypt(cipher: str) -> str:
+    return _get_fernet().decrypt(cipher.encode()).decode()
\ No newline at end of file
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
diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
new file mode 100644
index 0000000..755a483
--- /dev/null
+++ b/user-service/back-end/app/domain/models/system_config.py
@@ -0,0 +1,54 @@
+"""系统配置、配置历史、邮件模板模型."""
+
+from __future__ import annotations
+
+import uuid
+from datetime import datetime
+
+from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid, func
+from sqlalchemy.orm import Mapped, mapped_column
+
+from app.domain.models import Base
+
+UUIDType = Uuid
+
+
+class SystemConfig(Base):
+    __tablename__ = "system_config"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
+    config_value: Mapped[str] = mapped_column(Text, nullable=False)
+    config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
+    # STRING/INT/BOOL/JSON/SECRET
+    config_type: Mapped[str] = mapped_column(String(20), nullable=False)
+    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
+    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
+    updated_by: Mapped[uuid.UUID | None] = mapped_column(
+        UUIDType, ForeignKey("user_account.id"), nullable=True
+    )
+
+
+class ConfigHistory(Base):
+    __tablename__ = "config_history"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
+    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+    changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
+    changed_at: Mapped[datetime] = mapped_column(
+        DateTime(timezone=True), index=True, nullable=False, server_default=func.now()
+    )
+
+
+class EmailTemplate(Base):
+    __tablename__ = "email_template"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
+    template_name: Mapped[str] = mapped_column(String(100), nullable=False)
+    subject: Mapped[str] = mapped_column(String(200), nullable=False)
+    content: Mapped[str] = mapped_column(Text, nullable=False)
+    variables: Mapped[list | None] = mapped_column(JSON, nullable=True)
+    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
\ No newline at end of file
diff --git a/user-service/back-end/app/interfaces/api/email_templates.py b/user-service/back-end/app/interfaces/api/email_templates.py
new file mode 100644
index 0000000..44532d3
--- /dev/null
+++ b/user-service/back-end/app/interfaces/api/email_templates.py
@@ -0,0 +1,74 @@
+"""邮件模板路由."""
+
+from __future__ import annotations
+
+import uuid
+
+from fastapi import APIRouter, Depends, Query, status
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.deps import get_db
+from app.application.schemas.system_config import (
+    EmailTemplateCreate,
+    EmailTemplateListOut,
+    EmailTemplateOut,
+    EmailTemplateUpdate,
+)
+from app.application.services.email_template_service import EmailTemplateService
+from app.core.security import require_permission
+from app.domain.models.user import User
+from app.repositories.system_config_repository import EmailTemplateRepository
+
+router = APIRouter(prefix="/email-templates", tags=["email-templates"])
+
+
+def _svc(db: AsyncSession) -> EmailTemplateService:
+    return EmailTemplateService(db, EmailTemplateRepository(db))
+
+
+@router.get("", response_model=EmailTemplateListOut)
+async def list_templates(
+    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:read")),
+) -> EmailTemplateListOut:
+    items, total = await _svc(db).list(page, size)
+    return EmailTemplateListOut(
+        items=[EmailTemplateOut.model_validate(i) for i in items],
+        total=total, page=page, size=size)
+
+
+@router.get("/{tpl_id}", response_model=EmailTemplateOut)
+async def get_template(
+    tpl_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:read")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).get(tpl_id))
+
+
+@router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
+async def create_template(
+    req: EmailTemplateCreate,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:create")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).create(req))
+
+
+@router.put("/{tpl_id}", response_model=EmailTemplateOut)
+async def update_template(
+    tpl_id: uuid.UUID, req: EmailTemplateUpdate,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:update")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).update(tpl_id, req))
+
+
+@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
+async def delete_template(
+    tpl_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:delete")),
+) -> None:
+    await _svc(db).delete(tpl_id)
\ No newline at end of file
diff --git a/user-service/back-end/app/interfaces/api/system_config.py b/user-service/back-end/app/interfaces/api/system_config.py
new file mode 100644
index 0000000..ed98897
--- /dev/null
+++ b/user-service/back-end/app/interfaces/api/system_config.py
@@ -0,0 +1,137 @@
+"""系统配置路由."""
+
+from __future__ import annotations
+
+from fastapi import APIRouter, Depends, Query
+from pydantic import BaseModel
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.deps import get_db
+from app.application.services.config_service import ConfigService
+from app.core import crypto
+from app.core.config_cache import ConfigCache, get_config_cache
+from app.core.security import require_permission
+from app.domain.models.user import User
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository,
+    SystemConfigRepository,
+)
+
+router = APIRouter(prefix="/config", tags=["config"])
+
+
+def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
+    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
+
+
+class ConfigValueUpdate(BaseModel):
+    value: str | int | bool | dict
+
+
+def _mask(values: dict, group: str) -> dict:
+    from app.application.schemas.system_config import GROUP_MODELS
+    model = GROUP_MODELS[group]
+    masked = {}
+    for k, v in values.items():
+        fi = model.model_fields.get(k)
+        if fi is not None and "SecretStr" in str(fi.annotation):
+            masked[k] = "***"
+        else:
+            masked[k] = v
+    return masked
+
+
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
+@router.get("/groups")
+async def list_groups(
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> list[str]:
+    return _svc(db, cache).list_groups()
+
+
+@router.get("")
+async def get_group(
+    group: str = Query(...),
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> dict:
+    svc = _svc(db, cache)
+    return {"group": group, "values": _mask(await svc.get_group(group), group)}
+
+
+@router.get("/history")
+async def history(
+    key: str = Query(...),
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> list[dict]:
+    repo = ConfigHistoryRepository(db)
+    return _format_history(await repo.list_by_key(key), key)
+
+
+@router.get("/{key}")
+async def get_value(
+    key: str,
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> dict:
+    from app.application.schemas.system_config import group_of_key
+    svc = _svc(db, cache)
+    group = group_of_key(key)
+    return _get_value_result(await svc.get_group(group), key, group)
+
+
+@router.put("/{key}")
+async def put_value(
+    key: str,
+    req: ConfigValueUpdate,
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:update")),
+) -> dict:
+    svc = _svc(db, cache)
+    await svc.set_value(key, req.value, user.id)
+    return {"key": key, "ok": True}
+
+
+@router.post("/init")
+async def init_configs(
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:update")),
+) -> dict:
+    svc = _svc(db, cache)
+    await svc.init_default_configs(user.id)
+    return {"ok": True}
\ No newline at end of file
diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
index 395285d..99483b6 100644
--- a/user-service/back-end/app/main.py
+++ b/user-service/back-end/app/main.py
@@ -1,33 +1,61 @@
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
+import app.domain.models.system_config  # noqa: F401
 import app.domain.models.user  # noqa: F401
+from app.application.services.config_service import ConfigService
+from app.core import crypto
 from app.core.config import settings
-from app.core.database import engine
+from app.core.config_cache import get_config_cache
+from app.core.database import AsyncSessionLocal, engine
 from app.core.exceptions import register_exception_handlers
 from app.domain.models import Base
-from app.interfaces.api import auth, departments, health, users
+from app.interfaces.api import auth, departments, email_templates, health, system_config, users
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
@@ -49,10 +77,12 @@ def create_app() -> FastAPI:
 
     app.include_router(health.router)
     app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
     app.include_router(users.router, prefix=settings.API_V1_PREFIX)
     app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
+    app.include_router(system_config.router, prefix=settings.API_V1_PREFIX)
+    app.include_router(email_templates.router, prefix=settings.API_V1_PREFIX)
 
     return app
 
 
 app = create_app()
\ No newline at end of file
diff --git a/user-service/back-end/app/repositories/system_config_repository.py b/user-service/back-end/app/repositories/system_config_repository.py
new file mode 100644
index 0000000..33b7ea4
--- /dev/null
+++ b/user-service/back-end/app/repositories/system_config_repository.py
@@ -0,0 +1,111 @@
+# app/repositories/system_config_repository.py
+"""系统配置、配置历史、邮件模板仓储."""
+
+from __future__ import annotations
+
+import uuid
+
+from sqlalchemy import func, select
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.domain.models.system_config import ConfigHistory, EmailTemplate, SystemConfig
+
+
+class SystemConfigRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def get_by_key(self, key: str) -> SystemConfig | None:
+        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
+        return result.scalar_one_or_none()
+
+    async def list_by_group(self, group: str) -> list[SystemConfig]:
+        stmt = select(SystemConfig).where(SystemConfig.config_group == group)
+        result = await self.db.execute(stmt)
+        return list(result.scalars().all())
+
+    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
+        stmt = select(SystemConfig)
+        if group is not None:
+            stmt = stmt.where(SystemConfig.config_group == group)
+        stmt = stmt.order_by(SystemConfig.config_group, SystemConfig.config_key)
+        result = await self.db.execute(stmt)
+        return list(result.scalars().all())
+
+    async def upsert(self, key: str, value: str, group: str, type_: str,
+                     is_encrypted: bool, updated_by: uuid.UUID | None,
+                     description: str | None = None) -> SystemConfig:
+        existing = await self.get_by_key(key)
+        if existing is None:
+            row = SystemConfig(config_key=key, config_value=value, config_group=group,
+                               config_type=type_, is_encrypted=is_encrypted,
+                               updated_by=updated_by, description=description)
+            self.db.add(row)
+            await self.db.flush()
+            return row
+        existing.config_value = value
+        existing.config_group = group
+        existing.config_type = type_
+        existing.is_encrypted = is_encrypted
+        existing.updated_by = updated_by
+        if description is not None:
+            existing.description = description
+        await self.db.flush()
+        return existing
+
+
+class ConfigHistoryRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def add(self, key: str, old_value: str | None, new_value: str | None,
+                  changed_by: uuid.UUID) -> ConfigHistory:
+        row = ConfigHistory(config_key=key, old_value=old_value, new_value=new_value,
+                            changed_by=changed_by)
+        self.db.add(row)
+        await self.db.flush()
+        return row
+
+    async def list_by_key(self, key: str) -> list[ConfigHistory]:
+        result = await self.db.execute(
+            select(ConfigHistory).where(ConfigHistory.config_key == key)
+            .order_by(ConfigHistory.changed_at.desc())
+        )
+        return list(result.scalars().all())
+
+
+class EmailTemplateRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
+        return await self.db.get(EmailTemplate, tpl_id)
+
+    async def get_by_code(self, code: str) -> EmailTemplate | None:
+        stmt = select(EmailTemplate).where(EmailTemplate.template_code == code)
+        result = await self.db.execute(stmt)
+        return result.scalar_one_or_none()
+
+    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
+        total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
+        total = int(total_result.scalar_one())
+        result = await self.db.execute(
+            select(EmailTemplate).order_by(EmailTemplate.template_code)
+            .offset((page - 1) * size).limit(size)
+        )
+        return list(result.scalars().all()), total
+
+    async def add(self, tpl: EmailTemplate) -> EmailTemplate:
+        self.db.add(tpl)
+        await self.db.flush()
+        return tpl
+
+    async def delete(self, tpl: EmailTemplate) -> None:
+        await self.db.delete(tpl)
+
+
+__all__ = [
+    "SystemConfigRepository",
+    "ConfigHistoryRepository",
+    "EmailTemplateRepository",
+]
\ No newline at end of file
diff --git a/user-service/back-end/pyproject.toml b/user-service/back-end/pyproject.toml
index 81f1120..21d02bd 100644
--- a/user-service/back-end/pyproject.toml
+++ b/user-service/back-end/pyproject.toml
@@ -17,10 +17,11 @@ dependencies = [
     "python-jose[cryptography]>=3.3",
     "passlib[bcrypt]>=1.7.4",
     "bcrypt<4.0.0",
     "redis>=5.0",
     "cachetools>=5.3",
+    "cryptography>=43.0",
 ]
 
 [project.optional-dependencies]
 dev = [
     "pytest>=8.0",
diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
index 9e0c8c5..8428248 100644
--- a/user-service/back-end/tests/conftest.py
+++ b/user-service/back-end/tests/conftest.py
@@ -14,18 +14,33 @@ from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
 
 # 确保所有模型注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
+import app.domain.models.system_config  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
 from app.core.database import get_db
 from app.domain.models import Base
 from app.domain.models.enums import DataScope
 from app.domain.models.role import Permission, Role
 from app.main import app
 
 
+@pytest.fixture(autouse=True)
+def _encryption_key(monkeypatch):
+    from cryptography.fernet import Fernet
+
+    from app.core import config as _config
+
+    monkeypatch.setattr(
+        _config.settings, "CONFIG_ENCRYPTION_KEY", Fernet.generate_key().decode()
+    )
+    # crypto 模块缓存了 _fernet,重置以用新密钥
+    from app.core import crypto
+    crypto._fernet = None
+
+
 @pytest.fixture(scope="session")
 def db_file():
     fd, path = tempfile.mkstemp(suffix=".db")
     os.close(fd)
     yield path
@@ -86,10 +101,22 @@ async def seed(db_session):
                    resource="dept", action="create"),
         Permission(name="部门更新", code="dept:update", type="ACTION",
                    resource="dept", action="update"),
         Permission(name="部门删除", code="dept:delete", type="ACTION",
                    resource="dept", action="delete"),
+        Permission(name="配置读取", code="config:read", type="ACTION",
+                   resource="config", action="read"),
+        Permission(name="配置更新", code="config:update", type="ACTION",
+                   resource="config", action="update"),
+        Permission(name="模板读取", code="template:read", type="ACTION",
+                   resource="template", action="read"),
+        Permission(name="模板创建", code="template:create", type="ACTION",
+                   resource="template", action="create"),
+        Permission(name="模板更新", code="template:update", type="ACTION",
+                   resource="template", action="update"),
+        Permission(name="模板删除", code="template:delete", type="ACTION",
+                   resource="template", action="delete"),
     ]
     db_session.add_all(perms)
     await db_session.flush()
 
     admin = Role(name="管理员", code="ADMIN", data_scope=DataScope.ALL)
@@ -109,10 +136,12 @@ async def client(engine, seed) -> AsyncIterator[AsyncClient]:
             yield session
 
     app.dependency_overrides[get_db] = override_get_db
     from app.core.cache import NoopDepartmentCache, get_department_cache
     app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
+    from app.core.config_cache import LocalTTLCache, get_config_cache
+    app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()
     transport = ASGITransport(app=app)
     async with AsyncClient(transport=transport, base_url="http://test") as ac:
         yield ac
     app.dependency_overrides.clear()
 
diff --git a/user-service/back-end/tests/test_config_cache.py b/user-service/back-end/tests/test_config_cache.py
new file mode 100644
index 0000000..5c7fb33
--- /dev/null
+++ b/user-service/back-end/tests/test_config_cache.py
@@ -0,0 +1,159 @@
+# tests/test_config_cache.py
+from __future__ import annotations
+
+import pytest
+
+from app.core.config_cache import ConfigCache, LocalTTLCache, get_config_cache
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_local_cache_miss_and_set():
+    cache = LocalTTLCache()
+    assert await cache.get_group("MAIL") is None
+    await cache.set_group("MAIL", {"host": "smtp"})
+    assert await cache.get_group("MAIL") == {"host": "smtp"}
+
+
+async def test_local_cache_invalidate():
+    cache = LocalTTLCache()
+    await cache.set_group("MAIL", {"a": 1})
+    await cache.set_group("SECURITY", {"b": 2})
+    await cache.invalidate("MAIL")
+    assert await cache.get_group("MAIL") is None
+    assert await cache.get_group("SECURITY") == {"b": 2}
+    await cache.invalidate()  # 全清
+    assert await cache.get_group("SECURITY") is None
+
+
+async def test_local_cache_start_subscriber_noop():
+    cache = LocalTTLCache()
+    await cache.start_subscriber()  # 不抛错
+
+
+async def test_factory_returns_local_when_disabled(monkeypatch):
+    from app.core.config import settings
+    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
+    cache = await get_config_cache()
+    assert isinstance(cache, LocalTTLCache)
+
+
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
+def test_protocol_compat():
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
+                msg = types.SimpleNamespace(
+                    type="message", channel=channel, data=message
+                )
+                self._queue.append(msg)
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
diff --git a/user-service/back-end/tests/test_config_group_models.py b/user-service/back-end/tests/test_config_group_models.py
new file mode 100644
index 0000000..d664a23
--- /dev/null
+++ b/user-service/back-end/tests/test_config_group_models.py
@@ -0,0 +1,51 @@
+from __future__ import annotations
+
+import pytest
+from pydantic import ValidationError
+
+from app.application.schemas.system_config import (
+    GROUP_MODELS,
+    MailConfig,
+    SecurityPolicy,
+    SystemParams,
+    group_of_key,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+def test_group_of_key():
+    assert group_of_key("mail.host") == "MAIL"
+    assert group_of_key("security.password_min_length") == "SECURITY"
+    assert group_of_key("performance.cache_user_info_ttl") == "PERFORMANCE"
+    assert group_of_key("system.site_name") == "SYSTEM"
+
+
+def test_group_of_key_unknown():
+    with pytest.raises(ValueError):
+        group_of_key("unknown.x")
+
+
+def test_security_policy_validates_range():
+    with pytest.raises(ValidationError):
+        SecurityPolicy(
+            password_min_length=3,  # < 6
+            password_require_uppercase=True, password_require_lowercase=True,
+            password_require_digits=True, password_require_special=True,
+            password_history_size=5, password_expiration_days=90,
+            login_max_attempts=5, login_lock_minutes=30, session_timeout_minutes=15,
+        )
+
+
+def test_mail_config_port_range():
+    with pytest.raises(ValidationError):
+        MailConfig(host="smtp", port=99999, username="u", password="p")
+
+
+def test_system_params_locale_pattern():
+    with pytest.raises(ValidationError):
+        SystemParams(site_name="x", default_locale="invalid", support_email="a@b.com")
+
+
+def test_group_models_keys():
+    assert set(GROUP_MODELS.keys()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_config_service.py b/user-service/back-end/tests/test_config_service.py
new file mode 100644
index 0000000..89f09c0
--- /dev/null
+++ b/user-service/back-end/tests/test_config_service.py
@@ -0,0 +1,134 @@
+# tests/test_config_service.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.application.services.config_service import ConfigService
+from app.core import crypto
+from app.core.config_cache import LocalTTLCache
+from app.core.exceptions import BusinessException
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository,
+    SystemConfigRepository,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+def _svc(db):
+    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
+                          crypto, LocalTTLCache())
+
+
+async def test_init_default_configs_seeds_all(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        rows = await svc.repo.list_keys()
+        groups = {r.config_group for r in rows}
+        assert groups == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+        # 每组至少 1 个 key
+        assert len(rows) >= 4
+
+
+async def test_init_idempotent(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        first = sorted(r.config_value for r in await svc.repo.list_keys())
+        await svc.init_default_configs(uuid.uuid4())  # 不覆盖
+        await db.commit()
+        second = sorted(r.config_value for r in await svc.repo.list_keys())
+        assert first == second
+
+
+async def test_set_value_validates_group(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        with pytest.raises(BusinessException):
+            await svc.set_value("security.password_min_length", "3", uuid.uuid4())
+
+
+async def test_set_value_secret_encrypts(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        await svc.set_value("mail.password", "smtp-secret-123", uuid.uuid4())
+        await db.commit()
+        row = await svc.repo.get_by_key("mail.password")
+        assert row.is_encrypted is True
+        assert row.config_value != "smtp-secret-123"  # 密文
+        assert svc.crypto.decrypt(row.config_value) == "smtp-secret-123"
+        # get_value 解密
+        val = await svc.get_value("mail.password")
+        assert val == "smtp-secret-123"
+        # 历史存密文
+        hist = await svc.history_repo.list_by_key("mail.password")
+        assert hist and hist[0].new_value != "smtp-secret-123"
+
+
+async def test_get_group_returns_real_values(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        grp = await svc.get_group("SYSTEM")
+        assert "site_name" in grp
+
+
+async def test_set_value_records_history(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        await svc.set_value("system.site_name", "NewName", uuid.uuid4())
+        await db.commit()
+        hist = await svc.history_repo.list_by_key("system.site_name")
+        assert len(hist) == 1
+        assert hist[0].new_value == "NewName"
+
+
+async def test_unknown_group_rejected(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        with pytest.raises(BusinessException):
+            await svc.set_value("unknown.x", "v", uuid.uuid4())
+
+
+async def test_cache_invalidation_on_set(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+
+    class SpyCache(LocalTTLCache):
+        def __init__(self):
+            super().__init__()
+            self.invalidated: list = []
+
+        async def invalidate(self, group=None):
+            self.invalidated.append(group)
+
+    async with Session() as db:
+        spy = SpyCache()
+        svc = ConfigService(
+            db, SystemConfigRepository(db),
+            ConfigHistoryRepository(db), crypto, spy,
+        )
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        await svc.set_value("system.site_name", "Z", uuid.uuid4())
+        await db.commit()
+        assert "SYSTEM" in spy.invalidated
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_crypto.py b/user-service/back-end/tests/test_crypto.py
new file mode 100644
index 0000000..e2f5b21
--- /dev/null
+++ b/user-service/back-end/tests/test_crypto.py
@@ -0,0 +1,26 @@
+from __future__ import annotations
+
+import pytest
+
+from app.core.crypto import decrypt, encrypt
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_encrypt_decrypt_roundtrip():
+    plain = "smtp-password-123"
+    cipher = encrypt(plain)
+    assert cipher != plain and isinstance(cipher, str)
+    assert decrypt(cipher) == plain
+
+
+async def test_encrypt_different_each_time():
+    a = encrypt("x")
+    b = encrypt("x")
+    assert a != b  # Fernet 每次带随机 IV
+
+
+def test_decrypt_invalid_token_raises():
+    from cryptography.fernet import InvalidToken
+    with pytest.raises(InvalidToken):
+        decrypt("not-a-valid-fernet-token")
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_email_template_service.py b/user-service/back-end/tests/test_email_template_service.py
new file mode 100644
index 0000000..4d7e6b8
--- /dev/null
+++ b/user-service/back-end/tests/test_email_template_service.py
@@ -0,0 +1,69 @@
+from __future__ import annotations
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
+from app.application.services.email_template_service import EmailTemplateService
+from app.core.exceptions import ConflictError, NotFoundError
+from app.repositories.system_config_repository import EmailTemplateRepository
+
+pytestmark = pytest.mark.asyncio
+
+
+def _svc(db):
+    return EmailTemplateService(db, EmailTemplateRepository(db))
+
+
+async def test_create_and_get(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        tpl = await svc.create(EmailTemplateCreate(
+            template_code="USER_ACTIVATION", template_name="激活", subject="欢迎",
+            content="Hi {{name}}",
+            variables=[{"name": "name", "description": "用户名", "required": True}]))
+        await db.commit()
+        got = await svc.get(tpl.id)
+        assert got.template_code == "USER_ACTIVATION"
+
+
+async def test_create_code_conflict(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
+                                             subject="s", content="c"))
+        await db.commit()
+        with pytest.raises(ConflictError):
+            await svc.create(EmailTemplateCreate(template_code="X", template_name="n2",
+                                                 subject="s2", content="c2"))
+        await db.commit()
+
+
+async def test_update_and_delete(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        tpl = await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
+                                                   subject="s", content="c"))
+        await db.commit()
+        updated = await svc.update(tpl.id, EmailTemplateUpdate(template_name="n2"))
+        await db.commit()
+        assert updated.template_name == "n2"
+        await svc.delete(tpl.id)
+        await db.commit()
+        with pytest.raises(NotFoundError):
+            await svc.get(tpl.id)
+
+
+async def test_list_pagination(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        for i in range(3):
+            await svc.create(EmailTemplateCreate(template_code=f"C{i}", template_name=f"n{i}",
+                                                 subject="s", content="c"))
+            await db.commit()
+        items, total = await svc.list(1, 2)
+        assert total == 3 and len(items) == 2
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_email_templates_api.py b/user-service/back-end/tests/test_email_templates_api.py
new file mode 100644
index 0000000..62eab28
--- /dev/null
+++ b/user-service/back-end/tests/test_email_templates_api.py
@@ -0,0 +1,37 @@
+from __future__ import annotations
+
+import pytest
+
+pytestmark = pytest.mark.asyncio
+
+
+async def _h(token):
+    return {"Authorization": f"Bearer {token}"}
+
+
+TPL = {"template_code": "USER_ACTIVATION", "template_name": "激活",
+       "subject": "欢迎", "content": "Hi {{name}}",
+       "variables": [{"name": "name", "description": "用户名", "required": True}]}
+
+
+async def test_template_crud(client, admin_token):
+    h = await _h(admin_token)
+    create = await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    assert create.status_code == 201, create.text
+    tid = create.json()["id"]
+    got = await client.get(f"/api/v1/email-templates/{tid}", headers=h)
+    assert got.status_code == 200 and got.json()["template_code"] == "USER_ACTIVATION"
+    lst = await client.get("/api/v1/email-templates", headers=h)
+    assert lst.status_code == 200 and lst.json()["total"] == 1
+    upd = await client.put(f"/api/v1/email-templates/{tid}",
+                           json={"template_name": "激活2"}, headers=h)
+    assert upd.status_code == 200 and upd.json()["template_name"] == "激活2"
+    dele = await client.delete(f"/api/v1/email-templates/{tid}", headers=h)
+    assert dele.status_code == 204
+
+
+async def test_template_code_conflict(client, admin_token):
+    h = await _h(admin_token)
+    await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    resp = await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    assert resp.status_code == 409
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_system_config_api.py b/user-service/back-end/tests/test_system_config_api.py
new file mode 100644
index 0000000..b8745bc
--- /dev/null
+++ b/user-service/back-end/tests/test_system_config_api.py
@@ -0,0 +1,67 @@
+from __future__ import annotations
+
+import pytest
+
+pytestmark = pytest.mark.asyncio
+
+
+async def _h(token):
+    return {"Authorization": f"Bearer {token}"}
+
+
+async def test_init_and_get_group_masks_secret(client, admin_token):
+    resp = await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    assert resp.status_code == 200, resp.text
+    grp = await client.get("/api/v1/config?group=MAIL", headers=await _h(admin_token))
+    assert grp.status_code == 200
+    body = grp.json()
+    assert body["group"] == "MAIL"
+    assert body["values"]["password"] == "***"
+
+
+async def test_get_groups(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.get("/api/v1/config/groups", headers=await _h(admin_token))
+    assert resp.status_code == 200
+    assert set(resp.json()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+
+
+async def test_put_value_validates(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.put("/api/v1/config/security.password_min_length",
+                            json={"value": "3"}, headers=await _h(admin_token))
+    assert resp.status_code == 400
+
+
+async def test_put_value_secret(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.put("/api/v1/config/mail.password",
+                            json={"value": "new-secret"}, headers=await _h(admin_token))
+    assert resp.status_code == 200, resp.text
+    # GET 单 key 掩码
+    g = await client.get("/api/v1/config/mail.password", headers=await _h(admin_token))
+    assert g.status_code == 200 and g.json()["value"] == "***"
+
+
+async def test_history(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    await client.put("/api/v1/config/system.site_name",
+                     json={"value": "NewName"}, headers=await _h(admin_token))
+    resp = await client.get("/api/v1/config/history?key=system.site_name",
+                            headers=await _h(admin_token))
+    assert resp.status_code == 200
+    assert len(resp.json()) >= 1
+
+
+async def test_regular_user_forbidden(client):
+    reg = await client.post("/api/v1/auth/register", json={
+        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
+    assert reg.status_code == 201
+    login = await client.post(
+        "/api/v1/auth/login",
+        json={"email": "r@t.com", "password": "Rr@12345"},
+    )
+    token = login.json()["access_token"]
+    resp = await client.put("/api/v1/config/system.site_name",
+                            json={"value": "x"}, headers=await _h(token))
+    assert resp.status_code == 403
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
new file mode 100644
index 0000000..a430fbe
--- /dev/null
+++ b/user-service/back-end/tests/test_system_config_model.py
@@ -0,0 +1,35 @@
+# tests/test_system_config_model.py
+from __future__ import annotations
+
+import pytest
+from sqlalchemy import inspect
+
+import app.domain.models.associations  # noqa: F401
+import app.domain.models.department  # noqa: F401
+import app.domain.models.role  # noqa: F401
+import app.domain.models.system_config  # noqa: F401
+import app.domain.models.user  # noqa: F401
+from app.domain.models import Base
+
+pytestmark = pytest.mark.asyncio
+
+
+def test_system_config_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
+    assert {"id", "config_key", "config_value", "config_group", "config_type",
+            "is_encrypted", "description", "updated_by",
+            "created_at", "updated_at"} <= cols
+    assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
+
+
+def test_config_history_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
+    assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
+    assert Base.metadata.tables["config_history"].columns["changed_at"].index is True
+
+
+def test_email_template_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
+    assert {"id", "template_code", "template_name", "subject", "content",
+            "variables", "is_active", "created_at", "updated_at"} <= cols
+    assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_system_config_repository.py b/user-service/back-end/tests/test_system_config_repository.py
new file mode 100644
index 0000000..78a94d2
--- /dev/null
+++ b/user-service/back-end/tests/test_system_config_repository.py
@@ -0,0 +1,69 @@
+# tests/test_system_config_repository.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.domain.models.system_config import EmailTemplate
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository,
+    EmailTemplateRepository,
+    SystemConfigRepository,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_upsert_inserts_and_updates(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = SystemConfigRepository(db)
+        await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
+        await db.commit()
+        got = await repo.get_by_key("mail.host")
+        assert got is not None and got.config_value == "smtp.x.com"
+        await repo.upsert("mail.host", "smtp.y.com", "MAIL", "STRING", False, None)
+        await db.commit()
+        got2 = await repo.get_by_key("mail.host")
+        assert got2.config_value == "smtp.y.com"
+
+
+async def test_list_by_group(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = SystemConfigRepository(db)
+        await repo.upsert("mail.host", "h", "MAIL", "STRING", False, None)
+        await repo.upsert("mail.port", "25", "MAIL", "INT", False, None)
+        await repo.upsert("system.site_name", "s", "SYSTEM", "STRING", False, None)
+        await db.commit()
+        rows = await repo.list_by_group("MAIL")
+        assert {r.config_key for r in rows} == {"mail.host", "mail.port"}
+
+
+async def test_config_history(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        hist = ConfigHistoryRepository(db)
+        await hist.add("mail.host", "old", "new", uuid.uuid4())
+        await db.commit()
+        rows = await hist.list_by_key("mail.host")
+        assert len(rows) == 1 and rows[0].new_value == "new"
+
+
+async def test_email_template_repo(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = EmailTemplateRepository(db)
+        tpl = EmailTemplate(template_code="USER_ACTIVATION", template_name="激活",
+                            subject="欢迎", content="Hi {{name}}",
+                            variables=[{"name": "name", "description": "用户名", "required": True}])
+        await repo.add(tpl)
+        await db.commit()
+        assert (await repo.get_by_code("USER_ACTIVATION")).template_name == "激活"
+        items, total = await repo.list(1, 20)
+        assert total == 1
+        await repo.delete(tpl)
+        await db.commit()
+        assert await repo.get_by_code("USER_ACTIVATION") is None
\ No newline at end of file
diff --git a/user-service/back-end/uv.lock b/user-service/back-end/uv.lock
index 9e97319..c630593 100644
--- a/user-service/back-end/uv.lock
+++ b/user-service/back-end/uv.lock
@@ -1216,10 +1216,11 @@ dependencies = [
     { name = "aiosqlite" },
     { name = "alembic" },
     { name = "asyncpg" },
     { name = "bcrypt" },
     { name = "cachetools" },
+    { name = "cryptography" },
     { name = "email-validator" },
     { name = "fastapi" },
     { name = "passlib", extra = ["bcrypt"] },
     { name = "pydantic" },
     { name = "pydantic-settings" },
@@ -1245,10 +1246,11 @@ requires-dist = [
     { name = "aiosqlite", specifier = ">=0.20" },
     { name = "alembic", specifier = ">=1.13" },
     { name = "asyncpg", specifier = ">=0.29" },
     { name = "bcrypt", specifier = "<4.0.0" },
     { name = "cachetools", specifier = ">=5.3" },
+    { name = "cryptography", specifier = ">=43.0" },
     { name = "email-validator", specifier = ">=2.1" },
     { name = "fastapi", specifier = ">=0.115" },
     { name = "httpx", marker = "extra == 'dev'", specifier = ">=0.27" },
     { name = "mypy", marker = "extra == 'dev'", specifier = ">=1.10" },
     { name = "passlib", extras = ["bcrypt"], specifier = ">=1.7.4" },
