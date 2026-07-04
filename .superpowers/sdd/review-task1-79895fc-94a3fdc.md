## commits 79895fc..94a3fdc
94a3fdc feat(dept): Department 模型增加 node_seq/manager_id/deleted_at 与 level CHECK

## stat
 .../back-end/app/domain/models/department.py       | 17 +++++++----
 .../back-end/tests/test_department_model.py        | 35 ++++++++++++++++++++++
 2 files changed, 47 insertions(+), 5 deletions(-)

## diff -U10
diff --git a/user-service/back-end/app/domain/models/department.py b/user-service/back-end/app/domain/models/department.py
index 4b5c772..e691839 100644
--- a/user-service/back-end/app/domain/models/department.py
+++ b/user-service/back-end/app/domain/models/department.py
@@ -1,32 +1,39 @@
-"""部门模型 - Materialized Path."""
+"""部门模型 - Materialized Path(node_seq 整数路径)."""
 
 from __future__ import annotations
 
 import uuid
+from datetime import datetime
 
-from sqlalchemy import String, ForeignKey, Uuid, select
+from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Uuid, func, select
 from sqlalchemy.orm import Mapped, mapped_column
 
 from app.domain.models import Base
 
 UUIDType = Uuid
 
 
 class Department(Base):
     __tablename__ = "department"
+    __table_args__ = (CheckConstraint("level BETWEEN 1 AND 5", name="ck_dept_level"),)
 
     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    node_seq: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
     name: Mapped[str] = mapped_column(String(100), nullable=False)
     code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
     parent_id: Mapped[uuid.UUID | None] = mapped_column(
         UUIDType, ForeignKey("department.id"), nullable=True
     )
-    level: Mapped[int] = mapped_column(nullable=False)
+    level: Mapped[int] = mapped_column(Integer, nullable=False)
     path: Mapped[str] = mapped_column(String(500), nullable=False)
-    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)
+    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
+    manager_id: Mapped[uuid.UUID | None] = mapped_column(
+        UUIDType, ForeignKey("user_account.id"), nullable=True
+    )
     status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
+    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
 
     @classmethod
     def find_subtree(cls, root_path: str):
-        """查询子树（path LIKE root_path/%）。"""
+        """查询子树(path LIKE root_path%)."""
         return select(cls).where(cls.path.like(f"{root_path}%"))
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_department_model.py b/user-service/back-end/tests/test_department_model.py
new file mode 100644
index 0000000..3fb0d02
--- /dev/null
+++ b/user-service/back-end/tests/test_department_model.py
@@ -0,0 +1,35 @@
+# tests/test_department_model.py
+from __future__ import annotations
+
+import pytest
+from sqlalchemy import inspect
+
+from app.domain.models import Base
+import app.domain.models.associations  # noqa: F401
+import app.domain.models.role  # noqa: F401
+import app.domain.models.user  # noqa: F401
+import app.domain.models.department  # noqa: F401
+
+pytestmark = pytest.mark.asyncio
+
+
+def test_department_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["department"]).columns}
+    assert {"id", "node_seq", "name", "code", "parent_id", "level", "path",
+            "sort_order", "manager_id", "status", "deleted_at",
+            "created_at", "updated_at"} <= cols
+
+
+def test_department_node_seq_unique():
+    node_seq = Base.metadata.tables["department"].columns["node_seq"]
+    assert node_seq.unique is True
+
+
+def test_department_level_check():
+    table = Base.metadata.tables["department"]
+    has_check = any(
+        "LEVEL BETWEEN 1 AND 5" in str(c.sqltext).upper()
+        for c in table.constraints
+        if hasattr(c, "sqltext")
+    )
+    assert has_check
\ No newline at end of file
