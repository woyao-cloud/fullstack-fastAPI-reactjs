# tests/test_department_service.py
from __future__ import annotations

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.application.schemas.department import DepartmentCreate, DepartmentUpdate
from app.application.services.department_service import DepartmentService
from app.core.cache import NoopDepartmentCache
from app.core.exceptions import BusinessException, ConflictError, NotFoundError
from app.domain.models.department import Department
from app.domain.models.user import User
from app.core.security import hash_password
from app.repositories.department_repository import DepartmentRepository

pytestmark = pytest.mark.asyncio


def _service(db):
    return DepartmentService(db, DepartmentRepository(db), NoopDepartmentCache())


async def test_create_root(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        dept = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        assert dept.level == 1 and dept.path == "/1" and dept.node_seq == 1


async def test_create_child(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        child = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        assert child.level == 2 and child.path == f"/1/{child.node_seq}"


async def test_create_code_conflict(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        await svc.create(DepartmentCreate(name="总部", code="HQ"))
        with pytest.raises(ConflictError):
            await svc.create(DepartmentCreate(name="总2", code="HQ"))


async def test_create_parent_at_level5(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        # 构造 5 级链
        prev = await svc.create(DepartmentCreate(name="L1", code="C1"))
        for i in range(4):
            prev = await svc.create(DepartmentCreate(name=f"L{i+2}", code=f"C{i+2}", parent_id=prev.id))
        assert prev.level == 5
        with pytest.raises(BusinessException):
            await svc.create(DepartmentCreate(name="L6", code="C6", parent_id=prev.id))


async def test_update_does_not_change_path(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        before = (root.path, root.level)
        updated = await svc.update(root.id, DepartmentUpdate(name="总部改"))
        assert (updated.path, updated.level) == before
        assert updated.name == "总部改"


async def test_delete_leaf_ok(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        await svc.delete(root.id)
        got = await db.get(Department, root.id)
        assert got.status == "INACTIVE"


async def test_delete_with_children_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        with pytest.raises(ConflictError):
            await svc.delete(root.id)


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


async def test_update_not_found(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        with pytest.raises(NotFoundError):
            await svc.update(uuid.uuid4(), DepartmentUpdate(name="x"))


async def test_move_subtree_updates_paths(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        be = await svc.create(DepartmentCreate(name="后端", code="BE", parent_id=rd.id))
        other = await svc.create(DepartmentCreate(name="销售", code="SL"))
        moved = await svc.move(rd.id, other.id)
        assert moved.parent_id == other.id
        assert moved.path == f"/{other.node_seq}/{rd.node_seq}" and moved.level == 2
        # 后代路径/层级跟随
        be_db = await db.get(Department, be.id)
        assert be_db.path == f"/{other.node_seq}/{rd.node_seq}/{be.node_seq}" and be_db.level == 3


async def test_move_to_root(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        moved = await svc.move(rd.id, None)
        assert moved.parent_id is None and moved.level == 1 and moved.path == f"/{rd.node_seq}"


async def test_move_circular_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        # 把 root 移到 rd 之下 → 循环
        with pytest.raises(BusinessException):
            await svc.move(root.id, rd.id)


async def test_move_exceeds_5levels_rejected(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        prev = await svc.create(DepartmentCreate(name="L1", code="C1"))
        chain_root = prev
        for i in range(4):
            prev = await svc.create(DepartmentCreate(name=f"L{i+2}", code=f"C{i+2}", parent_id=prev.id))
        # chain_root.level==1,后代最深 L5;把 chain_root 子树挂到 root2 下 → root2.level1, chain_root 变 2,后代变 6 → 超限
        root2 = await svc.create(DepartmentCreate(name="R2", code="R2"))
        with pytest.raises(BusinessException):
            await svc.move(chain_root.id, root2.id)


from app.application.schemas.department import DepartmentTreeNode
from app.application.schemas.user import UserOut


async def test_get_tree_nested(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        tree = await svc.get_tree()
        assert len(tree) == 1 and tree[0].code == "HQ"
        assert [c.code for c in tree[0].children] == ["RD"]


async def test_get_subtree(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
        other = await svc.create(DepartmentCreate(name="销售", code="SL"))
        sub = await svc.get_subtree(root.id)
        assert len(sub) == 1 and sub[0].code == "HQ"
        assert [c.code for c in sub[0].children] == ["RD"]


async def test_get_tree_excludes_inactive(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        a = await svc.create(DepartmentCreate(name="A", code="A"))
        b = await svc.create(DepartmentCreate(name="B", code="B"))
        await svc.delete(a.id)
        tree = await svc.get_tree()
        assert [n.code for n in tree] == ["B"]


async def test_list_users(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        svc = _service(db)
        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
        db.add(User(email="u1@t.com", password_hash=hash_password("X@1234567"),
                    first_name="U", last_name="L", department_id=root.id))
        db.add(User(email="u2@t.com", password_hash=hash_password("X@1234567"),
                    first_name="U2", last_name="L", department_id=root.id))
        await db.commit()
        users = await svc.list_users(root.id)
        assert {u.email for u in users} == {"u1@t.com", "u2@t.com"}