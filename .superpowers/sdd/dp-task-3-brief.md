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

