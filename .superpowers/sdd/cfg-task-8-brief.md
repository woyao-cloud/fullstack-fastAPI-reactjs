## Task 8: EmailTemplateService

**Files:**
- Create: `app/application/services/email_template_service.py`
- Modify: `app/application/schemas/system_config.py`(追加 EmailTemplate schema)
- Test: `tests/test_email_template_service.py`

**Interfaces:**
- Produces:`EmailTemplateCreate{ template_code, template_name, subject, content, variables?, is_active? }`、`EmailTemplateUpdate`、`EmailTemplateOut`、`EmailTemplateListOut`;`EmailTemplateService(db, repo)` 方法 `create/update/get/list/delete/get_by_code`。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_email_template_service.py
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_email_template_service.py -v`
Expected: FAIL(模块/schema 不存在)

- [ ] **Step 3: 追加 schema 到 `app/application/schemas/system_config.py`**

```python
# app/application/schemas/system_config.py —— 末尾追加
class EmailTemplateCreate(BaseModel):
    template_code: str = Field(min_length=1, max_length=50)
    template_name: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1)
    variables: list[dict] | None = None
    is_active: bool = True


class EmailTemplateUpdate(BaseModel):
    template_code: str | None = Field(default=None, min_length=1, max_length=50)
    template_name: str | None = Field(default=None, min_length=1, max_length=100)
    subject: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1)
    variables: list[dict] | None = None
    is_active: bool | None = None


class EmailTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    template_code: str
    template_name: str
    subject: str
    content: str
    variables: list[dict] | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmailTemplateListOut(BaseModel):
    items: list[EmailTemplateOut]
    total: int
    page: int
    size: int
```
在文件顶部 import 区确保 `import uuid` 和 `from datetime import datetime`、`from pydantic import ConfigDict` 存在。

- [ ] **Step 4: 实现 service**

```python
# app/application/services/email_template_service.py
"""邮件模板服务(CRUD,不含发送)."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
from app.core.exceptions import ConflictError, NotFoundError
from app.domain.models.system_config import EmailTemplate
from app.repositories.system_config_repository import EmailTemplateRepository


class EmailTemplateService:
    def __init__(self, db: AsyncSession, repo: EmailTemplateRepository):
        self.db = db
        self.repo = repo

    async def create(self, req: EmailTemplateCreate) -> EmailTemplate:
        if await self.repo.get_by_code(req.template_code) is not None:
            raise ConflictError("模板编码已存在")
        tpl = EmailTemplate(template_code=req.template_code, template_name=req.template_name,
                           subject=req.subject, content=req.content,
                           variables=req.variables, is_active=req.is_active)
        await self.repo.add(tpl)
        await self.db.commit()
        await self.db.refresh(tpl)
        return tpl

    async def update(self, tpl_id: uuid.UUID, req: EmailTemplateUpdate) -> EmailTemplate:
        tpl = await self.repo.get_by_id(tpl_id)
        if tpl is None:
            raise NotFoundError("模板不存在")
        if req.template_code is not None and req.template_code != tpl.template_code:
            if await self.repo.get_by_code(req.template_code) is not None:
                raise ConflictError("模板编码已存在")
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(tpl, field, value)
        await self.db.commit()
        await self.db.refresh(tpl)
        return tpl

    async def get(self, tpl_id: uuid.UUID) -> EmailTemplate:
        tpl = await self.repo.get_by_id(tpl_id)
        if tpl is None:
            raise NotFoundError("模板不存在")
        return tpl

    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
        return await self.repo.list(page, size)

    async def delete(self, tpl_id: uuid.UUID) -> None:
        tpl = await self.repo.get_by_id(tpl_id)
        if tpl is None:
            raise NotFoundError("模板不存在")
        await self.repo.delete(tpl)
        await self.db.commit()

    async def get_by_code(self, code: str) -> EmailTemplate | None:
        return await self.repo.get_by_code(code)
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_email_template_service.py -v`
Expected: PASS(4 passed);全量无回归。

- [ ] **Step 6: 提交**

```bash
git add app/application/schemas/system_config.py app/application/services/email_template_service.py tests/test_email_template_service.py
git commit -m "feat(config): EmailTemplateService + schema"
```

---

