from __future__ import annotations

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
from app.application.services.email_template_service import EmailTemplateService
from app.core.exceptions import ConflictError, NotFoundError
from app.repositories.system_config_repository import EmailTemplateRepository

pytestmark = pytest.mark.asyncio


def _svc(db):
    return EmailTemplateService(db, EmailTemplateRepository(db))


async def test_create_and_get(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        tpl = await svc.create(EmailTemplateCreate(
            template_code="USER_ACTIVATION", template_name="激活", subject="欢迎",
            content="Hi {{name}}",
            variables=[{"name": "name", "description": "用户名", "required": True}]))
        await db.commit()
        got = await svc.get(tpl.id)
        assert got.template_code == "USER_ACTIVATION"


async def test_create_code_conflict(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
                                             subject="s", content="c"))
        await db.commit()
        with pytest.raises(ConflictError):
            await svc.create(EmailTemplateCreate(template_code="X", template_name="n2",
                                                 subject="s2", content="c2"))
        await db.commit()


async def test_update_and_delete(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        tpl = await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
                                                   subject="s", content="c"))
        await db.commit()
        updated = await svc.update(tpl.id, EmailTemplateUpdate(template_name="n2"))
        await db.commit()
        assert updated.template_name == "n2"
        await svc.delete(tpl.id)
        await db.commit()
        with pytest.raises(NotFoundError):
            await svc.get(tpl.id)


async def test_list_pagination(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _svc(db)
        for i in range(3):
            await svc.create(EmailTemplateCreate(template_code=f"C{i}", template_name=f"n{i}",
                                                 subject="s", content="c"))
            await db.commit()
        items, total = await svc.list(1, 2)
        assert total == 3 and len(items) == 2