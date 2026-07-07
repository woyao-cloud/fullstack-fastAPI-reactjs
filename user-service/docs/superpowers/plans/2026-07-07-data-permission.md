# 数据权限模块(阶段4)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 FastAPI 后端为 User 查询(list/get)接入数据权限过滤:角色级 data_scope(ALL/DEPT/SELF;CUSTOM 回退 SELF),最高权限胜出,DEPT 复用部门子树,SELF 用新增的 `User.created_by`。

**Architecture:** `DataPermissionFilter` 纯函数式服务,输入 `select(User)` stmt + `current_user` → 叠加 where 返回。有效范围从已加载角色算(无新缓存);DEPT 子树经新 `DepartmentRepository.get_sub_department_ids`。`UserService.list/get` 接 `current_user`(None 时不过滤,向后兼容);API 注入 `get_current_user`。被过滤 get 返 404 不泄露存在性。

**Tech Stack:** FastAPI / SQLAlchemy 2.x async / aiosqlite(测试)/ pytest + pytest-asyncio + httpx。

## Global Constraints

- Python ≥ 3.12;依赖经 `uv` 管理;测试 `uv run pytest` 从 `back-end`;SQLite 文件 DB。
- 跨库主键 `sqlalchemy.Uuid`;写操作 flush+commit(沿用现有模式,非 `async with begin()`)。
- `current_user=None` 时不过滤(向后兼容);被过滤 get → `NotFoundError`(404,不泄露)。
- 数据权限与权限码正交:权限码决定能否调用,data_scope 决定看到哪些数据。
- 有效范围最高权限胜出:ALL > DEPT > SELF;纯 CUSTOM/无角色 → SELF。
- 命名沿用现有:`DataPermissionFilter`、`UserService`、`UserRepository`。
- 提交粒度:每 Task 一次 commit;TDD(失败测试→实现→通过→提交)。
- 工作目录 `D:\claude-code-project\fullstack-fastAPI-reactjs\user-service\back-end`;PowerShell(Bash 工具不可靠)。
- ruff 配置已含 `ignore=["B008"]`。

**设计文档:** `docs/superpowers/specs/2026-07-07-data-permission-design.md`

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `app/domain/models/user.py` | User 加 `created_by` | Modify |
| `app/repositories/user_repository.py` | 加 `list_from_stmt(stmt, page, size)` | Modify |
| `app/repositories/department_repository.py` | 加 `get_sub_department_ids(dept_id)` | Modify |
| `app/application/services/data_permission_filter.py` | DataPermissionFilter | Create |
| `app/application/services/user_service.py` | list/get 接 current_user;create 接 actor | Modify |
| `app/interfaces/api/users.py` | 注入 current_user;get_user 本人直查 | Modify |
| `tests/conftest.py` | seed 加 data_scope 角色种子 | Modify |
| `tests/test_data_permission.py` | filter + 有效范围单测 | Create |
| `tests/test_users_api.py` | API 过滤用例扩展 | Modify |

---

## Task 1: User.created_by 字段 + UserService.create 接 actor

**Files:**
- Modify: `app/domain/models/user.py`
- Modify: `app/application/services/user_service.py`(`create` 接 `actor`)
- Modify: `app/interfaces/api/users.py`(`create_user` 传 `actor=current_user`)
- Modify: `app/interfaces/api/auth.py`(`register` 走 `AuthService.register`,created_by=None——确认无需改)
- Test: `tests/test_data_permission.py`(本任务只放 `test_create_sets_created_by`)

**Interfaces:**
- Produces: `User.created_by: Mapped[uuid.UUID | None]`(FK user_account, nullable, indexed);`UserService.create(req, actor: User | None = None)` 设 `created_by=actor.id if actor else None`。

- [ ] **Step 1: 写失败测试**

```python
# tests/test_data_permission.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.schemas.user import UserCreate
from app.application.services.user_service import UserService
from app.domain.models.user import User

pytestmark = pytest.mark.asyncio


async def test_create_sets_created_by(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        # 先建一个 actor 用户(系统建,created_by=None)
        actor = await UserService(db).create(
            UserCreate(email="actor@test.com", password="Actor@1234",
                       first_name="Actor", last_name="L"), actor=None)
        await db.commit()
        # 以 actor 身份建另一用户
        created = await UserService(db).create(
            UserCreate(email="child@test.com", password="Child@1234",
                       first_name="Child", last_name="L"), actor=actor)
        await db.commit()
        assert created.created_by == actor.id


async def test_create_without_actor_has_no_created_by(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        u = await UserService(db).create(
            UserCreate(email="noparent@test.com", password="NoP@1234",
                       first_name="No", last_name="P"), actor=None)
        await db.commit()
        assert u.created_by is None
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_data_permission.py -v`
Expected: FAIL(`User.created_by` 不存在)

- [ ] **Step 3: 给 User 加 created_by**

在 `app/domain/models/user.py` 的 `User` 类中(`last_login_at` 字段后、`roles` relationship 前)追加:
```python
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUIDType, ForeignKey("user_account.id"), nullable=True, index=True
    )
```
(`ForeignKey` 已在文件顶部 import;`UUIDType` 已定义。)

- [ ] **Step 4: UserService.create 接 actor**

在 `app/application/services/user_service.py` 修改 `create`:
```python
    async def create(self, req: UserCreate, actor: User | None = None) -> User:
        if await self.users.get_by_email(req.email) is not None:
            raise ConflictError("邮箱已注册")
        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            first_name=req.first_name,
            last_name=req.last_name,
            phone=req.phone,
            department_id=req.department_id,
            status=UserStatus.ACTIVE,
            created_by=actor.id if actor is not None else None,
        )
        await self.users.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
```
顶部 import 已有 `from app.domain.models.user import User`;确认 `User` 可作类型注解(已有 `from __future__ import annotations`)。

- [ ] **Step 5: create_user 路由传 actor**

在 `app/interfaces/api/users.py` 的 `create_user` 改为注入 `current_user` 并传入:
```python
@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("user:create")),
) -> UserOut:
    return UserOut.model_validate(await UserService(db).create(req, actor=current_user))
```
(`get_current_user`/`User` 已在文件顶部 import;`require_permission` 已 import。)

- [ ] **Step 6: 运行测试确认通过**

Run: `uv run pytest tests/test_data_permission.py -v`
Expected: PASS(2 passed);全量 `uv run pytest` 无回归。

- [ ] **Step 7: 提交**

```bash
git add app/domain/models/user.py app/application/services/user_service.py app/interfaces/api/users.py tests/test_data_permission.py
git commit -m "feat(dataperm): User.created_by 字段 + create 接 actor"
```

---

## Task 2: DepartmentRepository.get_sub_department_ids + DataPermissionFilter

**Files:**
- Modify: `app/repositories/department_repository.py`(加 `get_sub_department_ids`)
- Create: `app/application/services/data_permission_filter.py`
- Test: `tests/test_data_permission.py`(追加有效范围 + filter 单测)

**Interfaces:**
- Consumes: `DepartmentRepository.get_by_id`、`User.with_roles()`、`DataScope`、`User.department_id`/`User.created_by`/`User.id`、`Department.path`。
- Produces:
  - `DepartmentRepository.get_sub_department_ids(dept_id: uuid.UUID) -> list[uuid.UUID]`(子部门 id,不含自身)
  - `DataPermissionFilter(db, dept_repo)`:`async apply(stmt, current_user) -> select`、`staticmethod _effective_scope(user) -> DataScope`、`async _accessible_dept_ids(user) -> list[uuid.UUID]`(含自身)

- [ ] **Step 1: 写失败测试(追加到 tests/test_data_permission.py)**

```python
# tests/test_data_permission.py —— 末尾追加
from sqlalchemy import select

from app.application.services.data_permission_filter import DataPermissionFilter
from app.domain.models.department import Department
from app.domain.models.enums import DataScope
from app.domain.models.role import Role
from app.repositories.department_repository import DepartmentRepository


async def _make_user(db, email, roles=(), department_id=None, created_by=None):
    from app.core.security import hash_password
    from app.domain.models.user import User
    u = User(email=email, password_hash=hash_password("X@1234567"),
             first_name="U", last_name="L", department_id=department_id, created_by=created_by)
    for r in roles:
        u.roles.append(r)
    db.add(u)
    await db.flush()
    return u


async def test_effective_scope_all_wins(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        all_role = Role(name="ALL", code="D_ALL", data_scope=DataScope.ALL)
        self_role = Role(name="SELF", code="D_SELF", data_scope=DataScope.SELF)
        db.add_all([all_role, self_role])
        await db.flush()
        u = await _make_user(db, "a@t.com", roles=[all_role, self_role])
        await db.commit()
        assert DataPermissionFilter._effective_scope(u) is DataScope.ALL


async def test_effective_scope_dept_over_self(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        d_role = Role(name="DEPT", code="D_DEPT", data_scope=DataScope.DEPT)
        s_role = Role(name="SELF2", code="D_SELF2", data_scope=DataScope.SELF)
        db.add_all([d_role, s_role]); await db.flush()
        u = await _make_user(db, "b@t.com", roles=[d_role, s_role]); await db.commit()
        assert DataPermissionFilter._effective_scope(u) is DataScope.DEPT


async def test_effective_scope_custom_falls_back_self(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        c_role = Role(name="CUST", code="D_CUST", data_scope=DataScope.CUSTOM)
        db.add(c_role); await db.flush()
        u = await _make_user(db, "c@t.com", roles=[c_role]); await db.commit()
        assert DataPermissionFilter._effective_scope(u) is DataScope.SELF


async def test_effective_scope_no_roles_self(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        u = await _make_user(db, "d@t.com"); await db.commit()
        assert DataPermissionFilter._effective_scope(u) is DataScope.SELF


async def test_filter_all_no_where(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        all_role = Role(name="ALLB", code="D_ALLB", data_scope=DataScope.ALL)
        db.add(all_role); await db.flush()
        u = await _make_user(db, "e@t.com", roles=[all_role]); await db.commit()
        f = DataPermissionFilter(db, DepartmentRepository(db))
        stmt = select(User)
        out = await f.apply(stmt, u)
        # ALL 不过滤:返回的 stmt 仍是 select(User) 无 where
        assert out.whereclause is None


async def test_filter_self_only_created(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        s_role = Role(name="SELFB", code="D_SELFB", data_scope=DataScope.SELF)
        db.add(s_role); await db.flush()
        me = await _make_user(db, "me@t.com", roles=[s_role]); await db.commit()
        # 另建两个用户,一个 created_by=me,一个 created_by=None
        other_mine = await _make_user(db, "mine@t.com", created_by=me.id); await db.commit()
        other_not = await _make_user(db, "notmine@t.com", created_by=None); await db.commit()
        f = DataPermissionFilter(db, DepartmentRepository(db))
        result = await db.execute(await f.apply(select(User), me))
        ids = {u.id for u in result.scalars().all()}
        assert other_mine.id in ids
        assert other_not.id not in ids


async def test_filter_dept_subtree(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        # 建部门树:HQ(/1) -> RD(/1/2)
        from app.domain.models.department import Department
        hq = Department(node_seq=1, name="HQ", code="HQ", level=1, path="/1")
        rd = Department(node_seq=2, name="RD", code="RDB", level=2, path="/1/2", parent_id=uuid.uuid4())
        db.add_all([hq, rd]); await db.flush()
        d_role = Role(name="DEPTB", code="D_DEPTB", data_scope=DataScope.DEPT)
        db.add(d_role); await db.flush()
        me = await _make_user(db, "deptme@t.com", roles=[d_role], department_id=hq.id)
        in_dept = await _make_user(db, "indept@t.com", department_id=rd.id)  # 子部门
        out_dept = await _make_user(db, "outdept@t.com")  # 无部门
        await db.commit()
        f = DataPermissionFilter(db, DepartmentRepository(db))
        result = await db.execute(await f.apply(select(User), me))
        ids = {u.id for u in result.scalars().all()}
        assert in_dept.id in ids and me.id in ids  # 本部门 + 子部门
        assert out_dept.id not in ids


async def test_filter_dept_no_department_empty(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        d_role = Role(name="DEPTC", code="D_DEPTC", data_scope=DataScope.DEPT)
        db.add(d_role); await db.flush()
        me = await _make_user(db, "nodept@t.com", roles=[d_role])  # 无 department_id
        await db.commit()
        f = DataPermissionFilter(db, DepartmentRepository(db))
        result = await db.execute(await f.apply(select(User), me))
        assert result.scalars().all() == []  # 空集
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_data_permission.py -v`
Expected: 新用例 FAIL(`DataPermissionFilter` 不存在 + `get_sub_department_ids` 不存在)

- [ ] **Step 3: DepartmentRepository 加 get_sub_department_ids**

在 `app/repositories/department_repository.py` 的 `DepartmentRepository` 类中追加(在 `find_subtree` 后):
```python
    async def get_sub_department_ids(self, dept_id: uuid.UUID) -> list[uuid.UUID]:
        """返回 dept_id 的子部门 id 列表(不含自身)。"""
        dept = await self.db.get(Department, dept_id)
        if dept is None:
            return []
        result = await self.db.execute(
            select(Department.id).where(Department.path.like(f"{dept.path}/%"))
        )
        return list(result.scalars().all())
```
确认顶部已 `from sqlalchemy import select`(查看现有 import;若缺则补)。

- [ ] **Step 4: 实现 DataPermissionFilter**

```python
# app/application/services/data_permission_filter.py
"""数据权限过滤:按用户有效 data_scope 叠加 where."""

from __future__ import annotations

import uuid

from sqlalchemy import false, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.enums import DataScope
from app.domain.models.user import User
from app.repositories.department_repository import DepartmentRepository


class DataPermissionFilter:
    def __init__(self, db: AsyncSession, dept_repo: DepartmentRepository):
        self.db = db
        self.dept_repo = dept_repo

    @staticmethod
    def _effective_scope(user: User) -> DataScope:
        scopes = {r.data_scope for r in user.roles}
        if DataScope.ALL in scopes:
            return DataScope.ALL
        if DataScope.DEPT in scopes:
            return DataScope.DEPT
        if DataScope.SELF in scopes:
            return DataScope.SELF
        return DataScope.SELF  # CUSTOM / 无角色 → SELF 回退

    async def _accessible_dept_ids(self, user: User) -> list[uuid.UUID]:
        if user.department_id is None:
            return []
        ids = await self.dept_repo.get_sub_department_ids(user.department_id)
        ids.append(user.department_id)
        return ids

    async def apply(self, stmt, current_user: User):
        scope = self._effective_scope(current_user)
        if scope is DataScope.ALL:
            return stmt
        if scope is DataScope.SELF:
            return stmt.where(User.created_by == current_user.id)
        if scope is DataScope.DEPT:
            dept_ids = await self._accessible_dept_ids(current_user)
            if not dept_ids:
                return stmt.where(false())
            return stmt.where(User.department_id.in_(dept_ids))
        return stmt.where(User.created_by == current_user.id)  # CUSTOM 回退 SELF
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_data_permission.py -v`
Expected: PASS(8 passed);全量无回归。

- [ ] **Step 6: 提交**

```bash
git add app/repositories/department_repository.py app/application/services/data_permission_filter.py tests/test_data_permission.py
git commit -m "feat(dataperm): DataPermissionFilter + get_sub_department_ids"
```

---

## Task 3: UserService.list/get 集成 current_user + 过滤分页

**Files:**
- Modify: `app/repositories/user_repository.py`(加 `list_from_stmt`)
- Modify: `app/application/services/user_service.py`(`list`/`get` 接 `current_user`)
- Test: `tests/test_data_permission.py`(追加 service 集成测试)

**Interfaces:**
- Produces:
  - `UserRepository.list_from_stmt(stmt, page, size) -> tuple[Sequence[User], int]`(基于已过滤 stmt 做 count + 分页)
  - `UserService.list(page, size, current_user=None) -> tuple[Sequence[User], int]`
  - `UserService.get(user_id, current_user=None) -> User`(被过滤 → NotFoundError)

- [ ] **Step 1: 写失败测试(追加)**

```python
# tests/test_data_permission.py —— 末尾追加
from app.application.services.user_service import UserService
from app.core.exceptions import NotFoundError


async def test_service_list_filtered_self(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        s_role = Role(name="SELC", code="D_SELC", data_scope=DataScope.SELF)
        db.add(s_role); await db.flush()
        me = await _make_user(db, "me2@t.com", roles=[s_role])
        mine = await _make_user(db, "mine2@t.com", created_by=me.id)
        other = await _make_user(db, "other2@t.com")
        await db.commit()
        svc = UserService(db)
        items, total = await svc.list(1, 20, current_user=me)
        ids = {u.id for u in items}
        assert mine.id in ids and other.id not in ids
        assert total == 1


async def test_service_list_no_current_user_no_filter(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        a = await _make_user(db, "x@t.com"); b = await _make_user(db, "y@t.com"); await db.commit()
        svc = UserService(db)
        items, total = await svc.list(1, 20, current_user=None)
        assert total >= 2


async def test_service_get_filtered_returns_404(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        s_role = Role(name="SELD", code="D_SELD", data_scope=DataScope.SELF)
        db.add(s_role); await db.flush()
        me = await _make_user(db, "me3@t.com", roles=[s_role])
        other = await _make_user(db, "other3@t.com")  # 非 me 创建
        await db.commit()
        svc = UserService(db)
        # me 无权看 other(SELF)→ 404
        with pytest.raises(NotFoundError):
            await svc.get(other.id, current_user=me)


async def test_service_get_self_can_see_own(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        a = await _make_user(db, "own@t.com"); await db.commit()
        svc = UserService(db)
        # 无 current_user(向后兼容)能查
        got = await svc.get(a.id, current_user=None)
        assert got.id == a.id
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_data_permission.py -v`
Expected: 新用例 FAIL(`list` 不接 `current_user`)

- [ ] **Step 3: UserRepository 加 list_from_stmt**

在 `app/repositories/user_repository.py` 的 `UserRepository` 类追加(在 `list` 后):
```python
    async def list_from_stmt(self, stmt, page: int = 1, size: int = 20) -> tuple[Sequence[User], int]:
        from sqlalchemy import func

        offset = (page - 1) * size
        total_result = await self.db.execute(select(func.count()).select_from(stmt.subquery()))
        total = total_result.scalar_one()
        result = await self.db.execute(stmt.offset(offset).limit(size))
        return result.unique().scalars().all(), total
```
(顶部已 `from sqlalchemy import func, select`;确认;若 `func` 未 import 则补。)

- [ ] **Step 4: UserService.list/get 接 current_user**

修改 `app/application/services/user_service.py`:
```python
from app.application.services.data_permission_filter import DataPermissionFilter
from app.repositories.department_repository import DepartmentRepository
```
(`__init__` 末尾追加 `self.filter = DataPermissionFilter(db, DepartmentRepository(db))`)

```python
    async def list(self, page: int = 1, size: int = 20, current_user: User | None = None) -> tuple[Sequence[User], int]:
        stmt = User.with_roles()
        if current_user is not None:
            stmt = await self.filter.apply(stmt, current_user)
        return await self.users.list_from_stmt(stmt, page, size)

    async def get(self, user_id: uuid.UUID, current_user: User | None = None) -> User:
        stmt = User.with_roles().where(User.id == user_id)
        if current_user is not None:
            stmt = await self.filter.apply(stmt, current_user)
        result = await self.db.execute(stmt)
        user = result.unique().scalar_one_or_none()
        if user is None:
            raise NotFoundError("用户不存在")
        return user
```
(保留原 `create`/`update`/`delete`/`assign_role` 不变。`User`、`NotFoundError` 已 import。)

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_data_permission.py -v`
Expected: PASS(12 passed);全量无回归。

- [ ] **Step 6: 提交**

```bash
git add app/repositories/user_repository.py app/application/services/user_service.py tests/test_data_permission.py
git commit -m "feat(dataperm): UserService.list/get 集成 current_user 过滤"
```

---

## Task 4: API 注入 current_user + get_user 本人直查

**Files:**
- Modify: `app/interfaces/api/users.py`(`list_users`、`get_user` 注入 current_user)
- Test: `tests/test_users_api.py`(追加 API 过滤用例)

**Interfaces:**
- Produces:`list_users`/`get_user` 路由注入 `current_user: User = Depends(get_current_user)` 并传入 service;`get_user` 本人(`current_user.id == user_id`)直接返,否则走 service.get(user_id, current_user) 过滤。

- [ ] **Step 1: 写失败测试(追加到 tests/test_users_api.py)**

```python
# tests/test_users_api.py —— 末尾追加


async def test_admin_all_sees_all_users(client, admin_token):
    # admin(ALL)能看到所有用户
    h = await _auth_header(admin_token)
    create = await client.post("/api/v1/users", json={
        "email": "selfuser@test.com", "password": "Self@1234",
        "first_name": "Self", "last_name": "L"}, headers=h)
    assert create.status_code == 201
    lst = await client.get("/api/v1/users", headers=h)
    assert lst.status_code == 200
    emails = {u["email"] for u in lst.json()["items"]}
    assert "selfuser@test.com" in emails


async def test_get_other_as_regular_404(client):
    # 普通用户(SELF,注册即 USER 角色 data_scope=SELF)查不属于自己的用户 → 404
    reg = await client.post("/api/v1/auth/register", json={
        "email": "reg@t.com", "password": "Reg@1234",
        "first_name": "R", "last_name": "L"})
    assert reg.status_code == 201
    other = await client.post("/api/v1/auth/register", json={
        "email": "other@t.com", "password": "Other@1234",
        "first_name": "O", "last_name": "L"})
    assert other.status_code == 201
    login = await client.post("/api/v1/auth/login",
                              json={"email": "reg@t.com", "password": "Reg@1234"})
    token = login.json()["access_token"]
    resp = await client.get(f"/api/v1/users/{other.json()['id']}",
                           headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


async def test_self_can_see_own_via_api(client):
    reg = await client.post("/api/v1/auth/register", json={
        "email": "own@t.com", "password": "Own@1234",
        "first_name": "O", "last_name": "L"})
    assert reg.status_code == 201
    uid = reg.json()["id"]
    login = await client.post("/api/v1/auth/login",
                              json={"email": "own@t.com", "password": "Own@1234"})
    token = login.json()["access_token"]
    resp = await client.get(f"/api/v1/users/{uid}",
                           headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200  # 本人直查
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_users_api.py -v`
Expected: 新用例可能 PASS(现有 get_user 本人直查已支持)或 FAIL(list_users 尚未过滤普通用户)。

- [ ] **Step 3: 修改 users 路由注入 current_user**

在 `app/interfaces/api/users.py` 修改 `list_users` 和 `get_user`。用 `get_current_user` 取一次用户,内联检查 `user:read` 权限码(避免 `require_permission` + `get_current_user` 重复取用户),再走 data_scope 过滤。顶部 import 确认含 `get_current_user`(若仅 `require_permission` 则补 `from app.core.security import get_current_user`)。

```python
@router.get("", response_model=UserListOut)
async def list_users(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserListOut:
    codes = await current_user.permission_codes()
    if "user:read" not in codes:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
    service = UserService(db)
    items, total = await service.list(page, size, current_user=current_user)
    return UserListOut(
        items=[UserOut.model_validate(u) for u in items], total=total, page=page, size=size
    )


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserOut:
    if current_user.id == user_id:
        return UserOut.model_validate(current_user)
    codes = await current_user.permission_codes()
    if "user:read" not in codes:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
    service = UserService(db)
    return UserOut.model_validate(await service.get(user_id, current_user=current_user))
```
(`HTTPException`/`status` 需在文件顶部 import:确认 `from fastapi import HTTPException, status` 存在;若缺则补。)`create_user` 已在 Task 1 改为 `actor=current_user`;其他路由不变。

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_users_api.py -v`
Expected: PASS(含新用例);全量无回归。

- [ ] **Step 5: 提交**

```bash
git add app/interfaces/api/users.py tests/test_users_api.py
git commit -m "feat(dataperm): API 注入 current_user + 本人直查 + 权限码内联检查"
```

---

## Task 5: 全量回归 + 覆盖率 + ruff

**Files:** 无新增(验证性任务)

- [ ] **Step 1: 全量测试 + 覆盖率**

Run: `uv run pytest --cov=app --cov-report=term-missing`
Expected: 全部 PASS;`app.application.services.data_permission_filter` ≥90%;TOTAL ≥85%。

- [ ] **Step 2: ruff**

Run: `uv run ruff check app tests`
Expected: 0 errors。

- [ ] **Step 3: 修复失败后再次运行至全绿**

- [ ] **Step 4: 提交(如有修复)**

```bash
git add -A
git commit -m "test(dataperm): 全量回归通过,覆盖率≥85%,ruff 清零"
```

---

## Self-Review 结论

**Spec coverage**:
- §3 模块边界 → Task 1-4 文件结构 ✓
- §4 数据模型(created_by)→ Task 1 ✓
- §5 DataPermissionFilter + 有效范围 → Task 2 ✓
- §6 UserService/API 集成 → Task 3、4 ✓
- §7 错误处理(404 不泄露、空集 false())→ Task 2/3 测试 ✓
- §8 测试矩阵 → Task 1/2/3/4 测试覆盖各用例 ✓

**Placeholder scan**:无 TBD/TODO;每步含完整代码与命令。Task 4 Step 1 的笔误已标注并用正确版本替代。

**Type一致性**:`DataPermissionFilter(db, dept_repo).apply(stmt, current_user)` 跨 Task 2/3 一致;`UserService.list/get(current_user=None)` 跨 Task 3/4 一致;`UserRepository.list_from_stmt(stmt, page, size)` 跨 Task 3 一致;`DepartmentRepository.get_sub_department_ids(dept_id)` 跨 Task 2 一致;`_effective_scope` staticmethod 跨 Task 2 一致。