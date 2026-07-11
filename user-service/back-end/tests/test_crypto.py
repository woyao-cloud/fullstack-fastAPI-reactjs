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