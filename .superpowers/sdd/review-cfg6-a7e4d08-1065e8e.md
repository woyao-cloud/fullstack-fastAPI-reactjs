## commits a7e4d08..1065e8e
1065e8e feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储

## stat
 .../back-end/app/domain/models/system_config.py    |   4 +-
 .../app/repositories/system_config_repository.py   | 108 +++++++++++++++++++++
 user-service/back-end/tests/conftest.py            |   1 +
 .../tests/test_system_config_repository.py         |  67 +++++++++++++
 4 files changed, 178 insertions(+), 2 deletions(-)

## diff -U10
diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
index c8b7d77..8cad7c0 100644
--- a/user-service/back-end/app/domain/models/system_config.py
+++ b/user-service/back-end/app/domain/models/system_config.py
@@ -1,18 +1,18 @@
 """系统配置、配置历史、邮件模板模型."""
 
 from __future__ import annotations
 
 import uuid
 from datetime import datetime
 
-from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
+from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid, func
 from sqlalchemy.orm import Mapped, mapped_column
 
 from app.domain.models import Base
 
 UUIDType = Uuid
 
 
 class SystemConfig(Base):
     __tablename__ = "system_config"
 
@@ -27,21 +27,21 @@ class SystemConfig(Base):
 
 
 class ConfigHistory(Base):
     __tablename__ = "config_history"
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
     config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
     old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
     new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
     changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
-    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
+    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False, server_default=func.now())
 
 
 class EmailTemplate(Base):
     __tablename__ = "email_template"
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
     template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
     template_name: Mapped[str] = mapped_column(String(100), nullable=False)
     subject: Mapped[str] = mapped_column(String(200), nullable=False)
     content: Mapped[str] = mapped_column(Text, nullable=False)
diff --git a/user-service/back-end/app/repositories/system_config_repository.py b/user-service/back-end/app/repositories/system_config_repository.py
new file mode 100644
index 0000000..28478e6
--- /dev/null
+++ b/user-service/back-end/app/repositories/system_config_repository.py
@@ -0,0 +1,108 @@
+# app/repositories/system_config_repository.py
+"""系统配置、配置历史、邮件模板仓储."""
+
+from __future__ import annotations
+
+import uuid
+
+from sqlalchemy import func, select
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.domain.models.system_config import ConfigHistory, EmailTemplate, SystemConfig
+
+
+class SystemConfigRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def get_by_key(self, key: str) -> SystemConfig | None:
+        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
+        return result.scalar_one_or_none()
+
+    async def list_by_group(self, group: str) -> list[SystemConfig]:
+        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_group == group))
+        return list(result.scalars().all())
+
+    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
+        stmt = select(SystemConfig)
+        if group is not None:
+            stmt = stmt.where(SystemConfig.config_group == group)
+        result = await self.db.execute(stmt.order_by(SystemConfig.config_group, SystemConfig.config_key))
+        return list(result.scalars().all())
+
+    async def upsert(self, key: str, value: str, group: str, type_: str,
+                     is_encrypted: bool, updated_by: uuid.UUID | None,
+                     description: str | None = None) -> SystemConfig:
+        existing = await self.get_by_key(key)
+        if existing is None:
+            row = SystemConfig(config_key=key, config_value=value, config_group=group,
+                               config_type=type_, is_encrypted=is_encrypted,
+                               updated_by=updated_by, description=description)
+            self.db.add(row)
+            await self.db.flush()
+            return row
+        existing.config_value = value
+        existing.config_group = group
+        existing.config_type = type_
+        existing.is_encrypted = is_encrypted
+        existing.updated_by = updated_by
+        if description is not None:
+            existing.description = description
+        await self.db.flush()
+        return existing
+
+
+class ConfigHistoryRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def add(self, key: str, old_value: str | None, new_value: str | None,
+                  changed_by: uuid.UUID) -> ConfigHistory:
+        row = ConfigHistory(config_key=key, old_value=old_value, new_value=new_value,
+                            changed_by=changed_by)
+        self.db.add(row)
+        await self.db.flush()
+        return row
+
+    async def list_by_key(self, key: str) -> list[ConfigHistory]:
+        result = await self.db.execute(
+            select(ConfigHistory).where(ConfigHistory.config_key == key)
+            .order_by(ConfigHistory.changed_at.desc())
+        )
+        return list(result.scalars().all())
+
+
+class EmailTemplateRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
+        return await self.db.get(EmailTemplate, tpl_id)
+
+    async def get_by_code(self, code: str) -> EmailTemplate | None:
+        result = await self.db.execute(select(EmailTemplate).where(EmailTemplate.template_code == code))
+        return result.scalar_one_or_none()
+
+    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
+        total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
+        total = int(total_result.scalar_one())
+        result = await self.db.execute(
+            select(EmailTemplate).order_by(EmailTemplate.template_code)
+            .offset((page - 1) * size).limit(size)
+        )
+        return list(result.scalars().all()), total
+
+    async def add(self, tpl: EmailTemplate) -> EmailTemplate:
+        self.db.add(tpl)
+        await self.db.flush()
+        return tpl
+
+    async def delete(self, tpl: EmailTemplate) -> None:
+        await self.db.delete(tpl)
+
+
+__all__ = [
+    "SystemConfigRepository",
+    "ConfigHistoryRepository",
+    "EmailTemplateRepository",
+]
\ No newline at end of file
diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
index 613f607..71355ae 100644
--- a/user-service/back-end/tests/conftest.py
+++ b/user-service/back-end/tests/conftest.py
@@ -10,20 +10,21 @@ from collections.abc import AsyncIterator
 import pytest
 import pytest_asyncio
 from httpx import ASGITransport, AsyncClient
 from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
 
 # 确保所有模型注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
 import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
+import app.domain.models.system_config  # noqa: F401  pylint: disable=unused-import
 from app.core.database import get_db
 from app.domain.models import Base
 from app.domain.models.enums import DataScope
 from app.domain.models.role import Permission, Role
 from app.main import app
 
 
 @pytest.fixture(autouse=True)
 def _encryption_key(monkeypatch):
     from cryptography.fernet import Fernet
diff --git a/user-service/back-end/tests/test_system_config_repository.py b/user-service/back-end/tests/test_system_config_repository.py
new file mode 100644
index 0000000..0238cf8
--- /dev/null
+++ b/user-service/back-end/tests/test_system_config_repository.py
@@ -0,0 +1,67 @@
+# tests/test_system_config_repository.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.domain.models.system_config import EmailTemplate, SystemConfig
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, EmailTemplateRepository, SystemConfigRepository,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_upsert_inserts_and_updates(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = SystemConfigRepository(db)
+        await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
+        await db.commit()
+        got = await repo.get_by_key("mail.host")
+        assert got is not None and got.config_value == "smtp.x.com"
+        await repo.upsert("mail.host", "smtp.y.com", "MAIL", "STRING", False, None)
+        await db.commit()
+        got2 = await repo.get_by_key("mail.host")
+        assert got2.config_value == "smtp.y.com"
+
+
+async def test_list_by_group(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = SystemConfigRepository(db)
+        await repo.upsert("mail.host", "h", "MAIL", "STRING", False, None)
+        await repo.upsert("mail.port", "25", "MAIL", "INT", False, None)
+        await repo.upsert("system.site_name", "s", "SYSTEM", "STRING", False, None)
+        await db.commit()
+        rows = await repo.list_by_group("MAIL")
+        assert {r.config_key for r in rows} == {"mail.host", "mail.port"}
+
+
+async def test_config_history(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        hist = ConfigHistoryRepository(db)
+        await hist.add("mail.host", "old", "new", uuid.uuid4())
+        await db.commit()
+        rows = await hist.list_by_key("mail.host")
+        assert len(rows) == 1 and rows[0].new_value == "new"
+
+
+async def test_email_template_repo(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = EmailTemplateRepository(db)
+        tpl = EmailTemplate(template_code="USER_ACTIVATION", template_name="激活",
+                            subject="欢迎", content="Hi {{name}}",
+                            variables=[{"name": "name", "description": "用户名", "required": True}])
+        await repo.add(tpl)
+        await db.commit()
+        assert (await repo.get_by_code("USER_ACTIVATION")).template_name == "激活"
+        items, total = await repo.list(1, 20)
+        assert total == 1
+        await repo.delete(tpl)
+        await db.commit()
+        assert await repo.get_by_code("USER_ACTIVATION") is None
\ No newline at end of file
