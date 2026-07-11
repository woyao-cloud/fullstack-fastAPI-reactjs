## commits 33cf225..16a4cc2
16a4cc2 feat(config): 分组 Pydantic 模型 + key→组映射

## stat
 .../app/application/schemas/system_config.py       | 62 ++++++++++++++++++++++
 .../back-end/tests/test_config_group_models.py     | 47 ++++++++++++++++
 2 files changed, 109 insertions(+)

## diff -U10
diff --git a/user-service/back-end/app/application/schemas/system_config.py b/user-service/back-end/app/application/schemas/system_config.py
new file mode 100644
index 0000000..d150531
--- /dev/null
+++ b/user-service/back-end/app/application/schemas/system_config.py
@@ -0,0 +1,62 @@
+"""系统配置分组 Pydantic 模型 + key→组映射."""
+
+from __future__ import annotations
+
+from typing import Literal
+
+from pydantic import BaseModel, EmailStr, Field, SecretStr
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
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_config_group_models.py b/user-service/back-end/tests/test_config_group_models.py
new file mode 100644
index 0000000..d321df7
--- /dev/null
+++ b/user-service/back-end/tests/test_config_group_models.py
@@ -0,0 +1,47 @@
+from __future__ import annotations
+
+import pytest
+from pydantic import ValidationError
+
+from app.application.schemas.system_config import (
+    GROUP_MODELS, MailConfig, SecurityPolicy, SystemParams, group_of_key,
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
