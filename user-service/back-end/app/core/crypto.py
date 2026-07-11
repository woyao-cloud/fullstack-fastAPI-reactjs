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