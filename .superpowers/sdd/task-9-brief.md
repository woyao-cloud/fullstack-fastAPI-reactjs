## Task 9: API 路由 + main 注册 + seed 扩展

**Files:**
- Create: `app/interfaces/api/departments.py`
- Modify: `app/main.py`(注册路由)
- Modify: `tests/conftest.py`(seed 加 dept:* 权限 + cache override)
- Test: `tests/test_departments_api.py`

**Interfaces:**
- Consumes: `DepartmentService`、`get_department_cache`、`get_db`、`require_permission`、schemas。
- Produces:路由前缀 `/api/v1/departments`,端点见 spec §7。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_departments_api.py
from __future__ import annotations

import pytest

pytestmark = pytest.mark.asyncio

DEPT = {"name": "总部", "code": "HQ"}


async def _h(token):
    return {"Authorization": f"Bearer {token}"}


async def test_create_and_get_tree(client, admin_token):
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    assert resp.status_code == 201, resp.text
    assert resp.json()["level"] == 1
    tree = await client.get("/api/v1/departments/tree", headers=await _h(admin_token))
    assert tree.status_code == 200
    assert tree.json()[0]["code"] == "HQ"


async def test_create_code_conflict(client, admin_token):
    await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))
    assert resp.status_code == 409


async def test_move_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    sl = (await client.post("/api/v1/departments", json={"name": "销售", "code": "SL"},
                            headers=await _h(admin_token))).json()
    rd = (await client.post("/api/v1/departments",
                            json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
                            headers=await _h(admin_token))).json()
    resp = await client.post(f"/api/v1/departments/{rd['id']}/move",
                             json={"parent_id": sl["id"]}, headers=await _h(admin_token))
    assert resp.status_code == 200, resp.text
    assert resp.json()["parent_id"] == sl["id"]


async def test_delete_with_children_409(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    await client.post("/api/v1/departments",
                      json={"name": "研发", "code": "RD", "parent_id": hq["id"]},
                      headers=await _h(admin_token))
    resp = await client.delete(f"/api/v1/departments/{hq['id']}", headers=await _h(admin_token))
    assert resp.status_code == 409


async def test_regular_user_forbidden(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
    assert reg.status_code == 201
    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
    token = login.json()["access_token"]
    resp = await client.post("/api/v1/departments", json=DEPT, headers=await _h(token))
    assert resp.status_code == 403


async def test_list_users_endpoint(client, admin_token):
    hq = (await client.post("/api/v1/departments", json=DEPT, headers=await _h(admin_token))).json()
    resp = await client.get(f"/api/v1/departments/{hq['id']}/users", headers=await _h(admin_token))
    assert resp.status_code == 200
    assert resp.json() == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_departments_api.py -v`
Expected: FAIL(`ModuleNotFoundError` 或 404)

- [ ] **Step 3: 扩展 conftest seed(dept 权限 + ADMIN 绑定 + cache override)**

```python
# tests/conftest.py —— 修改 seed fixture 的 perms 列表,在末尾追加 dept 权限
    perms = [
        Permission(name="用户读取", code="user:read", type="ACTION", resource="user", action="read"),
        Permission(name="用户创建", code="user:create", type="ACTION", resource="user", action="create"),
        Permission(name="用户更新", code="user:update", type="ACTION", resource="user", action="update"),
        Permission(name="用户删除", code="user:delete", type="ACTION", resource="user", action="delete"),
        Permission(name="用户分配角色", code="user:assign_role", type="ACTION", resource="user", action="assign_role"),
        Permission(name="部门读取", code="dept:read", type="ACTION", resource="dept", action="read"),
        Permission(name="部门创建", code="dept:create", type="ACTION", resource="dept", action="create"),
        Permission(name="部门更新", code="dept:update", type="ACTION", resource="dept", action="update"),
        Permission(name="部门删除", code="dept:delete", type="ACTION", resource="dept", action="delete"),
    ]
```

```python
# tests/conftest.py —— 在 client fixture 内 dependency_overrides 增加 cache override
    from app.core.cache import NoopDepartmentCache, get_department_cache
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
```
> 注:`get_department_cache` 是 async 依赖,覆盖用同步 lambda 返回 Noop 实例即可(FastAPI 接受同步依赖函数)。在 `app.dependency_overrides.clear()` 之前生效。

- [ ] **Step 4: 实现路由**

```python
# app/interfaces/api/departments.py
"""部门路由."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.deps import get_db
from app.application.schemas.department import (
    DepartmentCreate, DepartmentListOut, DepartmentMove, DepartmentOut,
    DepartmentTreeNode, DepartmentUpdate,
)
from app.application.services.department_service import DepartmentService
from app.core.cache import DepartmentCache, get_department_cache
from app.core.security import require_permission
from app.domain.models.user import User
from app.repositories.department_repository import DepartmentRepository

router = APIRouter(prefix="/departments", tags=["departments"])


def _svc(db: AsyncSession, cache: DepartmentCache) -> DepartmentService:
    return DepartmentService(db, DepartmentRepository(db), cache)


@router.get("/tree", response_model=list[DepartmentTreeNode])
async def get_tree(
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> list[DepartmentTreeNode]:
    return await _svc(db, cache).get_tree()


@router.get("/{dept_id}/subtree", response_model=list[DepartmentTreeNode])
async def get_subtree(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> list[DepartmentTreeNode]:
    return await _svc(db, cache).get_subtree(dept_id)


@router.get("", response_model=DepartmentListOut)
async def list_departments(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> DepartmentListOut:
    svc = _svc(db, cache)
    flat = await svc.repo.list_active()
    start = (page - 1) * size
    items = flat[start:start + size]
    return DepartmentListOut(
        items=[DepartmentOut.model_validate(d) for d in items],
        total=len(flat), page=page, size=size,
    )


@router.get("/{dept_id}", response_model=DepartmentOut)
async def get_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
) -> DepartmentOut:
    svc = _svc(db, cache)
    dept = await svc.repo.get_by_id(dept_id)
    if dept is None:
        from app.core.exceptions import NotFoundError
        raise NotFoundError("部门不存在")
    return DepartmentOut.model_validate(dept)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    req: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:create")),
) -> DepartmentOut:
    dept = await _svc(db, cache).create(req)
    return DepartmentOut.model_validate(dept)


@router.put("/{dept_id}", response_model=DepartmentOut)
async def update_department(
    dept_id: uuid.UUID,
    req: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:update")),
) -> DepartmentOut:
    return DepartmentOut.model_validate(await _svc(db, cache).update(dept_id, req))


@router.post("/{dept_id}/move", response_model=DepartmentOut)
async def move_department(
    dept_id: uuid.UUID,
    req: DepartmentMove,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:update")),
) -> DepartmentOut:
    return DepartmentOut.model_validate(await _svc(db, cache).move(dept_id, req.parent_id))


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:delete")),
) -> None:
    await _svc(db, cache).delete(dept_id)


@router.get("/{dept_id}/users", response_model=list)
async def list_dept_users(
    dept_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    cache: DepartmentCache = Depends(get_department_cache),
    _: User = Depends(require_permission("dept:read")),
):
    from app.application.schemas.user import UserOut
    return await _svc(db, cache).list_users(dept_id)
```

- [ ] **Step 5: main.py 注册路由**

```python
# app/main.py —— 在 from app.interfaces.api import auth, health, users 之后追加 departments
from app.interfaces.api import auth, departments, health, users

# 在 app.include_router(users.router, prefix=settings.API_V1_PREFIX) 之后追加
    app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
```

- [ ] **Step 6: 运行测试确认通过**

Run: `uv run pytest tests/test_departments_api.py -v`
Expected: PASS(6 passed)

- [ ] **Step 7: 提交**

```bash
git add app/interfaces/api/departments.py app/main.py tests/conftest.py tests/test_departments_api.py
git commit -m "feat(dept): 部门 API 路由 + main 注册 + seed dept 权限"
```

---

