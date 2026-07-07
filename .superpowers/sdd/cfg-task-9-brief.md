## Task 9: API 路由(配置 + 模板)+ main 注册 + seed 扩展 + conftest cache override

**Files:**
- Create: `app/interfaces/api/system_config.py`
- Create: `app/interfaces/api/email_templates.py`
- Modify: `app/main.py`(import + include_router)
- Modify: `tests/conftest.py`(seed 扩展 config/template 权限 + cache override)
- Test: `tests/test_system_config_api.py`、`tests/test_email_templates_api.py`

**Interfaces:**
- Consumes: `ConfigService`、`EmailTemplateService`、`get_config_cache`、`get_db`、`require_permission`、schemas。
- Produces:配置路由(`/config/groups`、`/config`、`/config/{key}`、`/config/{key}` PUT、`/config/init`、`/config/history`)与模板路由(`/email-templates` CRUD)。API 层掩码 SECRET 为 `"***"`。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_system_config_api.py
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def test_init_and_get_group_masks_secret(client, admin_token):
    resp = await client.post("/api/v1/config/init", headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    grp = await client.get("/api/v1/config?group=MAIL", headers=await _h(admin_token))
    assert grp.status_code == 200
    body = grp.json()
    assert body["group"] == "MAIL"
    assert body["values"]["password"] == "***"


async def test_get_groups(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    resp = await client.get("/api/v1/config/groups", headers=await _h(admin_token))
    assert resp.status_code == 200
    assert set(resp.json()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}


async def test_put_value_validates(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    resp = await client.put("/api/v1/config/security.password_min_length",
                            json={"value": "3"}, headers=await _h(admin_token))
    assert resp.status_code == 400


async def test_put_value_secret(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    resp = await client.put("/api/v1/config/mail.password",
                            json={"value": "new-secret"}, headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    # GET 单 key 掩码
    g = await client.get("/api/v1/config/mail.password", headers=await _h(admin_token))
    assert g.status_code == 200 and g.json()["value"] == "***"


async def test_history(client, admin_token):
    await client.post("/api/v1/config/init", headers=await _h(admin_token))
    await client.put("/api/v1/config/system.site_name",
                     json={"value": "NewName"}, headers=await _h(admin_token))
    resp = await client.get("/api/v1/config/history?key=system.site_name",
                            headers=await _h(admin_token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_regular_user_forbidden(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
    assert reg.status_code == 201
    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
    token = login.json()["access_token"]
    resp = await client.put("/api/v1/config/system.site_name",
                            json={"value": "x"}, headers=await _h(token))
    assert resp.status_code == 403
```

```python
# tests/test_email_templates_api.py
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio


async def _h(token):
    return {"Authorization": f"Bearer {token}"}


TPL = {"template_code": "USER_ACTIVATION", "template_name": "激活",
       "subject": "欢迎", "content": "Hi {{name}}",
       "variables": [{"name": "name", "description": "用户名", "required": True}]}


async def test_template_crud(client, admin_token):
    h = await _h(admin_token)
    create = await client.post("/api/v1/email-templates", json=TPL, headers=h)
    assert create.status_code == 201, create.text
    tid = create.json()["id"]
    got = await client.get(f"/api/v1/email-templates/{tid}", headers=h)
    assert got.status_code == 200 and got.json()["template_code"] == "USER_ACTIVATION"
    lst = await client.get("/api/v1/email-templates", headers=h)
    assert lst.status_code == 200 and lst.json()["total"] == 1
    upd = await client.put(f"/api/v1/email-templates/{tid}",
                           json={"template_name": "激活2"}, headers=h)
    assert upd.status_code == 200 and upd.json()["template_name"] == "激活2"
    dele = await client.delete(f"/api/v1/email-templates/{tid}", headers=h)
    assert dele.status_code == 204


async def test_template_code_conflict(client, admin_token):
    h = await _h(admin_token)
    await client.post("/api/v1/email-templates", json=TPL, headers=h)
    resp = await client.post("/api/v1/email-templates", json=TPL, headers=h)
    assert resp.status_code == 409
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_system_config_api.py tests/test_email_templates_api.py -v`
Expected: FAIL(路由不存在)

- [ ] **Step 3: 扩展 conftest seed + cache override**

在 `tests/conftest.py` 的 `seed` fixture `perms` 列表追加:
```python
        Permission(name="配置读取", code="config:read", type="ACTION", resource="config", action="read"),
        Permission(name="配置更新", code="config:update", type="ACTION", resource="config", action="update"),
        Permission(name="模板读取", code="template:read", type="ACTION", resource="template", action="read"),
        Permission(name="模板创建", code="template:create", type="ACTION", resource="template", action="create"),
        Permission(name="模板更新", code="template:update", type="ACTION", resource="template", action="update"),
        Permission(name="模板删除", code="template:delete", type="ACTION", resource="template", action="delete"),
```
在 `client` fixture 的 `dependency_overrides` 块追加:
```python
    from app.core.config_cache import LocalTTLCache, get_config_cache
    app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()
```

- [ ] **Step 4: 实现配置路由**

```python
# app/interfaces/api/system_config.py
"""系统配置路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.core.config_cache import ConfigCache, get_config_cache
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.system_config_repository import (
    ConfigHistoryRepository, SystemConfigRepository,
)
from app.application.services.config_service import ConfigService
from app.core import crypto

router = APIRouter(prefix="/config", tags=["config"])


def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)


class ConfigValueUpdate(BaseModel):
    value: str | int | bool | dict


def _mask(values: dict, group: str) -> dict:
    from app.application.schemas.system_config import GROUP_MODELS
    model = GROUP_MODELS[group]
    masked = {}
    for k, v in values.items():
        fi = model.model_fields.get(k)
        if fi is not None and "SecretStr" in str(fi.annotation):
            masked[k] = "***"
        else:
            masked[k] = v
    return masked


@router.get("/groups")
async def list_groups(
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> list[str]:
    return _svc(db, cache).list_groups()


@router.get("")
async def get_group(
    group: str = Query(...),
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> dict:
    svc = _svc(db, cache)
    values = await svc.get_group(group)
    return {"group": group, "values": _mask(values, group)}


@router.get("/{key}")
async def get_value(
    key: str,
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> dict:
    svc = _svc(db, cache)
    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
    group = group_of_key(key)
    values = await svc.get_group(group)
    field = key.split(".", 1)[1]
    val = values.get(field)
    fi = GROUP_MODELS[group].model_fields.get(field)
    if fi is not None and "SecretStr" in str(fi.annotation):
        val = "***"
    return {"key": key, "group": group, "value": val}


@router.put("/{key}")
async def put_value(
    key: str,
    req: ConfigValueUpdate,
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:update")),
) -> dict:
    svc = _svc(db, cache)
    await svc.set_value(key, req.value, user.id)
    return {"key": key, "ok": True}


@router.post("/init")
async def init_configs(
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:update")),
) -> dict:
    svc = _svc(db, cache)
    await svc.init_default_configs(user.id)
    return {"ok": True}


@router.get("/history")
async def history(
    key: str = Query(...),
    db: AsyncSession = Depends(get_db),
    cache: ConfigCache = Depends(get_config_cache),
    user: User = Depends(require_permission("config:read")),
) -> list[dict]:
    repo = ConfigHistoryRepository(db)
    rows = await repo.list_by_key(key)
    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
    group = group_of_key(key)
    field = key.split(".", 1)[1]
    fi = GROUP_MODELS[group].model_fields.get(field)
    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
    out = []
    for r in rows:
        out.append({
            "key": r.config_key,
            "old_value": "***" if is_secret else r.old_value,
            "new_value": "***" if is_secret else r.new_value,
            "changed_by": str(r.changed_by),
            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
        })
    return out
```

- [ ] **Step 5: 实现模板路由**

```python
# app/interfaces/api/email_templates.py
"""邮件模板路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.system_config import (
    EmailTemplateCreate, EmailTemplateListOut, EmailTemplateOut, EmailTemplateUpdate,
)
from app.application.services.email_template_service import EmailTemplateService
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.system_config_repository import EmailTemplateRepository

router = APIRouter(prefix="/email-templates", tags=["email-templates"])


def _svc(db: AsyncSession) -> EmailTemplateService:
    return EmailTemplateService(db, EmailTemplateRepository(db))


@router.get("", response_model=EmailTemplateListOut)
async def list_templates(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:read")),
) -> EmailTemplateListOut:
    items, total = await _svc(db).list(page, size)
    return EmailTemplateListOut(
        items=[EmailTemplateOut.model_validate(i) for i in items],
        total=total, page=page, size=size)


@router.get("/{tpl_id}", response_model=EmailTemplateOut)
async def get_template(
    tpl_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:read")),
) -> EmailTemplateOut:
    return EmailTemplateOut.model_validate(await _svc(db).get(tpl_id))


@router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    req: EmailTemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:create")),
) -> EmailTemplateOut:
    return EmailTemplateOut.model_validate(await _svc(db).create(req))


@router.put("/{tpl_id}", response_model=EmailTemplateOut)
async def update_template(
    tpl_id: uuid.UUID, req: EmailTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:update")),
) -> EmailTemplateOut:
    return EmailTemplateOut.model_validate(await _svc(db).update(tpl_id, req))


@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    tpl_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("template:delete")),
) -> None:
    await _svc(db).delete(tpl_id)
```

- [ ] **Step 6: main.py 注册**

在 `from app.interfaces.api import ...` 行追加 `system_config, email_templates`;在 `include_router` 块追加:
```python
    app.include_router(system_config.router, prefix=settings.API_V1_PREFIX)
    app.include_router(email_templates.router, prefix=settings.API_V1_PREFIX)
```

- [ ] **Step 7: 运行测试确认通过**

Run: `uv run pytest tests/test_system_config_api.py tests/test_email_templates_api.py -v`
Expected: PASS(8 passed);全量无回归。

- [ ] **Step 8: 提交**

```bash
git add app/interfaces/api/system_config.py app/interfaces/api/email_templates.py app/main.py tests/conftest.py tests/test_system_config_api.py tests/test_email_templates_api.py
git commit -m "feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展"
```

---

