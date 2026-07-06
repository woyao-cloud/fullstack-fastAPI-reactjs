# tests/test_config_service.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.services.config_service import ConfigService
from app.core import crypto
from app.core.config_cache import LocalTTLCache
from app.core.exceptions import BusinessException
from app.repositories.system_config_repository import (
    ConfigHistoryRepository,
    SystemConfigRepository,
)

pytestmark = pytest.mark.asyncio


def _svc(db):
    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
                          crypto, LocalTTLCache())


async def test_init_default_configs_seeds_all(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        await svc.init_default_configs(uuid.uuid4())
        await db.commit()
        rows = await svc.repo.list_keys()
        groups = {r.config_group for r in rows}
        assert groups == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
        # 每组至少 1 个 key
        assert len(rows) >= 4


async def test_init_idempotent(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        await svc.init_default_configs(uuid.uuid4())
        await db.commit()
        first = sorted(r.config_value for r in await svc.repo.list_keys())
        await svc.init_default_configs(uuid.uuid4())  # 不覆盖
        await db.commit()
        second = sorted(r.config_value for r in await svc.repo.list_keys())
        assert first == second


async def test_set_value_validates_group(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        await svc.init_default_configs(uuid.uuid4())
        await db.commit()
        with pytest.raises(BusinessException):
            await svc.set_value("security.password_min_length", "3", uuid.uuid4())


async def test_set_value_secret_encrypts(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        await svc.init_default_configs(uuid.uuid4())
        await db.commit()
        await svc.set_value("mail.password", "smtp-secret-123", uuid.uuid4())
        await db.commit()
        row = await svc.repo.get_by_key("mail.password")
        assert row.is_encrypted is True
        assert row.config_value != "smtp-secret-123"  # 密文
        assert svc.crypto.decrypt(row.config_value) == "smtp-secret-123"
        # get_value 解密
        val = await svc.get_value("mail.password")
        assert val == "smtp-secret-123"
        # 历史存密文
        hist = await svc.history_repo.list_by_key("mail.password")
        assert hist and hist[0].new_value != "smtp-secret-123"


async def test_get_group_returns_real_values(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        await svc.init_default_configs(uuid.uuid4())
        await db.commit()
        grp = await svc.get_group("SYSTEM")
        assert "site_name" in grp


async def test_set_value_records_history(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        await svc.init_default_configs(uuid.uuid4())
        await db.commit()
        await svc.set_value("system.site_name", "NewName", uuid.uuid4())
        await db.commit()
        hist = await svc.history_repo.list_by_key("system.site_name")
        assert len(hist) == 1
        assert hist[0].new_value == "NewName"


async def test_unknown_group_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        with pytest.raises(BusinessException):
            await svc.set_value("unknown.x", "v", uuid.uuid4())


async def test_cache_invalidation_on_set(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)

    class SpyCache(LocalTTLCache):
        def __init__(self):
            super().__init__()
            self.invalidated: list = []

        async def invalidate(self, group=None):
            self.invalidated.append(group)

    async with Session() as db:
        spy = SpyCache()
        svc = ConfigService(
            db, SystemConfigRepository(db),
            ConfigHistoryRepository(db), crypto, spy,
        )
        await svc.init_default_configs(uuid.uuid4())
        await db.commit()
        await svc.set_value("system.site_name", "Z", uuid.uuid4())
        await db.commit()
        assert "SYSTEM" in spy.invalidated