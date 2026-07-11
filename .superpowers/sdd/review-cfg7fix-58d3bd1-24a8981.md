## commits 58d3bd1..24a8981
24a8981 fix(config): ConfigService 清理(删除错误 DepartmentCache import + SecretStr 提顶 + _PREFIX 复用 + list_keys 返回类型)

## diff -U8
diff --git a/user-service/back-end/app/application/services/config_service.py b/user-service/back-end/app/application/services/config_service.py
index ba4aa9e..bffa2ad 100644
--- a/user-service/back-end/app/application/services/config_service.py
+++ b/user-service/back-end/app/application/services/config_service.py
@@ -2,24 +2,26 @@
 """系统配置服务:CRUD + 分组校验 + 加解密 + 历史 + 缓存."""
 
 from __future__ import annotations
 
 import json
 import uuid
 from typing import Any
 
+from pydantic import SecretStr
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.application.schemas.system_config import GROUP_MODELS, group_of_key
-from app.core.cache import DepartmentCache  # noqa: F401  (避免循环,仅类型注解用)
 from app.core.config_cache import ConfigCache
 from app.core.exceptions import BusinessException, NotFoundError
+from app.domain.models.system_config import SystemConfig
 from app.repositories.system_config_repository import (
-    ConfigHistoryRepository, SystemConfigRepository,
+    ConfigHistoryRepository,
+    SystemConfigRepository,
 )
 
 # 默认配置(每组模型默认值的扁平 key 形式)
 _DEFAULTS: dict[str, dict] = {
     "MAIL": {"host": "smtp.example.com", "port": "587", "username": "noreply@example.com",
              "password": "change-me", "protocol": "smtp", "starttls": "true"},
     "SECURITY": {"password_min_length": "8", "password_require_uppercase": "true",
                  "password_require_lowercase": "true", "password_require_digits": "true",
@@ -128,17 +130,16 @@ class ConfigService:
         group_dict = await self._load_group_dict(group)
         group_dict[field] = value
         model_cls = GROUP_MODELS[group]
         # SECRET 字段用 SecretStr,其余用原值
         validate_dict = {}
         for k, v in group_dict.items():
             field_info = model_cls.model_fields.get(k)
             if field_info is not None and "SecretStr" in str(field_info.annotation):
-                from pydantic import SecretStr
                 validate_dict[k] = SecretStr(str(v))
             else:
                 validate_dict[k] = v
         try:
             model_cls(**validate_dict)
         except Exception as exc:
             raise BusinessException(f"配置校验失败: {exc}") from exc
         # 持久化
@@ -151,26 +152,25 @@ class ConfigService:
         await self.db.commit()
         await self.cache.invalidate(group)
 
     async def create_or_init(self, key: str, value: Any, group: str, type_: str,
                              description: str | None, updated_by: uuid.UUID) -> None:
         if await self.repo.get_by_key(key) is not None:
             return  # 幂等
         storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
-        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by, description)
+        await self.repo.upsert(key, storage_value, group, type_, is_encrypted,
+                               updated_by, description)
         await self.db.commit()
 
     async def init_default_configs(self, updated_by: uuid.UUID) -> None:
-        prefix_map = {"MAIL": "mail", "SECURITY": "security",
-                      "PERFORMANCE": "performance", "SYSTEM": "system"}
         for group, fields in _DEFAULTS.items():
             for field, value in fields.items():
-                key = f"{prefix_map[group]}.{field}"
+                key = f"{_PREFIX[group]}.{field}"
                 type_ = _TYPES[key]
                 await self.create_or_init(key, value, group, type_, None, updated_by)
         await self.cache.invalidate()
 
     def list_groups(self) -> list[str]:
         return list(GROUP_MODELS.keys())
 
-    async def list_keys(self, group: str | None = None) -> list:
+    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
         return await self.repo.list_keys(group)
\ No newline at end of file
