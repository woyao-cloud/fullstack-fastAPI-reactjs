## Task 6: DepartmentService — create / update / delete

**Files:**
- Create: `app/application/services/department_service.py`
- Test: `tests/test_department_service.py`(create/update/delete 部分)

**Interfaces:**
- Consumes: `DepartmentRepository`(Task 2)、`DepartmentCache`(Task 3)、`AsyncSession`。
- Produces:`DepartmentService(db, repo, cache)` 与方法 `create/update/delete`(本任务),及后续任务补充 `move/get_tree/get_subtree/list_users`。

- [ ] **Step 1: 写失败测试**

```python
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: FAIL (`ModuleNotFoundError`)

- [ ] **Step 3: 实现 service(create/update/delete;move/get_tree/get_subtree/list_users 留占位,后续任务补)**

```python
# app/application/services/department_service.py
"""部门业务服务."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.schemas.department import DepartmentCreate, DepartmentUpdate
from app.core.cache import DepartmentCache, NoopDepartmentCache
from app.core.exceptions import BusinessException, ConflictError, NotFoundError
from app.domain.models.department import Department
from app.repositories.department_repository import DepartmentRepository

MAX_LEVEL = 5


class DepartmentService:
    def __init__(self, db: AsyncSession, repo: DepartmentRepository, cache: DepartmentCache):
        self.db = db
        self.repo = repo
        self.cache = cache

    async def _get_or_404(self, dept_id: uuid.UUID) -> Department:
        dept = await self.repo.get_by_id(dept_id)
        if dept is None:
            raise NotFoundError("部门不存在")
        return dept

    async def create(self, req: DepartmentCreate) -> Department:
        if await self.repo.get_by_code(req.code) is not None:
            raise ConflictError("部门编码已存在")
        node_seq = await self.repo.next_node_seq()
        if req.parent_id is not None:
            parent = await self.repo.get_by_id(req.parent_id)
            if parent is None:
                raise NotFoundError("父部门不存在")
            if parent.level >= MAX_LEVEL:
                raise BusinessException(f"父部门已达第 {MAX_LEVEL} 级,无法添加子部门")
            level = parent.level + 1
            path = f"{parent.path}/{node_seq}"
            parent_id = parent.id
        else:
            level = 1
            path = f"/{node_seq}"
            parent_id = None
        dept = Department(
            node_seq=node_seq, name=req.name, code=req.code, parent_id=parent_id,
            level=level, path=path, sort_order=req.sort_order, manager_id=req.manager_id,
        )
        async with self.db.begin():
            self.db.add(dept)
            await self.db.flush()
            await self.db.refresh(dept)
        await self.cache.invalidate()
        return dept

    async def update(self, dept_id: uuid.UUID, req: DepartmentUpdate) -> Department:
        dept = await self._get_or_404(dept_id)
        if req.code is not None and req.code != dept.code:
            if await self.repo.get_by_code(req.code) is not None:
                raise ConflictError("部门编码已存在")
        for field, value in req.model_dump(exclude_unset=True).items():
            setattr(dept, field, value)
        async with self.db.begin():
            await self.db.flush()
            await self.db.refresh(dept)
        await self.cache.invalidate()
        return dept

    async def delete(self, dept_id: uuid.UUID) -> None:
        dept = await self._get_or_404(dept_id)
        if await self.repo.count_children(dept_id) > 0:
            raise ConflictError("存在子部门,无法删除")
        if await self.repo.count_users(dept_id) > 0:
            raise ConflictError("存在关联用户,无法删除")
        from datetime import datetime, timezone

        dept.status = "INACTIVE"
        dept.deleted_at = datetime.now(timezone.utc)
        async with self.db.begin():
            await self.db.flush()
        await self.cache.invalidate()

    # move / get_tree / get_subtree / list_users 见 Task 7、Task 8
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: PASS(9 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/services/department_service.py tests/test_department_service.py
git commit -m "feat(dept): DepartmentService create/update/delete(含严格删除拒绝)"
```

---

