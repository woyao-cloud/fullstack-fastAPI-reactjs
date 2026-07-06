## Task 5: 部门 Pydantic Schema

**Files:**
- Create: `app/application/schemas/department.py`
- Test: `tests/test_department_schema.py`

**Interfaces:**
- Produces:
  - `DepartmentCreate{ name, code, parent_id?: UUID, sort_order?: int=0, manager_id?: UUID }`
  - `DepartmentUpdate{ name?, code?, sort_order?, manager_id?, status? }`(不含 parent_id)
  - `DepartmentMove{ parent_id: UUID | None }`
  - `DepartmentOut{ id, node_seq, name, code, parent_id, level, path, sort_order, manager_id, status, created_at, updated_at }`(from_attributes)
  - `DepartmentTreeNode{ ...DepartmentOut 字段, children: list[DepartmentTreeNode] }`
  - `DepartmentListOut{ items: list[DepartmentOut], total, page, size }`

- [ ] **Step 1: 写失败测试**

```python
# tests/test_department_schema.py
from __future__ import annotations

import uuid

import pytest
from pydantic import ValidationError

from app.application.schemas.department import (
    DepartmentCreate, DepartmentMove, DepartmentTreeNode, DepartmentUpdate,
)

pytestmark = pytest.mark.asyncio


def test_department_create_minimal():
    d = DepartmentCreate(name="总部", code="HQ")
    assert d.parent_id is None and d.sort_order == 0


def test_department_update_excludes_parent_id():
    fields = set(DepartmentUpdate.model_fields.keys())
    assert "parent_id" not in fields
    assert "status" in fields


def test_department_move_optional_parent():
    assert DepartmentMove(parent_id=None).parent_id is None
    uid = uuid.uuid4()
    assert DepartmentMove(parent_id=uid).parent_id == uid


def test_tree_node_recursive():
    node = DepartmentTreeNode(
        id=uuid.uuid4(), node_seq=1, name="A", code="A", parent_id=None,
        level=1, path="/1", sort_order=0, manager_id=None, status="ACTIVE",
        created_at="2026-07-05T00:00:00Z", updated_at="2026-07-05T00:00:00Z",
        children=[],
    )
    node.children.append(node.model_copy(update={"node_seq": 2, "level": 2}))
    assert node.children[0].level == 2
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_schema.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: 实现 schema**

```python
# app/application/schemas/department.py
"""部门 Pydantic 模型."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    code: str = Field(min_length=1, max_length=50)
    parent_id: uuid.UUID | None = None
    sort_order: int = 0
    manager_id: uuid.UUID | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    code: str | None = Field(default=None, min_length=1, max_length=50)
    sort_order: int | None = None
    manager_id: uuid.UUID | None = None
    status: str | None = Field(default=None, max_length=20)


class DepartmentMove(BaseModel):
    parent_id: uuid.UUID | None = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_seq: int
    name: str
    code: str
    parent_id: uuid.UUID | None
    level: int
    path: str
    sort_order: int
    manager_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime


class DepartmentTreeNode(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    node_seq: int
    name: str
    code: str
    parent_id: uuid.UUID | None
    level: int
    path: str
    sort_order: int
    manager_id: uuid.UUID | None
    status: str
    created_at: datetime
    updated_at: datetime
    children: list["DepartmentTreeNode"] = Field(default_factory=list)


class DepartmentListOut(BaseModel):
    items: list[DepartmentOut]
    total: int
    page: int
    size: int
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_schema.py -v`
Expected: PASS(4 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/schemas/department.py tests/test_department_schema.py
git commit -m "feat(dept): 部门 Pydantic schema(Create/Update/Move/Out/TreeNode/ListOut)"
```

---

