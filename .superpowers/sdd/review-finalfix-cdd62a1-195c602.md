## commits cdd62a1..195c602
195c602 fix(dept): final-review fixes(count_children ACTIVE filter, replace_subtree_paths or_ selection, INACTIVE-parent reject, service list/get, status Literal, list_dept_users response_model)

## stat
 .../back-end/app/application/schemas/department.py |  3 ++-
 .../app/application/services/department_service.py | 17 +++++++++++++-
 .../back-end/app/interfaces/api/departments.py     | 16 +++++--------
 .../app/repositories/department_repository.py      | 24 +++++++++++++++----
 .../back-end/tests/test_department_repository.py   | 20 +++++++++++++++-
 .../back-end/tests/test_department_schema.py       |  8 +++++++
 .../back-end/tests/test_department_service.py      | 27 ++++++++++++++++++++++
 7 files changed, 98 insertions(+), 17 deletions(-)

## diff -U10
diff --git a/user-service/back-end/app/application/schemas/department.py b/user-service/back-end/app/application/schemas/department.py
index e9c0866..d3c10fa 100644
--- a/user-service/back-end/app/application/schemas/department.py
+++ b/user-service/back-end/app/application/schemas/department.py
@@ -1,34 +1,35 @@
 """部门 Pydantic 模型."""
 
 from __future__ import annotations
 
 import uuid
 from datetime import datetime
+from typing import Literal
 
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
-    status: str | None = Field(default=None, max_length=20)
+    status: Literal["ACTIVE", "INACTIVE"] | None = None
 
 
 class DepartmentMove(BaseModel):
     parent_id: uuid.UUID | None = None
 
 
 class DepartmentOut(BaseModel):
     model_config = ConfigDict(from_attributes=True)
 
     id: uuid.UUID
diff --git a/user-service/back-end/app/application/services/department_service.py b/user-service/back-end/app/application/services/department_service.py
index db48517..e38dea4 100644
--- a/user-service/back-end/app/application/services/department_service.py
+++ b/user-service/back-end/app/application/services/department_service.py
@@ -36,20 +36,22 @@ class DepartmentService:
         return dept
 
     async def create(self, req: DepartmentCreate) -> Department:
         if await self.repo.get_by_code(req.code) is not None:
             raise ConflictError("部门编码已存在")
         node_seq = await self.repo.next_node_seq()
         if req.parent_id is not None:
             parent = await self.repo.get_by_id(req.parent_id)
             if parent is None:
                 raise NotFoundError("父部门不存在")
+            if parent.status != "ACTIVE":
+                raise BusinessException("父部门已停用,无法在其下创建子部门")
             if parent.level >= MAX_LEVEL:
                 raise BusinessException(f"父部门已达第 {MAX_LEVEL} 级,无法添加子部门")
             level = parent.level + 1
             path = f"{parent.path}/{node_seq}"
             parent_id = parent.id
         else:
             level = 1
             path = f"/{node_seq}"
             parent_id = None
         dept = Department(
@@ -180,11 +182,24 @@ class DepartmentService:
             node = nodes[d.id]
             if d.id == root.id:
                 roots.append(node)
             elif d.parent_id is not None and d.parent_id in nodes:
                 nodes[d.parent_id].children.append(node)
         return roots
 
     async def list_users(self, dept_id: uuid.UUID) -> list[UserOut]:
         await self._get_or_404(dept_id)
         result = await self.db.execute(select(User).where(User.department_id == dept_id))
-        return [UserOut.model_validate(u) for u in result.scalars().all()]
\ No newline at end of file
+        return [UserOut.model_validate(u) for u in result.scalars().all()]
+
+    async def list(self, page: int = 1, size: int = 20) -> tuple[list[Department], int]:
+        flat = await self.repo.list_active()
+        total = len(flat)
+        start = (page - 1) * size
+        items = flat[start:start + size]
+        return items, total
+
+    async def get(self, dept_id: uuid.UUID) -> Department:
+        dept = await self.repo.get_by_id(dept_id)
+        if dept is None:
+            raise NotFoundError("部门不存在")
+        return dept
\ No newline at end of file
diff --git a/user-service/back-end/app/interfaces/api/departments.py b/user-service/back-end/app/interfaces/api/departments.py
index a3b7fab..294dbe0 100644
--- a/user-service/back-end/app/interfaces/api/departments.py
+++ b/user-service/back-end/app/interfaces/api/departments.py
@@ -9,20 +9,21 @@ from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.application.deps import get_db
 from app.application.schemas.department import (
     DepartmentCreate,
     DepartmentListOut,
     DepartmentMove,
     DepartmentOut,
     DepartmentTreeNode,
     DepartmentUpdate,
 )
+from app.application.schemas.user import UserOut
 from app.application.services.department_service import DepartmentService
 from app.core.cache import DepartmentCache, get_department_cache
 from app.core.security import require_permission
 from app.domain.models.user import User
 from app.repositories.department_repository import DepartmentRepository
 
 router = APIRouter(prefix="/departments", tags=["departments"])
 
 
 def _svc(db: AsyncSession, cache: DepartmentCache) -> DepartmentService:
@@ -50,41 +51,36 @@ async def get_subtree(
 
 @router.get("", response_model=DepartmentListOut)
 async def list_departments(
     page: int = Query(1, ge=1),
     size: int = Query(20, ge=1, le=100),
     db: AsyncSession = Depends(get_db),
     cache: DepartmentCache = Depends(get_department_cache),
     _: User = Depends(require_permission("dept:read")),
 ) -> DepartmentListOut:
     svc = _svc(db, cache)
-    flat = await svc.repo.list_active()
-    start = (page - 1) * size
-    items = flat[start:start + size]
+    items, total = await svc.list(page, size)
     return DepartmentListOut(
         items=[DepartmentOut.model_validate(d) for d in items],
-        total=len(flat), page=page, size=size,
+        total=total, page=page, size=size,
     )
 
 
 @router.get("/{dept_id}", response_model=DepartmentOut)
 async def get_department(
     dept_id: uuid.UUID,
     db: AsyncSession = Depends(get_db),
     cache: DepartmentCache = Depends(get_department_cache),
     _: User = Depends(require_permission("dept:read")),
 ) -> DepartmentOut:
     svc = _svc(db, cache)
-    dept = await svc.repo.get_by_id(dept_id)
-    if dept is None:
-        from app.core.exceptions import NotFoundError
-        raise NotFoundError("部门不存在")
+    dept = await svc.get(dept_id)
     return DepartmentOut.model_validate(dept)
 
 
 @router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
 async def create_department(
     req: DepartmentCreate,
     db: AsyncSession = Depends(get_db),
     cache: DepartmentCache = Depends(get_department_cache),
     _: User = Depends(require_permission("dept:create")),
 ) -> DepartmentOut:
@@ -116,18 +112,18 @@ async def move_department(
 @router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
 async def delete_department(
     dept_id: uuid.UUID,
     db: AsyncSession = Depends(get_db),
     cache: DepartmentCache = Depends(get_department_cache),
     _: User = Depends(require_permission("dept:delete")),
 ) -> None:
     await _svc(db, cache).delete(dept_id)
 
 
-@router.get("/{dept_id}/users", response_model=list)
+@router.get("/{dept_id}/users", response_model=list[UserOut])
 async def list_dept_users(
     dept_id: uuid.UUID,
     db: AsyncSession = Depends(get_db),
     cache: DepartmentCache = Depends(get_department_cache),
     _: User = Depends(require_permission("dept:read")),
-):
+) -> list[UserOut]:
     return await _svc(db, cache).list_users(dept_id)
\ No newline at end of file
diff --git a/user-service/back-end/app/repositories/department_repository.py b/user-service/back-end/app/repositories/department_repository.py
index d77a3e9..7c1ec79 100644
--- a/user-service/back-end/app/repositories/department_repository.py
+++ b/user-service/back-end/app/repositories/department_repository.py
@@ -1,18 +1,18 @@
 # app/repositories/department_repository.py
 """部门数据访问."""
 
 from __future__ import annotations
 
 import uuid
 
-from sqlalchemy import func, select
+from sqlalchemy import func, or_, select
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.domain.models.department import Department
 from app.domain.models.user import User
 
 
 class DepartmentRepository:
     def __init__(self, db: AsyncSession):
         self.db = db
 
@@ -36,21 +36,26 @@ class DepartmentRepository:
         return list(result.scalars().all())
 
     async def find_subtree(self, root_path: str) -> list[Department]:
         result = await self.db.execute(
             select(Department).where(Department.path.like(f"{root_path}%"))
         )
         return list(result.scalars().all())
 
     async def count_children(self, parent_id: uuid.UUID) -> int:
         result = await self.db.execute(
-            select(func.count()).select_from(Department).where(Department.parent_id == parent_id)
+            select(func.count())
+            .select_from(Department)
+            .where(
+                Department.parent_id == parent_id,
+                Department.status == "ACTIVE",
+            )
         )
         return int(result.scalar_one())
 
     async def count_users(self, dept_id: uuid.UUID) -> int:
         result = await self.db.execute(
             select(func.count()).select_from(User).where(User.department_id == dept_id)
         )
         return int(result.scalar_one())
 
     async def max_descendant_depth(self, root_path: str, root_level: int) -> int:
@@ -64,21 +69,32 @@ class DepartmentRepository:
 
     async def add(self, dept: Department) -> Department:
         self.db.add(dept)
         await self.db.flush()
         await self.db.refresh(dept)
         return dept
 
     async def replace_subtree_paths(
         self, old_prefix: str, new_prefix: str, level_delta: int, root_path: str
     ) -> None:
-        """批量替换子树(含 root_path 匹配项)的 path 前缀并调整 level(严格前缀替换)."""
+        """批量替换子树的 path 前缀并调整 level(严格前缀替换).
+
+        匹配规则: path 等于 root_path 或以 ``root_path + "/"`` 开头。
+        - 传 ``root_path="/1"`` 同时匹配根 ``/1`` 自身及其后代;
+        - 传 ``root_path="/1/"`` 仅匹配后代(排除根自身)。
+        严格前缀匹配,避免 ``/1`` 误伤 ``/10`` 等同级兄弟。
+        """
         result = await self.db.execute(
-            select(Department).where(Department.path.like(f"{root_path}%"))
+            select(Department).where(
+                or_(
+                    Department.path == root_path,
+                    Department.path.like(root_path.rstrip("/") + "/%"),
+                )
+            )
         )
         for dept in result.scalars().all():
             dept.path = new_prefix + dept.path[len(old_prefix):]
             dept.level = dept.level + level_delta
         await self.db.flush()
 
 
 __all__ = ["DepartmentRepository"]
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_department_repository.py b/user-service/back-end/tests/test_department_repository.py
index af40874..c2d5603 100644
--- a/user-service/back-end/tests/test_department_repository.py
+++ b/user-service/back-end/tests/test_department_repository.py
@@ -66,20 +66,33 @@ async def test_count_children_and_users(engine, seed):
         await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2,
                          path="/1/2", parent_id=d1.id)
         user = User(email="u@t.com", password_hash=hash_password("X@1234567"),
                     first_name="U", last_name="L", department_id=d1.id)
         db.add(user)
         await db.commit()
         assert await repo.count_children(d1.id) == 1
         assert await repo.count_users(d1.id) == 1
 
 
+async def test_count_children_ignores_soft_deleted(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = DepartmentRepository(db)
+        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
+        child = await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2,
+                                path="/1/2", parent_id=d1.id)
+        child.status = "INACTIVE"  # 软删除子部门
+        await db.commit()
+        # 软删除的子部门不计入 count_children,允许父部门删除
+        assert await repo.count_children(d1.id) == 0
+
+
 async def test_max_descendant_depth(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         repo = DepartmentRepository(db)
         d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
         await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2,
                          path="/1/2", parent_id=d1.id)
         await _seed_dept(db, node_seq=3, name="后端", code="BE", level=3,
                          path="/1/2/3", parent_id=uuid.uuid4())
         await db.commit()
@@ -106,20 +119,25 @@ async def test_replace_subtree_paths(engine, seed):
 async def test_replace_subtree_paths_multidigit(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         repo = DepartmentRepository(db)
         # 构造 node_seq 1 和 10,验证 /1 不会误伤 /10
         d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
         d10 = await _seed_dept(db, node_seq=10, name="研发", code="RD", level=2,
                                path="/1/10", parent_id=d1.id)
         d100 = await _seed_dept(db, node_seq=100, name="后端", code="BE", level=3,
                                 path="/1/10/100", parent_id=d10.id)
+        # 根级 /11 兄弟,不在 /1 子树下,必须不被误伤(LIKE '/1%' 会误匹配 /11)
+        sibling = await _seed_dept(db, node_seq=11, name="兄弟", code="SIB", level=1, path="/11")
         await db.commit()
         await repo.replace_subtree_paths(old_prefix="/1", new_prefix="/9",
                                          level_delta=1, root_path="/1")
         await db.commit()
         await db.refresh(d1)
         await db.refresh(d10)
         await db.refresh(d100)
+        await db.refresh(sibling)
         assert d1.path == "/9" and d1.level == 2
         assert d10.path == "/9/10" and d10.level == 3   # 不被误改为 /9/90
-        assert d100.path == "/9/10/100" and d100.level == 4  # 不被误改为 /9/90/900
\ No newline at end of file
+        assert d100.path == "/9/10/100" and d100.level == 4  # 不被误改为 /9/90/900
+        # 根级 /11 兄弟未被触碰
+        assert sibling.path == "/11" and sibling.level == 1
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_department_schema.py b/user-service/back-end/tests/test_department_schema.py
index 3932426..72ba007 100644
--- a/user-service/back-end/tests/test_department_schema.py
+++ b/user-service/back-end/tests/test_department_schema.py
@@ -19,20 +19,28 @@ def test_department_create_minimal():
     d = DepartmentCreate(name="总部", code="HQ")
     assert d.parent_id is None and d.sort_order == 0
 
 
 def test_department_update_excludes_parent_id():
     fields = set(DepartmentUpdate.model_fields.keys())
     assert "parent_id" not in fields
     assert "status" in fields
 
 
+def test_department_update_status_literal():
+    assert DepartmentUpdate(status="ACTIVE").status == "ACTIVE"
+    assert DepartmentUpdate(status="INACTIVE").status == "INACTIVE"
+    assert DepartmentUpdate().status is None
+    with pytest.raises(ValueError):
+        DepartmentUpdate(status="BOGUS")
+
+
 def test_department_move_optional_parent():
     assert DepartmentMove(parent_id=None).parent_id is None
     uid = uuid.uuid4()
     assert DepartmentMove(parent_id=uid).parent_id == uid
 
 
 def test_tree_node_recursive():
     node = DepartmentTreeNode(
         id=uuid.uuid4(), node_seq=1, name="A", code="A", parent_id=None,
         level=1, path="/1", sort_order=0, manager_id=None, status="ACTIVE",
diff --git a/user-service/back-end/tests/test_department_service.py b/user-service/back-end/tests/test_department_service.py
index d646aa4..a020351 100644
--- a/user-service/back-end/tests/test_department_service.py
+++ b/user-service/back-end/tests/test_department_service.py
@@ -87,20 +87,47 @@ async def test_delete_leaf_ok(engine, seed):
 async def test_delete_with_children_rejected(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         svc = _service(db)
         root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
         await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
         with pytest.raises(ConflictError):
             await svc.delete(root.id)
 
 
+async def test_delete_with_only_inactive_child_ok(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _service(db)
+        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
+        child = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
+        # 软删除子部门,父部门仅剩一个 INACTIVE 子部门
+        child.status = "INACTIVE"
+        await db.commit()
+        # 父部门应可被删除(不抛 409)
+        await svc.delete(root.id)
+        got = await db.get(Department, root.id)
+        assert got.status == "INACTIVE"
+
+
+async def test_create_under_inactive_parent_rejected(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _service(db)
+        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
+        # 软删除父部门
+        root.status = "INACTIVE"
+        await db.commit()
+        with pytest.raises(BusinessException):
+            await svc.create(DepartmentCreate(name="子", code="C", parent_id=root.id))
+
+
 async def test_delete_with_users_rejected(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         svc = _service(db)
         root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
         db.add(User(email="u@t.com", password_hash=hash_password("X@1234567"),
                     first_name="U", last_name="L", department_id=root.id))
         await db.commit()
         with pytest.raises(ConflictError):
             await svc.delete(root.id)
