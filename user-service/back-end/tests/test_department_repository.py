# tests/test_department_repository.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.domain.models.department import Department
from app.domain.models.user import User
from app.core.security import hash_password
from app.repositories.department_repository import DepartmentRepository

pytestmark = pytest.mark.asyncio


async def _seed_dept(db, **kw):
    dept = Department(node_seq=kw["node_seq"], name=kw["name"], code=kw["code"],
                      level=kw["level"], path=kw["path"],
                      parent_id=kw.get("parent_id"), sort_order=kw.get("sort_order", 0))
    db.add(dept)
    await db.flush()
    return dept


async def test_next_node_seq(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        assert await repo.next_node_seq() == 1
        await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await db.commit()
        assert await repo.next_node_seq() == 2


async def test_list_active_filters_soft_deleted(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="A", code="A", level=1, path="/1")
        d1.status = "INACTIVE"
        await _seed_dept(db, node_seq=2, name="B", code="B", level=1, path="/2")
        await db.commit()
        active = await repo.list_active()
        assert [d.code for d in active] == ["B"]


async def test_find_subtree(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=uuid.uuid4())
        await _seed_dept(db, node_seq=3, name="其他", code="OT", level=1, path="/3")
        await db.commit()
        sub = await repo.find_subtree("/1")
        assert {d.code for d in sub} == {"HQ", "RD"}


async def test_count_children_and_users(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=d1.id)
        user = User(email="u@t.com", password_hash=hash_password("X@1234567"),
                    first_name="U", last_name="L", department_id=d1.id)
        db.add(user)
        await db.commit()
        assert await repo.count_children(d1.id) == 1
        assert await repo.count_users(d1.id) == 1


async def test_max_descendant_depth(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=d1.id)
        await _seed_dept(db, node_seq=3, name="后端", code="BE", level=3, path="/1/2/3", parent_id=uuid.uuid4())
        await db.commit()
        assert await repo.max_descendant_depth("/1", 1) == 2


async def test_replace_subtree_paths(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        d2 = await _seed_dept(db, node_seq=2, name="研发", code="RD", level=2, path="/1/2", parent_id=d1.id)
        await db.commit()
        await repo.replace_subtree_paths(old_prefix="/1", new_prefix="/9", level_delta=1, root_path="/1")
        await db.commit()
        await db.refresh(d1)
        await db.refresh(d2)
        assert d1.path == "/9" and d1.level == 2
        assert d2.path == "/9/2" and d2.level == 3


async def test_replace_subtree_paths_multidigit(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        # 构造 node_seq 1 和 10,验证 /1 不会误伤 /10
        d1 = await _seed_dept(db, node_seq=1, name="总部", code="HQ", level=1, path="/1")
        d10 = await _seed_dept(db, node_seq=10, name="研发", code="RD", level=2, path="/1/10", parent_id=d1.id)
        d100 = await _seed_dept(db, node_seq=100, name="后端", code="BE", level=3, path="/1/10/100", parent_id=d10.id)
        await db.commit()
        await repo.replace_subtree_paths(old_prefix="/1", new_prefix="/9", level_delta=1, root_path="/1")
        await db.commit()
        await db.refresh(d1); await db.refresh(d10); await db.refresh(d100)
        assert d1.path == "/9" and d1.level == 2
        assert d10.path == "/9/10" and d10.level == 3   # 不被误改为 /9/90
        assert d100.path == "/9/10/100" and d100.level == 4  # 不被误改为 /9/90/900