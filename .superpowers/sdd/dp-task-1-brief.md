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

