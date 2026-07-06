## commits 5c3b8ee..c0fa003
c0fa003 feat(dept): 部门 Pydantic schema(Create/Update/Move/Out/TreeNode/ListOut)

## stat
 .../back-end/app/application/schemas/department.py | 73 ++++++++++++++++++++++
 .../back-end/tests/test_department_schema.py       | 41 ++++++++++++
 2 files changed, 114 insertions(+)

## diff -U10
diff --git a/user-service/back-end/app/application/schemas/department.py b/user-service/back-end/app/application/schemas/department.py
new file mode 100644
index 0000000..c5ad291
--- /dev/null
+++ b/user-service/back-end/app/application/schemas/department.py
@@ -0,0 +1,73 @@
+"""部门 Pydantic 模型."""
+
+from __future__ import annotations
+
+import uuid
+from datetime import datetime
+
+from pydantic import BaseModel, ConfigDict, Field
+
+
+class DepartmentCreate(BaseModel):
+    name: str = Field(min_length=1, max_length=100)
+    code: str = Field(min_length=1, max_length=50)
+    parent_id: uuid.UUID | None = None
+    sort_order: int = 0
+    manager_id: uuid.UUID | None = None
+
+
+class DepartmentUpdate(BaseModel):
+    name: str | None = Field(default=None, min_length=1, max_length=100)
+    code: str | None = Field(default=None, min_length=1, max_length=50)
+    sort_order: int | None = None
+    manager_id: uuid.UUID | None = None
+    status: str | None = Field(default=None, max_length=20)
+
+
+class DepartmentMove(BaseModel):
+    parent_id: uuid.UUID | None = None
+
+
+class DepartmentOut(BaseModel):
+    model_config = ConfigDict(from_attributes=True)
+
+    id: uuid.UUID
+    node_seq: int
+    name: str
+    code: str
+    parent_id: uuid.UUID | None
+    level: int
+    path: str
+    sort_order: int
+    manager_id: uuid.UUID | None
+    status: str
+    created_at: datetime
+    updated_at: datetime
+
+
+class DepartmentTreeNode(BaseModel):
+    model_config = ConfigDict(from_attributes=True)
+
+    id: uuid.UUID
+    node_seq: int
+    name: str
+    code: str
+    parent_id: uuid.UUID | None
+    level: int
+    path: str
+    sort_order: int
+    manager_id: uuid.UUID | None
+    status: str
+    created_at: datetime
+    updated_at: datetime
+    children: list["DepartmentTreeNode"] = Field(default_factory=list)
+
+
+DepartmentTreeNode.model_rebuild()
+
+
+class DepartmentListOut(BaseModel):
+    items: list[DepartmentOut]
+    total: int
+    page: int
+    size: int
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_department_schema.py b/user-service/back-end/tests/test_department_schema.py
new file mode 100644
index 0000000..5a6daaa
--- /dev/null
+++ b/user-service/back-end/tests/test_department_schema.py
@@ -0,0 +1,41 @@
+# tests/test_department_schema.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from pydantic import ValidationError
+
+from app.application.schemas.department import (
+    DepartmentCreate, DepartmentMove, DepartmentTreeNode, DepartmentUpdate,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+def test_department_create_minimal():
+    d = DepartmentCreate(name="总部", code="HQ")
+    assert d.parent_id is None and d.sort_order == 0
+
+
+def test_department_update_excludes_parent_id():
+    fields = set(DepartmentUpdate.model_fields.keys())
+    assert "parent_id" not in fields
+    assert "status" in fields
+
+
+def test_department_move_optional_parent():
+    assert DepartmentMove(parent_id=None).parent_id is None
+    uid = uuid.uuid4()
+    assert DepartmentMove(parent_id=uid).parent_id == uid
+
+
+def test_tree_node_recursive():
+    node = DepartmentTreeNode(
+        id=uuid.uuid4(), node_seq=1, name="A", code="A", parent_id=None,
+        level=1, path="/1", sort_order=0, manager_id=None, status="ACTIVE",
+        created_at="2026-07-05T00:00:00Z", updated_at="2026-07-05T00:00:00Z",
+        children=[],
+    )
+    node.children.append(node.model_copy(update={"node_seq": 2, "level": 2}))
+    assert node.children[0].level == 2
\ No newline at end of file
