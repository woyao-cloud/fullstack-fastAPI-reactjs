## commits 1065e8e..58d3bd1
58d3bd1 feat(config): ConfigService(CRUD/分组校验/加解密/历史/缓存)

## stat
 .../app/application/services/config_service.py     | 176 +++++++++++++++++++++
 user-service/back-end/tests/test_config_service.py | 130 +++++++++++++++
 2 files changed, 306 insertions(+)

## diff -U10
diff --git a/user-service/back-end/app/application/services/config_service.py b/user-service/back-end/app/application/services/config_service.py
new file mode 100644
index 0000000..ba4aa9e
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
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.schemas.system_config import GROUP_MODELS, group_of_key
+from app.core.cache import DepartmentCache  # noqa: F401  (避免循环,仅类型注解用)
+from app.core.config_cache import ConfigCache
+from app.core.exceptions import BusinessException, NotFoundError
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, SystemConfigRepository,
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
+                from pydantic import SecretStr
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
+        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by, description)
+        await self.db.commit()
+
+    async def init_default_configs(self, updated_by: uuid.UUID) -> None:
+        prefix_map = {"MAIL": "mail", "SECURITY": "security",
+                      "PERFORMANCE": "performance", "SYSTEM": "system"}
+        for group, fields in _DEFAULTS.items():
+            for field, value in fields.items():
+                key = f"{prefix_map[group]}.{field}"
+                type_ = _TYPES[key]
+                await self.create_or_init(key, value, group, type_, None, updated_by)
+        await self.cache.invalidate()
+
+    def list_groups(self) -> list[str]:
+        return list(GROUP_MODELS.keys())
+
+    async def list_keys(self, group: str | None = None) -> list:
+        return await self.repo.list_keys(group)
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_config_service.py b/user-service/back-end/tests/test_config_service.py
new file mode 100644
index 0000000..41028df
--- /dev/null
+++ b/user-service/back-end/tests/test_config_service.py
@@ -0,0 +1,130 @@
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
+from app.core.exceptions import BusinessException, NotFoundError
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, SystemConfigRepository,
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
+        svc = ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, spy)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        await svc.set_value("system.site_name", "Z", uuid.uuid4())
+        await db.commit()
+        assert "SYSTEM" in spy.invalidated
\ No newline at end of file
