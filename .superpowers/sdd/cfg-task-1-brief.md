## Task 1: 数据模型(SystemConfig / ConfigHistory / EmailTemplate)

**Files:**
- Create: `app/domain/models/system_config.py`
- Modify: `app/main.py`(import 新模型以注册到 metadata — 加 `import app.domain.models.system_config  # noqa: F401`)
- Test: `tests/test_system_config_model.py`

**Interfaces:**
- Produces: `SystemConfig`、`ConfigHistory`、`EmailTemplate`(SQLAlchemy 模型,字段见 spec §4)。`SystemConfig.config_key` 唯一、`config_group` 索引;`ConfigHistory.config_key`+`changed_at` 索引;`EmailTemplate.template_code` 唯一。`config_type` 取值 `STRING/INT/BOOL/JSON/SECRET`。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_system_config_model.py
from __future__ import annotations

import pytest
from sqlalchemy import inspect

from app.domain.models import Base
import app.domain.models.associations  # noqa: F401
import app.domain.models.department  # noqa: F401
import app.domain.models.role  # noqa: F401
import app.domain.models.user  # noqa: F401
import app.domain.models.system_config  # noqa: F401

pytestmark = pytest.mark.asyncio


def test_system_config_columns():
    cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
    assert {"id", "config_key", "config_value", "config_group", "config_type",
            "is_encrypted", "description", "updated_by",
            "created_at", "updated_at"} <= cols
    assert Base.metadata.tables["system_config"].columns["config_key"].unique is True


def test_config_history_columns():
    cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
    assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols


def test_email_template_columns():
    cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
    assert {"id", "template_code", "template_name", "subject", "content",
            "variables", "is_active", "created_at", "updated_at"} <= cols
    assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_system_config_model.py -v`
Expected: FAIL(表不存在)

- [ ] **Step 3: 实现模型**

```python
# app/domain/models/system_config.py
"""系统配置、配置历史、邮件模板模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models import Base

UUIDType = Uuid


class SystemConfig(Base):
    __tablename__ = "system_config"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    config_value: Mapped[str] = mapped_column(Text, nullable=False)
    config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    config_type: Mapped[str] = mapped_column(String(20), nullable=False)  # STRING/INT/BOOL/JSON/SECRET
    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey("user_account.id"), nullable=True)


class ConfigHistory(Base):
    __tablename__ = "config_history"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class EmailTemplate(Base):
    __tablename__ = "email_template"

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    template_name: Mapped[str] = mapped_column(String(100), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
```

- [ ] **Step 4: 在 main.py 注册模型 import**

在 `app/main.py` 既有模型 import 块追加:
```python
import app.domain.models.system_config  # noqa: F401
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_system_config_model.py -v`
Expected: PASS(3 passed);全量 `uv run pytest` 无回归。

- [ ] **Step 6: 提交**

```bash
git add app/domain/models/system_config.py app/main.py tests/test_system_config_model.py
git commit -m "feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型"
```

---

