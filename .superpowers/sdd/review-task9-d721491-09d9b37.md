## commits d721491..09d9b37
09d9b37 feat(dept): 部门 API 路由 + main 注册 + seed dept 权限

## stat
 .../back-end/app/interfaces/api/departments.py     | 135 +++++++++++++++++++++
 user-service/back-end/app/main.py                  |   3 +-
 user-service/back-end/tests/conftest.py            |   6 +
 .../back-end/tests/test_departments_api.py         |  67 ++++++++++
 4 files changed, 210 insertions(+), 1 deletion(-)

## diff -U10
diff --git a/user-service/back-end/app/interfaces/api/departments.py b/user-service/back-end/app/interfaces/api/departments.py
new file mode 100644
index 0000000..54d59f8
--- /dev/null
+++ b/user-service/back-end/app/interfaces/api/departments.py
@@ -0,0 +1,135 @@
+"""部门路由."""
+
+from __future__ import annotations
+
+import uuid
+
+from fastapi import APIRouter, Depends, Query, status
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.deps import get_db
+from app.application.schemas.department import (
+    DepartmentCreate,
+    DepartmentListOut,
+    DepartmentMove,
+    DepartmentOut,
+    DepartmentTreeNode,
+    DepartmentUpdate,
+)
+from app.application.services.department_service import DepartmentService
+from app.core.cache import DepartmentCache, get_department_cache
+from app.core.security import require_permission
+from app.domain.models.user import User
+from app.repositories.department_repository import DepartmentRepository
+
+router = APIRouter(prefix="/departments", tags=["departments"])
+
+
+def _svc(db: AsyncSession, cache: DepartmentCache) -> DepartmentService:
+    return DepartmentService(db, DepartmentRepository(db), cache)
+
+
+@router.get("/tree", response_model=list[DepartmentTreeNode])
+async def get_tree(
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:read")),
+) -> list[DepartmentTreeNode]:
+    return await _svc(db, cache).get_tree()
+
+
+@router.get("/{dept_id}/subtree", response_model=list[DepartmentTreeNode])
+async def get_subtree(
+    dept_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:read")),
+) -> list[DepartmentTreeNode]:
+    return await _svc(db, cache).get_subtree(dept_id)
+
+
+@router.get("", response_model=DepartmentListOut)
+async def list_departments(
+    page: int = Query(1, ge=1),
+    size: int = Query(20, ge=1, le=100),
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:read")),
+) -> DepartmentListOut:
+    svc = _svc(db, cache)
+    flat = await svc.repo.list_active()
+    start = (page - 1) * size
+    items = flat[start:start + size]
+    return DepartmentListOut(
+        items=[DepartmentOut.model_validate(d) for d in items],
+        total=len(flat), page=page, size=size,
+    )
+
+
+@router.get("/{dept_id}", response_model=DepartmentOut)
+async def get_department(
+    dept_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:read")),
+) -> DepartmentOut:
+    svc = _svc(db, cache)
+    dept = await svc.repo.get_by_id(dept_id)
+    if dept is None:
+        from app.core.exceptions import NotFoundError
+        raise NotFoundError("部门不存在")
+    return DepartmentOut.model_validate(dept)
+
+
+@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
+async def create_department(
+    req: DepartmentCreate,
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:create")),
+) -> DepartmentOut:
+    dept = await _svc(db, cache).create(req)
+    return DepartmentOut.model_validate(dept)
+
+
+@router.put("/{dept_id}", response_model=DepartmentOut)
+async def update_department(
+    dept_id: uuid.UUID,
+    req: DepartmentUpdate,
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:update")),
+) -> DepartmentOut:
+    return DepartmentOut.model_validate(await _svc(db, cache).update(dept_id, req))
+
+
+@router.post("/{dept_id}/move", response_model=DepartmentOut)
+async def move_department(
+    dept_id: uuid.UUID,
+    req: DepartmentMove,
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:update")),
+) -> DepartmentOut:
+    return DepartmentOut.model_validate(await _svc(db, cache).move(dept_id, req.parent_id))
+
+
+@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
+async def delete_department(
+    dept_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:delete")),
+) -> None:
+    await _svc(db, cache).delete(dept_id)
+
+
+@router.get("/{dept_id}/users", response_model=list)
+async def list_dept_users(
+    dept_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    cache: DepartmentCache = Depends(get_department_cache),
+    _: User = Depends(require_permission("dept:read")),
+):
+    from app.application.schemas.user import UserOut
+    return await _svc(db, cache).list_users(dept_id)
\ No newline at end of file
diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
index 975fb6d..324baed 100644
--- a/user-service/back-end/app/main.py
+++ b/user-service/back-end/app/main.py
@@ -10,21 +10,21 @@ from fastapi.middleware.cors import CORSMiddleware
 
 # 确保关联表与模型在导入时注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401
 import app.domain.models.department  # noqa: F401
 import app.domain.models.role  # noqa: F401
 import app.domain.models.user  # noqa: F401
 from app.core.config import settings
 from app.core.database import engine
 from app.core.exceptions import register_exception_handlers
 from app.domain.models import Base
-from app.interfaces.api import auth, health, users
+from app.interfaces.api import auth, departments, health, users
 
 
 @asynccontextmanager
 async def lifespan(_: FastAPI) -> AsyncIterator[None]:
     # 测试/开发环境自动建表；生产应使用 Alembic 迁移
     async with engine.begin() as conn:
         await conn.run_sync(Base.metadata.create_all)
     yield
     await engine.dispose()
 
@@ -43,15 +43,16 @@ def create_app() -> FastAPI:
         allow_credentials=True,
         allow_methods=["*"],
         allow_headers=["*"],
     )
 
     register_exception_handlers(app)
 
     app.include_router(health.router)
     app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
     app.include_router(users.router, prefix=settings.API_V1_PREFIX)
+    app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
 
     return app
 
 
 app = create_app()
\ No newline at end of file
diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
index 9eea64c..e4a2656 100644
--- a/user-service/back-end/tests/conftest.py
+++ b/user-service/back-end/tests/conftest.py
@@ -68,20 +68,24 @@ async def db_session(engine):
 
 @pytest_asyncio.fixture
 async def seed(db_session):
     """种子权限与角色。"""
     perms = [
         Permission(name="用户读取", code="user:read", type="ACTION", resource="user", action="read"),
         Permission(name="用户创建", code="user:create", type="ACTION", resource="user", action="create"),
         Permission(name="用户更新", code="user:update", type="ACTION", resource="user", action="update"),
         Permission(name="用户删除", code="user:delete", type="ACTION", resource="user", action="delete"),
         Permission(name="用户分配角色", code="user:assign_role", type="ACTION", resource="user", action="assign_role"),
+        Permission(name="部门读取", code="dept:read", type="ACTION", resource="dept", action="read"),
+        Permission(name="部门创建", code="dept:create", type="ACTION", resource="dept", action="create"),
+        Permission(name="部门更新", code="dept:update", type="ACTION", resource="dept", action="update"),
+        Permission(name="部门删除", code="dept:delete", type="ACTION", resource="dept", action="delete"),
     ]
     db_session.add_all(perms)
     await db_session.flush()
 
     admin = Role(name="管理员", code="ADMIN", data_scope=DataScope.ALL)
     admin.permissions = perms
     user_role = Role(name="普通用户", code="USER", data_scope=DataScope.SELF)
     db_session.add_all([admin, user_role])
     await db_session.commit()
     return {"admin": admin, "user": user_role, "permissions": perms}
@@ -89,20 +93,22 @@ async def seed(db_session):
 
 @pytest_asyncio.fixture
 async def client(engine, seed) -> AsyncIterator[AsyncClient]:
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
 
     async def override_get_db():
         async with Session() as session:
             yield session
 
     app.dependency_overrides[get_db] = override_get_db
+    from app.core.cache import NoopDepartmentCache, get_department_cache
+    app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
     transport = ASGITransport(app=app)
     async with AsyncClient(transport=transport, base_url="http://test") as ac:
         yield ac
     app.dependency_overrides.clear()
 
 
 @pytest_asyncio.fixture
 async def admin_token(client, engine) -> str:
     # 注册一个管理员账号并通过直接数据库操作赋予 ADMIN 角色
     resp = await client.post(
diff --git a/user-service/back-end/tests/test_departments_api.py b/user-service/back-end/tests/test_departments_api.py
new file mode 100644
index 0000000..0a3369a
--- /dev/null
+++ b/user-service/back-end/tests/test_departments_api.py
@@ -0,0 +1,67 @@
+"""部门 API 路由测试."""
+
+from __future__ import annotations
+
+import pytest
+
+pytestmark = pytest.mark.asyncio
+
+DEPT = {"name": "总部", "code": "HQ"}
+
+
+async def _h(token):
+    return {"Authorization": f"Bearer {token}"}
+
+
+async def test_create_and_get_tree(client, admin_token):
+    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
+    assert resp.status_code == 201, resp.text
+    assert resp.json()["level"] == 1
+    tree = await client.get("/api/v1/departments/tree", headers=await _h(admin_token))
+    assert tree.status_code == 200
+    assert tree.json()[0]["code"] == "HQ"
+
+
+async def test_create_code_conflict(client, admin_token):
+    await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
+    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
+    assert resp.status_code == 409
+
+
+async def test_move_endpoint(client, admin_token):
+    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
+    sl = (await client.post("/api/v1/departments", json={"name": "销售", "code": "SL"},
+                            headers=await _h(admin_token))).json()
+    rd = (await client.post("/api/v1/departments",
+                            json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
+                            headers=await _h(admin_token))).json()
+    resp = await client.post(f"/api/v1/departments/{rd['id']}/move",
+                             json={"parent_id": sl["id"]}, headers=await _h(admin_token))
+    assert resp.status_code == 200, resp.text
+    assert resp.json()["parent_id"] == sl["id"]
+
+
+async def test_delete_with_children_409(client, admin_token):
+    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
+    await client.post("/api/v1/departments",
+                      json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
+                      headers=await _h(admin_token))
+    resp = await client.delete(f"/api/v1/departments/{hq['id']}", headers=await _h(admin_token))
+    assert resp.status_code == 409
+
+
+async def test_regular_user_forbidden(client):
+    reg = await client.post("/api/v1/auth/register", json={
+        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
+    assert reg.status_code == 201
+    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
+    token = login.json()["access_token"]
+    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(token))
+    assert resp.status_code == 403
+
+
+async def test_list_users_endpoint(client, admin_token):
+    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
+    resp = await client.get(f"/api/v1/departments/{hq['id']}/users", headers=await _h(admin_token))
+    assert resp.status_code == 200
+    assert resp.json() == []
\ No newline at end of file
