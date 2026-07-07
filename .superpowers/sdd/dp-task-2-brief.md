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

