## commits d1e9ac1..33cf225
33cf225 feat(config): Fernet 加密模块 + CONFIG_ENCRYPTION_KEY

## stat
 user-service/back-end/app/core/config.py   |  5 +++++
 user-service/back-end/app/core/crypto.py   | 26 ++++++++++++++++++++++++++
 user-service/back-end/pyproject.toml       |  1 +
 user-service/back-end/tests/conftest.py    | 14 ++++++++++++++
 user-service/back-end/tests/test_crypto.py | 26 ++++++++++++++++++++++++++
 user-service/back-end/uv.lock              |  2 ++
 6 files changed, 74 insertions(+)

## diff -U10
diff --git a/user-service/back-end/app/core/config.py b/user-service/back-end/app/core/config.py
index 5041d52..a291e3d 100644
--- a/user-service/back-end/app/core/config.py
+++ b/user-service/back-end/app/core/config.py
@@ -28,17 +28,22 @@ class Settings(BaseSettings):
 
     # 密码策略
     PASSWORD_MIN_LENGTH: int = 8
 
     # Redis（可选，测试不依赖）
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
 
 
 settings = get_settings()
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
diff --git a/user-service/back-end/pyproject.toml b/user-service/back-end/pyproject.toml
index 81f1120..21d02bd 100644
--- a/user-service/back-end/pyproject.toml
+++ b/user-service/back-end/pyproject.toml
@@ -12,20 +12,21 @@ dependencies = [
     "asyncpg>=0.29",
     "alembic>=1.13",
     "pydantic>=2.7",
     "pydantic-settings>=2.3",
     "email-validator>=2.1",
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
     "pytest-asyncio>=0.23",
     "pytest-cov>=5.0",
     "httpx>=0.27",
     "ruff>=0.5",
     "mypy>=1.10",
diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
index 9e0c8c5..613f607 100644
--- a/user-service/back-end/tests/conftest.py
+++ b/user-service/back-end/tests/conftest.py
@@ -17,20 +17,34 @@ import app.domain.models.associations  # noqa: F401  pylint: disable=unused-impo
 import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
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
     try:
         os.remove(path)
     except OSError:
         pass
 
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
diff --git a/user-service/back-end/uv.lock b/user-service/back-end/uv.lock
index 9e97319..c630593 100644
--- a/user-service/back-end/uv.lock
+++ b/user-service/back-end/uv.lock
@@ -1211,20 +1211,21 @@ wheels = [
 [[package]]
 name = "user-service-backend"
 version = "0.1.0"
 source = { editable = "." }
 dependencies = [
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
     { name = "python-jose", extra = ["cryptography"] },
     { name = "python-multipart" },
     { name = "redis" },
     { name = "sqlalchemy", extra = ["asyncio"] },
     { name = "uvicorn", extra = ["standard"] },
@@ -1240,20 +1241,21 @@ dev = [
     { name = "ruff" },
 ]
 
 [package.metadata]
 requires-dist = [
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
     { name = "pydantic", specifier = ">=2.7" },
     { name = "pydantic-settings", specifier = ">=2.3" },
     { name = "pytest", marker = "extra == 'dev'", specifier = ">=8.0" },
     { name = "pytest-asyncio", marker = "extra == 'dev'", specifier = ">=0.23" },
     { name = "pytest-cov", marker = "extra == 'dev'", specifier = ">=5.0" },
