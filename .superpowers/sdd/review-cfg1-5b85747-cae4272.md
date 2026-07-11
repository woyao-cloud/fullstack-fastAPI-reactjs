## commits 5b85747..cae4272
cae4272 feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型

## stat
 .../back-end/app/domain/models/system_config.py    | 49 ++++++++++++++++++++++
 user-service/back-end/app/main.py                  |  1 +
 .../back-end/tests/test_system_config_model.py     | 34 +++++++++++++++
 3 files changed, 84 insertions(+)

## diff -U10
diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
new file mode 100644
index 0000000..44d4b45
--- /dev/null
+++ b/user-service/back-end/app/domain/models/system_config.py
@@ -0,0 +1,49 @@
+"""系统配置、配置历史、邮件模板模型."""
+
+from __future__ import annotations
+
+import uuid
+from datetime import datetime
+
+from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
+from sqlalchemy.orm import Mapped, mapped_column
+
+from app.domain.models import Base
+
+UUIDType = Uuid
+
+
+class SystemConfig(Base):
+    __tablename__ = "system_config"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
+    config_value: Mapped[str] = mapped_column(Text, nullable=False)
+    config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
+    config_type: Mapped[str] = mapped_column(String(20), nullable=False)  # STRING/INT/BOOL/JSON/SECRET
+    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
+    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
+    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey("user_account.id"), nullable=True)
+
+
+class ConfigHistory(Base):
+    __tablename__ = "config_history"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
+    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+    changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
+    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
+
+
+class EmailTemplate(Base):
+    __tablename__ = "email_template"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
+    template_name: Mapped[str] = mapped_column(String(100), nullable=False)
+    subject: Mapped[str] = mapped_column(String(200), nullable=False)
+    content: Mapped[str] = mapped_column(Text, nullable=False)
+    variables: Mapped[list | None] = mapped_column(JSON, nullable=True)
+    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
\ No newline at end of file
diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
index 395285d..c12de28 100644
--- a/user-service/back-end/app/main.py
+++ b/user-service/back-end/app/main.py
@@ -5,20 +5,21 @@ from __future__ import annotations
 from collections.abc import AsyncIterator
 from contextlib import asynccontextmanager
 
 from fastapi import FastAPI
 from fastapi.middleware.cors import CORSMiddleware
 
 # 确保关联表与模型在导入时注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401
 import app.domain.models.department  # noqa: F401
 import app.domain.models.role  # noqa: F401
+import app.domain.models.system_config  # noqa: F401
 import app.domain.models.user  # noqa: F401
 from app.core.config import settings
 from app.core.database import engine
 from app.core.exceptions import register_exception_handlers
 from app.domain.models import Base
 from app.interfaces.api import auth, departments, health, users
 
 
 @asynccontextmanager
 async def lifespan(_: FastAPI) -> AsyncIterator[None]:
diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
new file mode 100644
index 0000000..d9bb138
--- /dev/null
+++ b/user-service/back-end/tests/test_system_config_model.py
@@ -0,0 +1,34 @@
+# tests/test_system_config_model.py
+from __future__ import annotations
+
+import pytest
+from sqlalchemy import inspect
+
+from app.domain.models import Base
+import app.domain.models.associations  # noqa: F401
+import app.domain.models.department  # noqa: F401
+import app.domain.models.role  # noqa: F401
+import app.domain.models.user  # noqa: F401
+import app.domain.models.system_config  # noqa: F401
+
+pytestmark = pytest.mark.asyncio
+
+
+def test_system_config_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
+    assert {"id", "config_key", "config_value", "config_group", "config_type",
+            "is_encrypted", "description", "updated_by",
+            "created_at", "updated_at"} <= cols
+    assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
+
+
+def test_config_history_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
+    assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
+
+
+def test_email_template_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
+    assert {"id", "template_code", "template_name", "subject", "content",
+            "variables", "is_active", "created_at", "updated_at"} <= cols
+    assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
\ No newline at end of file
