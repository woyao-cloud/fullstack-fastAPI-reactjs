## commits 15a2e54..cbb531e
cbb531e feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展

## stat
 .../back-end/app/interfaces/api/email_templates.py |  71 +++++++++++
 .../back-end/app/interfaces/api/system_config.py   | 132 +++++++++++++++++++++
 user-service/back-end/app/main.py                  |   4 +-
 user-service/back-end/tests/conftest.py            |  14 +++
 .../back-end/tests/test_email_templates_api.py     |  37 ++++++
 .../back-end/tests/test_system_config_api.py       |  64 ++++++++++
 6 files changed, 321 insertions(+), 1 deletion(-)

## diff -U10
diff --git a/user-service/back-end/app/interfaces/api/email_templates.py b/user-service/back-end/app/interfaces/api/email_templates.py
new file mode 100644
index 0000000..c84c936
--- /dev/null
+++ b/user-service/back-end/app/interfaces/api/email_templates.py
@@ -0,0 +1,71 @@
+"""邮件模板路由."""
+
+from __future__ import annotations
+
+import uuid
+
+from fastapi import APIRouter, Depends, Query, status
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.deps import get_db
+from app.application.schemas.system_config import (
+    EmailTemplateCreate, EmailTemplateListOut, EmailTemplateOut, EmailTemplateUpdate,
+)
+from app.application.services.email_template_service import EmailTemplateService
+from app.core.security import require_permission
+from app.domain.models.user import User
+from app.repositories.system_config_repository import EmailTemplateRepository
+
+router = APIRouter(prefix="/email-templates", tags=["email-templates"])
+
+
+def _svc(db: AsyncSession) -> EmailTemplateService:
+    return EmailTemplateService(db, EmailTemplateRepository(db))
+
+
+@router.get("", response_model=EmailTemplateListOut)
+async def list_templates(
+    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:read")),
+) -> EmailTemplateListOut:
+    items, total = await _svc(db).list(page, size)
+    return EmailTemplateListOut(
+        items=[EmailTemplateOut.model_validate(i) for i in items],
+        total=total, page=page, size=size)
+
+
+@router.get("/{tpl_id}", response_model=EmailTemplateOut)
+async def get_template(
+    tpl_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:read")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).get(tpl_id))
+
+
+@router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
+async def create_template(
+    req: EmailTemplateCreate,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:create")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).create(req))
+
+
+@router.put("/{tpl_id}", response_model=EmailTemplateOut)
+async def update_template(
+    tpl_id: uuid.UUID, req: EmailTemplateUpdate,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:update")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).update(tpl_id, req))
+
+
+@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
+async def delete_template(
+    tpl_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:delete")),
+) -> None:
+    await _svc(db).delete(tpl_id)
\ No newline at end of file
diff --git a/user-service/back-end/app/interfaces/api/system_config.py b/user-service/back-end/app/interfaces/api/system_config.py
new file mode 100644
index 0000000..f464678
--- /dev/null
+++ b/user-service/back-end/app/interfaces/api/system_config.py
@@ -0,0 +1,132 @@
+"""系统配置路由."""
+
+from __future__ import annotations
+
+import uuid
+
+from fastapi import APIRouter, Depends, Query
+from pydantic import BaseModel
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.deps import get_db
+from app.core.config_cache import ConfigCache, get_config_cache
+from app.core.security import require_permission
+from app.domain.models.user import User
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, SystemConfigRepository,
+)
+from app.application.services.config_service import ConfigService
+from app.core import crypto
+
+router = APIRouter(prefix="/config", tags=["config"])
+
+
+def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
+    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
+
+
+class ConfigValueUpdate(BaseModel):
+    value: str | int | bool | dict
+
+
+def _mask(values: dict, group: str) -> dict:
+    from app.application.schemas.system_config import GROUP_MODELS
+    model = GROUP_MODELS[group]
+    masked = {}
+    for k, v in values.items():
+        fi = model.model_fields.get(k)
+        if fi is not None and "SecretStr" in str(fi.annotation):
+            masked[k] = "***"
+        else:
+            masked[k] = v
+    return masked
+
+
+@router.get("/groups")
+async def list_groups(
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> list[str]:
+    return _svc(db, cache).list_groups()
+
+
+@router.get("")
+async def get_group(
+    group: str = Query(...),
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> dict:
+    svc = _svc(db, cache)
+    values = await svc.get_group(group)
+    return {"group": group, "values": _mask(values, group)}
+
+
+@router.get("/history")
+async def history(
+    key: str = Query(...),
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> list[dict]:
+    repo = ConfigHistoryRepository(db)
+    rows = await repo.list_by_key(key)
+    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
+    group = group_of_key(key)
+    field = key.split(".", 1)[1]
+    fi = GROUP_MODELS[group].model_fields.get(field)
+    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
+    out = []
+    for r in rows:
+        out.append({
+            "key": r.config_key,
+            "old_value": "***" if is_secret else r.old_value,
+            "new_value": "***" if is_secret else r.new_value,
+            "changed_by": str(r.changed_by),
+            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
+        })
+    return out
+
+
+@router.get("/{key}")
+async def get_value(
+    key: str,
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> dict:
+    svc = _svc(db, cache)
+    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
+    group = group_of_key(key)
+    values = await svc.get_group(group)
+    field = key.split(".", 1)[1]
+    val = values.get(field)
+    fi = GROUP_MODELS[group].model_fields.get(field)
+    if fi is not None and "SecretStr" in str(fi.annotation):
+        val = "***"
+    return {"key": key, "group": group, "value": val}
+
+
+@router.put("/{key}")
+async def put_value(
+    key: str,
+    req: ConfigValueUpdate,
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:update")),
+) -> dict:
+    svc = _svc(db, cache)
+    await svc.set_value(key, req.value, user.id)
+    return {"key": key, "ok": True}
+
+
+@router.post("/init")
+async def init_configs(
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:update")),
+) -> dict:
+    svc = _svc(db, cache)
+    await svc.init_default_configs(user.id)
+    return {"ok": True}
\ No newline at end of file
diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
index c12de28..1ba7e1f 100644
--- a/user-service/back-end/app/main.py
+++ b/user-service/back-end/app/main.py
@@ -11,21 +11,21 @@ from fastapi.middleware.cors import CORSMiddleware
 # 确保关联表与模型在导入时注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401
 import app.domain.models.department  # noqa: F401
 import app.domain.models.role  # noqa: F401
 import app.domain.models.system_config  # noqa: F401
 import app.domain.models.user  # noqa: F401
 from app.core.config import settings
 from app.core.database import engine
 from app.core.exceptions import register_exception_handlers
 from app.domain.models import Base
-from app.interfaces.api import auth, departments, health, users
+from app.interfaces.api import auth, departments, email_templates, health, system_config, users
 
 
 @asynccontextmanager
 async def lifespan(_: FastAPI) -> AsyncIterator[None]:
     # 测试/开发环境自动建表；生产应使用 Alembic 迁移
     async with engine.begin() as conn:
         await conn.run_sync(Base.metadata.create_all)
     yield
     await engine.dispose()
 
@@ -45,15 +45,17 @@ def create_app() -> FastAPI:
         allow_methods=["*"],
         allow_headers=["*"],
     )
 
     register_exception_handlers(app)
 
     app.include_router(health.router)
     app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
     app.include_router(users.router, prefix=settings.API_V1_PREFIX)
     app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
+    app.include_router(system_config.router, prefix=settings.API_V1_PREFIX)
+    app.include_router(email_templates.router, prefix=settings.API_V1_PREFIX)
 
     return app
 
 
 app = create_app()
\ No newline at end of file
diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
index 71355ae..e8116a6 100644
--- a/user-service/back-end/tests/conftest.py
+++ b/user-service/back-end/tests/conftest.py
@@ -96,20 +96,32 @@ async def seed(db_session):
         Permission(name="用户分配角色", code="user:assign_role", type="ACTION",
                    resource="user", action="assign_role"),
         Permission(name="部门读取", code="dept:read", type="ACTION",
                    resource="dept", action="read"),
         Permission(name="部门创建", code="dept:create", type="ACTION",
                    resource="dept", action="create"),
         Permission(name="部门更新", code="dept:update", type="ACTION",
                    resource="dept", action="update"),
         Permission(name="部门删除", code="dept:delete", type="ACTION",
                    resource="dept", action="delete"),
+        Permission(name="配置读取", code="config:read", type="ACTION",
+                   resource="config", action="read"),
+        Permission(name="配置更新", code="config:update", type="ACTION",
+                   resource="config", action="update"),
+        Permission(name="模板读取", code="template:read", type="ACTION",
+                   resource="template", action="read"),
+        Permission(name="模板创建", code="template:create", type="ACTION",
+                   resource="template", action="create"),
+        Permission(name="模板更新", code="template:update", type="ACTION",
+                   resource="template", action="update"),
+        Permission(name="模板删除", code="template:delete", type="ACTION",
+                   resource="template", action="delete"),
     ]
     db_session.add_all(perms)
     await db_session.flush()
 
     admin = Role(name="管理员", code="ADMIN", data_scope=DataScope.ALL)
     admin.permissions = perms
     user_role = Role(name="普通用户", code="USER", data_scope=DataScope.SELF)
     db_session.add_all([admin, user_role])
     await db_session.commit()
     return {"admin": admin, "user": user_role, "permissions": perms}
@@ -119,20 +131,22 @@ async def seed(db_session):
 async def client(engine, seed) -> AsyncIterator[AsyncClient]:
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
 
     async def override_get_db():
         async with Session() as session:
             yield session
 
     app.dependency_overrides[get_db] = override_get_db
     from app.core.cache import NoopDepartmentCache, get_department_cache
     app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
+    from app.core.config_cache import LocalTTLCache, get_config_cache
+    app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()
     transport = ASGITransport(app=app)
     async with AsyncClient(transport=transport, base_url="http://test") as ac:
         yield ac
     app.dependency_overrides.clear()
 
 
 @pytest_asyncio.fixture
 async def admin_token(client, engine) -> str:
     # 注册一个管理员账号并通过直接数据库操作赋予 ADMIN 角色
     resp = await client.post(
diff --git a/user-service/back-end/tests/test_email_templates_api.py b/user-service/back-end/tests/test_email_templates_api.py
new file mode 100644
index 0000000..62eab28
--- /dev/null
+++ b/user-service/back-end/tests/test_email_templates_api.py
@@ -0,0 +1,37 @@
+from __future__ import annotations
+
+import pytest
+
+pytestmark = pytest.mark.asyncio
+
+
+async def _h(token):
+    return {"Authorization": f"Bearer {token}"}
+
+
+TPL = {"template_code": "USER_ACTIVATION", "template_name": "激活",
+       "subject": "欢迎", "content": "Hi {{name}}",
+       "variables": [{"name": "name", "description": "用户名", "required": True}]}
+
+
+async def test_template_crud(client, admin_token):
+    h = await _h(admin_token)
+    create = await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    assert create.status_code == 201, create.text
+    tid = create.json()["id"]
+    got = await client.get(f"/api/v1/email-templates/{tid}", headers=h)
+    assert got.status_code == 200 and got.json()["template_code"] == "USER_ACTIVATION"
+    lst = await client.get("/api/v1/email-templates", headers=h)
+    assert lst.status_code == 200 and lst.json()["total"] == 1
+    upd = await client.put(f"/api/v1/email-templates/{tid}",
+                           json={"template_name": "激活2"}, headers=h)
+    assert upd.status_code == 200 and upd.json()["template_name"] == "激活2"
+    dele = await client.delete(f"/api/v1/email-templates/{tid}", headers=h)
+    assert dele.status_code == 204
+
+
+async def test_template_code_conflict(client, admin_token):
+    h = await _h(admin_token)
+    await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    resp = await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    assert resp.status_code == 409
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_system_config_api.py b/user-service/back-end/tests/test_system_config_api.py
new file mode 100644
index 0000000..bfbe3b9
--- /dev/null
+++ b/user-service/back-end/tests/test_system_config_api.py
@@ -0,0 +1,64 @@
+from __future__ import annotations
+
+import pytest
+
+pytestmark = pytest.mark.asyncio
+
+
+async def _h(token):
+    return {"Authorization": f"Bearer {token}"}
+
+
+async def test_init_and_get_group_masks_secret(client, admin_token):
+    resp = await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    assert resp.status_code == 200, resp.text
+    grp = await client.get("/api/v1/config?group=MAIL", headers=await _h(admin_token))
+    assert grp.status_code == 200
+    body = grp.json()
+    assert body["group"] == "MAIL"
+    assert body["values"]["password"] == "***"
+
+
+async def test_get_groups(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.get("/api/v1/config/groups", headers=await _h(admin_token))
+    assert resp.status_code == 200
+    assert set(resp.json()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+
+
+async def test_put_value_validates(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.put("/api/v1/config/security.password_min_length",
+                            json={"value": "3"}, headers=await _h(admin_token))
+    assert resp.status_code == 400
+
+
+async def test_put_value_secret(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.put("/api/v1/config/mail.password",
+                            json={"value": "new-secret"}, headers=await _h(admin_token))
+    assert resp.status_code == 200, resp.text
+    # GET 单 key 掩码
+    g = await client.get("/api/v1/config/mail.password", headers=await _h(admin_token))
+    assert g.status_code == 200 and g.json()["value"] == "***"
+
+
+async def test_history(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    await client.put("/api/v1/config/system.site_name",
+                     json={"value": "NewName"}, headers=await _h(admin_token))
+    resp = await client.get("/api/v1/config/history?key=system.site_name",
+                            headers=await _h(admin_token))
+    assert resp.status_code == 200
+    assert len(resp.json()) >= 1
+
+
+async def test_regular_user_forbidden(client):
+    reg = await client.post("/api/v1/auth/register", json={
+        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
+    assert reg.status_code == 201
+    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
+    token = login.json()["access_token"]
+    resp = await client.put("/api/v1/config/system.site_name",
+                            json={"value": "x"}, headers=await _h(token))
+    assert resp.status_code == 403
\ No newline at end of file
