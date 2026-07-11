# tests/test_data_permission.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.schemas.user import UserCreate
from app.application.services.data_permission_filter import DataPermissionFilter
from app.application.services.user_service import UserService
from app.core.exceptions import NotFoundError
from app.domain.models.enums import DataScope
from app.domain.models.role import Role
from app.domain.models.user import User
from app.repositories.department_repository import DepartmentRepository

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


async def _make_user(db, email, roles=(), department_id=None, created_by=None):
    from sqlalchemy.orm import selectinload

    from app.core.security import hash_password
    from app.domain.models.user import User
    u = User(email=email, password_hash=hash_password("X@1234567"),
             first_name="U", last_name="L", department_id=department_id, created_by=created_by)
    for r in roles:
        u.roles.append(r)
    db.add(u)
    await db.flush()
    # 重新加载以在 greenlet 上下文内初始化 roles 集合(避免 async lazy-load 失败)
    u = (await db.execute(
        select(User).options(selectinload(User.roles)).where(User.id == u.id)
    )).scalar_one()
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
        db.add_all([d_role, s_role])
        await db.flush()
        u = await _make_user(db, "b@t.com", roles=[d_role, s_role])
        await db.commit()
        assert DataPermissionFilter._effective_scope(u) is DataScope.DEPT


async def test_effective_scope_custom_falls_back_self(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        c_role = Role(name="CUST", code="D_CUST", data_scope=DataScope.CUSTOM)
        db.add(c_role)
        await db.flush()
        u = await _make_user(db, "c@t.com", roles=[c_role])
        await db.commit()
        assert DataPermissionFilter._effective_scope(u) is DataScope.SELF


async def test_effective_scope_no_roles_self(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        u = await _make_user(db, "d@t.com")
        await db.commit()
        assert DataPermissionFilter._effective_scope(u) is DataScope.SELF


async def test_filter_all_no_where(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        all_role = Role(name="ALLB", code="D_ALLB", data_scope=DataScope.ALL)
        db.add(all_role)
        await db.flush()
        u = await _make_user(db, "e@t.com", roles=[all_role])
        await db.commit()
        f = DataPermissionFilter(db, DepartmentRepository(db))
        stmt = select(User)
        out = await f.apply(stmt, u)
        # ALL 不过滤:返回的 stmt 仍是 select(User) 无 where
        assert out.whereclause is None


async def test_filter_self_only_created(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        s_role = Role(name="SELFB", code="D_SELFB", data_scope=DataScope.SELF)
        db.add(s_role)
        await db.flush()
        me = await _make_user(db, "me@t.com", roles=[s_role])
        await db.commit()
        # 另建两个用户,一个 created_by=me,一个 created_by=None
        other_mine = await _make_user(db, "mine@t.com", created_by=me.id)
        await db.commit()
        other_not = await _make_user(db, "notmine@t.com", created_by=None)
        await db.commit()
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
        rd = Department(
            node_seq=2, name="RD", code="RDB", level=2,
            path="/1/2", parent_id=uuid.uuid4(),
        )
        db.add_all([hq, rd])
        await db.flush()
        d_role = Role(name="DEPTB", code="D_DEPTB", data_scope=DataScope.DEPT)
        db.add(d_role)
        await db.flush()
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
        db.add(d_role)
        await db.flush()
        me = await _make_user(db, "nodept@t.com", roles=[d_role])  # 无 department_id
        await db.commit()
        f = DataPermissionFilter(db, DepartmentRepository(db))
        result = await db.execute(await f.apply(select(User), me))
        assert result.scalars().all() == []  # 空集


# --- Task 3: UserService.list/get 集成 current_user ---


async def test_service_list_filtered_self(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        s_role = Role(name="SELC", code="D_SELC", data_scope=DataScope.SELF)
        db.add(s_role)
        await db.flush()
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
        await _make_user(db, "x@t.com")
        await _make_user(db, "y@t.com")
        await db.commit()
        svc = UserService(db)
        items, total = await svc.list(1, 20, current_user=None)
        assert total >= 2


async def test_service_get_filtered_returns_404(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        s_role = Role(name="SELD", code="D_SELD", data_scope=DataScope.SELF)
        db.add(s_role)
        await db.flush()
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
        a = await _make_user(db, "own@t.com")
        await db.commit()
        svc = UserService(db)
        # 无 current_user(向后兼容)能查
        got = await svc.get(a.id, current_user=None)
        assert got.id == a.id