## Task 6: SystemConfig / ConfigHistory / EmailTemplate 仓储

**Files:**
- Create: `app/repositories/system_config_repository.py`
- Test: `tests/test_system_config_repository.py`

**Interfaces:**
- Produces:
  - `SystemConfigRepository(db)`:`get_by_key(key)`、`list_by_group(group)`、`upsert(key, value, group, type, is_encrypted, updated_by, description=None)`、`list_keys(group=None)`
  - `ConfigHistoryRepository(db)`:`add(key, old_value, new_value, changed_by)`、`list_by_key(key)`
  - `EmailTemplateRepository(db)`:`get_by_id(id)`、`get_by_code(code)`、`list(page, size)`、`add(tpl)`、`delete(tpl)`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_system_config_repository.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.domain.models.system_config import EmailTemplate, SystemConfig
from app.repositories.system_config_repository import (
    ConfigHistoryRepository, EmailTemplateRepository, SystemConfigRepository,
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_system_config_repository.py -v`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现**

```python
# app/repositories/system_config_repository.py
"""系统配置、配置历史、邮件模板仓储."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.system_config import ConfigHistory, EmailTemplate, SystemConfig


class SystemConfigRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_key(self, key: str) -> SystemConfig | None:
        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
        return result.scalar_one_or_none()

    async def list_by_group(self, group: str) -> list[SystemConfig]:
        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_group == group))
        return list(result.scalars().all())

    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
        stmt = select(SystemConfig)
        if group is not None:
            stmt = stmt.where(SystemConfig.config_group == group)
        result = await self.db.execute(stmt.order_by(SystemConfig.config_group, SystemConfig.config_key))
        return list(result.scalars().all())

    async def upsert(self, key: str, value: str, group: str, type_: str,
                     is_encrypted: bool, updated_by: uuid.UUID | None,
                     description: str | None = None) -> SystemConfig:
        existing = await self.get_by_key(key)
        if existing is None:
            row = SystemConfig(config_key=key, config_value=value, config_group=group,
                               config_type=type_, is_encrypted=is_encrypted,
                               updated_by=updated_by, description=description)
            self.db.add(row)
            await self.db.flush()
            return row
        existing.config_value = value
        existing.config_group = group
        existing.config_type = type_
        existing.is_encrypted = is_encrypted
        existing.updated_by = updated_by
        if description is not None:
            existing.description = description
        await self.db.flush()
        return existing


class ConfigHistoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def add(self, key: str, old_value: str | None, new_value: str | None,
                  changed_by: uuid.UUID) -> ConfigHistory:
        row = ConfigHistory(config_key=key, old_value=old_value, new_value=new_value,
                            changed_by=changed_by)
        self.db.add(row)
        await self.db.flush()
        return row

    async def list_by_key(self, key: str) -> list[ConfigHistory]:
        result = await self.db.execute(
            select(ConfigHistory).where(ConfigHistory.config_key == key)
            .order_by(ConfigHistory.changed_at.desc())
        )
        return list(result.scalars().all())


class EmailTemplateRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
        return await self.db.get(EmailTemplate, tpl_id)

    async def get_by_code(self, code: str) -> EmailTemplate | None:
        result = await self.db.execute(select(EmailTemplate).where(EmailTemplate.template_code == code))
        return result.scalar_one_or_none()

    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
        total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
        total = int(total_result.scalar_one())
        result = await self.db.execute(
            select(EmailTemplate).order_by(EmailTemplate.template_code)
            .offset((page - 1) * size).limit(size)
        )
        return list(result.scalars().all()), total

    async def add(self, tpl: EmailTemplate) -> EmailTemplate:
        self.db.add(tpl)
        await self.db.flush()
        return tpl

    async def delete(self, tpl: EmailTemplate) -> None:
        await self.db.delete(tpl)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_system_config_repository.py -v`
Expected: PASS(4 passed);全量无回归。

- [ ] **Step 5: 提交**

```bash
git add app/repositories/system_config_repository.py tests/test_system_config_repository.py
git commit -m "feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储"
```

---

