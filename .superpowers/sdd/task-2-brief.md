## Task 2: DepartmentRepository

**Files:**
- Create: `app/repositories/department_repository.py`
- Test: `tests/test_department_repository.py`

**Interfaces:**
- Consumes: `Department` 妯″瀷(Task 1)銆乣AsyncSession`銆?- Produces: `DepartmentRepository(db)` 鍚柟娉?
  - `async next_node_seq() -> int`
  - `async get_by_id(id: uuid.UUID) -> Department | None`
  - `async get_by_code(code: str) -> Department | None`
  - `async list_active() -> list[Department]`(`status="ACTIVE"`,order `sort_order, code`)
  - `async find_subtree(root_path: str) -> list[Department]`
  - `async count_children(parent_id: uuid.UUID) -> int`
  - `async count_users(dept_id: uuid.UUID) -> int`
  - `async max_descendant_depth(root_path: str, root_level: int) -> int`(鍚庝唬涓?`max(level - root_level)`,鏃犲悗浠ｈ繑 0)
  - `async add(dept: Department) -> Department`
  - `async replace_subtree_paths(old_prefix: str, new_prefix: str, level_delta: int, root_path: str) -> None`

- [ ] **Step 1: 鍐欏け璐ユ祴璇?*

```python
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
        await _seed_dept(db, node_seq=1, name="鎬婚儴", code="HQ", level=1, path="/1")
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
        await _seed_dept(db, node_seq=1, name="鎬婚儴", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="鐮斿彂", code="RD", level=2, path="/1/2", parent_id=uuid.uuid4())
        await _seed_dept(db, node_seq=3, name="鍏朵粬", code="OT", level=1, path="/3")
        await db.commit()
        sub = await repo.find_subtree("/1")
        assert {d.code for d in sub} == {"HQ", "RD"}


async def test_count_children_and_users(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="鎬婚儴", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="鐮斿彂", code="RD", level=2, path="/1/2", parent_id=d1.id)
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
        d1 = await _seed_dept(db, node_seq=1, name="鎬婚儴", code="HQ", level=1, path="/1")
        await _seed_dept(db, node_seq=2, name="鐮斿彂", code="RD", level=2, path="/1/2", parent_id=d1.id)
        await _seed_dept(db, node_seq=3, name="鍚庣", code="BE", level=3, path="/1/2/3", parent_id=uuid.uuid4())
        await db.commit()
        assert await repo.max_descendant_depth("/1", 1) == 2


async def test_replace_subtree_paths(engine, seed):
    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with Session() as db:
        repo = DepartmentRepository(db)
        d1 = await _seed_dept(db, node_seq=1, name="鎬婚儴", code="HQ", level=1, path="/1")
        d2 = await _seed_dept(db, node_seq=2, name="鐮斿彂", code="RD", level=2, path="/1/2", parent_id=d1.id)
        await db.commit()
        await repo.replace_subtree_paths(old_prefix="/1", new_prefix="/9", level_delta=1, root_path="/1")
        await db.commit()
        await db.refresh(d1)
        await db.refresh(d2)
        assert d1.path == "/9" and d1.level == 2
        assert d2.path == "/9/2" and d2.level == 3
```

- [ ] **Step 2: 杩愯娴嬭瘯纭澶辫触**

Run: `uv run pytest tests/test_department_repository.py -v`
Expected: FAIL (`ModuleNotFoundError: app.repositories.department_repository`)

- [ ] **Step 3: 瀹炵幇 repository**

```python
# app/repositories/department_repository.py
"""閮ㄩ棬鏁版嵁璁块棶."""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.department import Department
from app.domain.models.user import User


class DepartmentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def next_node_seq(self) -> int:
        result = await self.db.execute(select(func.coalesce(func.max(Department.node_seq), 0)))
        return int(result.scalar_one()) + 1

    async def get_by_id(self, dept_id: uuid.UUID) -> Department | None:
        return await self.db.get(Department, dept_id)

    async def get_by_code(self, code: str) -> Department | None:
        result = await self.db.execute(select(Department).where(Department.code == code))
        return result.scalar_one_or_none()

    async def list_active(self) -> list[Department]:
        result = await self.db.execute(
            select(Department)
            .where(Department.status == "ACTIVE")
            .order_by(Department.sort_order, Department.code)
        )
        return list(result.scalars().all())

    async def find_subtree(self, root_path: str) -> list[Department]:
        result = await self.db.execute(
            select(Department).where(Department.path.like(f"{root_path}%"))
        )
        return list(result.scalars().all())

    async def count_children(self, parent_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Department).where(Department.parent_id == parent_id)
        )
        return int(result.scalar_one())

    async def count_users(self, dept_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(User).where(User.department_id == dept_id)
        )
        return int(result.scalar_one())

    async def max_descendant_depth(self, root_path: str, root_level: int) -> int:
        """鍚庝唬涓渶澶?(level - root_level);鏃犲悗浠ｈ繑 0銆?""
        result = await self.db.execute(
            select(func.max(Department.level))
            .where(Department.path.like(f"{root_path}/%"))  # 鎺掗櫎鑷韩
        )
        max_level = result.scalar_one()
        return (int(max_level) - root_level) if max_level is not None else 0

    async def add(self, dept: Department) -> Department:
        self.db.add(dept)
        await self.db.flush()
        await self.db.refresh(dept)
        return dept

    async def replace_subtree_paths(
        self, old_prefix: str, new_prefix: str, level_delta: int, root_path: str
    ) -> None:
        """鎵归噺鏇挎崲瀛愭爲(鍚嚜韬?path 鍓嶇紑骞惰皟鏁?level銆?""
        await self.db.execute(
            update(Department)
            .where(Department.path.like(f"{root_path}%"))
            .values(
                path=func.replace(Department.path, old_prefix, new_prefix),
                level=Department.level + level_delta,
            )
        )
```

- [ ] **Step 4: 杩愯娴嬭瘯纭閫氳繃**

Run: `uv run pytest tests/test_department_repository.py -v`
Expected: PASS(6 passed)

- [ ] **Step 5: 鎻愪氦**

```bash
git add app/repositories/department_repository.py tests/test_department_repository.py
git commit -m "feat(dept): DepartmentRepository(CRUD/瀛愭爲/璁℃暟/璺緞鎵归噺鏇存柊)"
```

---

