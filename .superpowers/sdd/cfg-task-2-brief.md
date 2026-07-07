## Task 2: 加密模块(crypto.py + CONFIG_ENCRYPTION_KEY + cryptography 依赖)

**Files:**
- Create: `app/core/crypto.py`
- Modify: `app/core/config.py`(新增 `CONFIG_ENCRYPTION_KEY: str`)
- Modify: `pyproject.toml`(dependencies 加 `"cryptography>=43.0"`)
- Test: `tests/test_crypto.py`

**Interfaces:**
- Produces: `encrypt(plain: str) -> str`、`decrypt(cipher: str) -> str`(Fernet;密钥从 `settings.CONFIG_ENCRYPTION_KEY`)。`decrypt` 密文损坏抛 `cryptography.fernet.InvalidToken`。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_crypto.py
from __future__ import annotations

import pytest

from app.core.crypto import decrypt, encrypt

pytestmark = pytest.mark.asyncio


async def test_encrypt_decrypt_roundtrip():
    plain = "smtp-password-123"
    cipher = encrypt(plain)
    assert cipher != plain and isinstance(cipher, str)
    assert decrypt(cipher) == plain


async def test_encrypt_different_each_time():
    a = encrypt("x")
    b = encrypt("x")
    assert a != b  # Fernet 每次带随机 IV


def test_decrypt_invalid_token_raises():
    from cryptography.fernet import InvalidToken
    with pytest.raises(InvalidToken):
        decrypt("not-a-valid-fernet-token")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_crypto.py -v`
Expected: FAIL(`ModuleNotFoundError: app.core.crypto`)

- [ ] **Step 3: 加依赖 + 配置**

`pyproject.toml` dependencies 数组追加(在 `cachetools>=5.3` 后):
```toml
    "cryptography>=43.0",
```
运行 `uv sync --extra dev`。

`app/core/config.py` Settings 类追加(在 `CACHE_ENABLED` 后):
```python
    # 配置加密密钥(Fernet,启动期必须提供)
    CONFIG_ENCRYPTION_KEY: str = ""  # 生产由 .env 注入;测试由 fixture 注入
    # 配置缓存开关(测试置 False 强制 LocalTTLCache)
    CONFIG_CACHE_ENABLED: bool = True
```

- [ ] **Step 4: 实现 crypto**

```python
# app/core/crypto.py
"""Fernet 对称加密(敏感配置)."""

from __future__ import annotations

from cryptography.fernet import Fernet

from app.core.config import settings

_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        if not settings.CONFIG_ENCRYPTION_KEY:
            raise RuntimeError("CONFIG_ENCRYPTION_KEY 未配置:无法加解密敏感配置")
        _fernet = Fernet(settings.CONFIG_ENCRYPTION_KEY.encode())
    return _fernet


def encrypt(plain: str) -> str:
    return _get_fernet().encrypt(plain.encode()).decode()


def decrypt(cipher: str) -> str:
    return _get_fernet().decrypt(cipher.encode()).decode()
```

- [ ] **Step 5: conftest 注入测试密钥**

在 `tests/conftest.py` 顶部 import 区后加 autouse fixture(确保所有测试有密钥):
```python
import pytest
from cryptography.fernet import Fernet
from app.core import config as _config


@pytest.fixture(autouse=True)
def _encryption_key(monkeypatch):
    monkeypatch.setattr(_config.settings, "CONFIG_ENCRYPTION_KEY", Fernet.generate_key().decode())
    # crypto 模块缓存了 _fernet,重置以用新密钥
    from app.core import crypto
    crypto._fernet = None
```

- [ ] **Step 6: 运行测试确认通过**

Run: `uv run pytest tests/test_crypto.py -v`
Expected: PASS(3 passed);全量无回归。

- [ ] **Step 7: 提交**

```bash
git add app/core/crypto.py app/core/config.py pyproject.toml uv.lock tests/test_crypto.py tests/conftest.py
git commit -m "feat(config): Fernet 加密模块 + CONFIG_ENCRYPTION_KEY"
```

---

