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