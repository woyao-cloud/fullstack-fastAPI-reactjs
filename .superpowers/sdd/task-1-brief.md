## Task 1: 璋冩暣 Department 妯″瀷

**Files:**
- Modify: `app/domain/models/department.py`
- Test: `tests/test_department_model.py` (Create)

**Interfaces:**
- Produces: `Department` 鍚瓧娈?`node_seq: int`(unique index)銆乣manager_id: uuid.UUID | None`(FK user_account)銆乣deleted_at: datetime | None`;`CheckConstraint("level BETWEEN 1 AND 5")`銆?
- [ ] **Step 1: 鍐欏け璐ユ祴璇?*

```python
# tests/test_department_model.py
from __future__ import annotations

import pytest
from sqlalchemy import inspect

from app.domain.models import Base
import app.domain.models.associations  # noqa: F401
import app.domain.models.role  # noqa: F401
import app.domain.models.user  # noqa: F401
import app.domain.models.department  # noqa: F401

pytestmark = pytest.mark.asyncio


def test_department_columns():
    cols = {c["name"] for c in inspect(Base.metadata.tables["department"]).columns}
    assert {"id", "node_seq", "name", "code", "parent_id", "level", "path",
            "sort_order", "manager_id", "status", "deleted_at",
            "created_at", "updated_at"} <= cols


def test_department_node_seq_unique():
    node_seq = Base.metadata.tables["department"].columns["node_seq"]
    assert node_seq.unique is True


def test_department_level_check():
    table = Base.metadata.tables["department"]
    has_check = any(
        "level BETWEEN 1 AND 5" in str(c.sqltext).upper()
        for c in table.constraints
        if hasattr(c, "sqltext")
    )
    assert has_check
```

- [ ] **Step 2: 杩愯娴嬭瘯纭澶辫触**

Run: `uv run pytest tests/test_department_model.py -v`
Expected: FAIL (`node_seq`/`manager_id`/`deleted_at`/check 缂哄け)

- [ ] **Step 3: 淇敼妯″瀷**

```python
# app/domain/models/department.py
"""閮ㄩ棬妯″瀷 - Materialized Path(node_seq 鏁存暟璺緞)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Uuid, func, select
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models import Base

UUIDType = Uuid


class Department(Base):
    __tablename__ = "department"
    __table_args__ = (CheckConstraint("level BETWEEN 1 AND 5", name="ck_dept_level"),)

    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
    node_seq: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("department.id"), nullable=True
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("user_account.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @classmethod
    def find_subtree(cls, root_path: str):
        """鏌ヨ瀛愭爲(path LIKE root_path%)."""
        return select(cls).where(cls.path.like(f"{root_path}%"))
```

- [ ] **Step 4: 杩愯娴嬭瘯纭閫氳繃**

Run: `uv run pytest tests/test_department_model.py -v`
Expected: PASS(3 passed)

- [ ] **Step 5: 鎻愪氦**

```bash
git add app/domain/models/department.py tests/test_department_model.py
git commit -m "feat(dept): Department 妯″瀷澧炲姞 node_seq/manager_id/deleted_at 涓?level CHECK"
```

---

