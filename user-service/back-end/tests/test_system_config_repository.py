# tests/test_system_config_repository.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.domain.models.system_config import EmailTemplate
from app.repositories.system_config_repository import (
    ConfigHistoryRepository,
    EmailTemplateRepository,
    SystemConfigRepository,
)

pytestmark = pytest.mark.asyncio


async def test_upsert_inserts_and_updates(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = SystemConfigRepository(db)
        await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
        await db.commit()
        got = await repo.get_by_key("mail.host")
        assert got is not None and got.config_value == "smtp.x.com"
        await repo.upsert("mail.host", "smtp.y.com", "MAIL", "STRING", False, None)
        await db.commit()
        got2 = await repo.get_by_key("mail.host")
        assert got2.config_value == "smtp.y.com"


async def test_list_by_group(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = SystemConfigRepository(db)
        await repo.upsert("mail.host", "h", "MAIL", "STRING", False, None)
        await repo.upsert("mail.port", "25", "MAIL", "INT", False, None)
        await repo.upsert("system.site_name", "s", "SYSTEM", "STRING", False, None)
        await db.commit()
        rows = await repo.list_by_group("MAIL")
        assert {r.config_key for r in rows} == {"mail.host", "mail.port"}


async def test_config_history(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        hist = ConfigHistoryRepository(db)
        await hist.add("mail.host", "old", "new", uuid.uuid4())
        await db.commit()
        rows = await hist.list_by_key("mail.host")
        assert len(rows) == 1 and rows[0].new_value == "new"


async def test_email_template_repo(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = EmailTemplateRepository(db)
        tpl = EmailTemplate(template_code="USER_ACTIVATION", template_name="激活",
                            subject="欢迎", content="Hi {{name}}",
                            variables=[{"name": "name", "description": "用户名", "required": True}])
        await repo.add(tpl)
        await db.commit()
        assert (await repo.get_by_code("USER_ACTIVATION")).template_name == "激活"
        items, total = await repo.list(1, 20)
        assert total == 1
        await repo.delete(tpl)
        await db.commit()
        assert await repo.get_by_code("USER_ACTIVATION") is None