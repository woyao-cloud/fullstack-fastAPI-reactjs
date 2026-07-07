## commits ca535d0..8113c59 (data-permission feature)
8113c59 test(dataperm): 全量回归通过,覆盖率>=85%,ruff 清零
b824633 feat(dataperm): API 注入 current_user + 本人直查 + 权限码内联检查
d623899 feat(dataperm): UserService.list/get 集成 current_user 过滤
0151719 feat(dataperm): DataPermissionFilter + get_sub_department_ids
d5b562a feat(dataperm): User.created_by 字段 + create 接 actor

## stat
 .../application/services/data_permission_filter.py |  50 +++++
 .../app/application/services/user_service.py       |  23 +-
 user-service/back-end/app/domain/models/user.py    |   4 +
 user-service/back-end/app/interfaces/api/users.py  |  33 +--
 .../app/repositories/department_repository.py      |  10 +
 .../back-end/app/repositories/user_repository.py   |   9 +
 user-service/back-end/tests/conftest.py            |   2 +
 .../back-end/tests/test_data_permission.py         | 237 +++++++++++++++++++++
 user-service/back-end/tests/test_users.py          |  47 +++-
 9 files changed, 393 insertions(+), 22 deletions(-)

## diff -U5
diff --git a/user-service/back-end/app/application/services/data_permission_filter.py b/user-service/back-end/app/application/services/data_permission_filter.py
new file mode 100644
index 0000000..40e948a
--- /dev/null
+++ b/user-service/back-end/app/application/services/data_permission_filter.py
@@ -0,0 +1,50 @@
+# app/application/services/data_permission_filter.py
+"""数据权限过滤:按用户有效 data_scope 叠加 where."""
+
+from __future__ import annotations
+
+import uuid
+
+from sqlalchemy import false
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.domain.models.enums import DataScope
+from app.domain.models.user import User
+from app.repositories.department_repository import DepartmentRepository
+
+
+class DataPermissionFilter:
+    def __init__(self, db: AsyncSession, dept_repo: DepartmentRepository):
+        self.db = db
+        self.dept_repo = dept_repo
+
+    @staticmethod
+    def _effective_scope(user: User) -> DataScope:
+        scopes = {r.data_scope for r in user.roles}
+        if DataScope.ALL in scopes:
+            return DataScope.ALL
+        if DataScope.DEPT in scopes:
+            return DataScope.DEPT
+        if DataScope.SELF in scopes:
+            return DataScope.SELF
+        return DataScope.SELF  # CUSTOM / 无角色 → SELF 回退
+
+    async def _accessible_dept_ids(self, user: User) -> list[uuid.UUID]:
+        if user.department_id is None:
+            return []
+        ids = await self.dept_repo.get_sub_department_ids(user.department_id)
+        ids.append(user.department_id)
+        return ids
+
+    async def apply(self, stmt, current_user: User):
+        scope = self._effective_scope(current_user)
+        if scope is DataScope.ALL:
+            return stmt
+        if scope is DataScope.SELF:
+            return stmt.where(User.created_by == current_user.id)
+        if scope is DataScope.DEPT:
+            dept_ids = await self._accessible_dept_ids(current_user)
+            if not dept_ids:
+                return stmt.where(false())
+            return stmt.where(User.department_id.in_(dept_ids))
+        return stmt.where(User.created_by == current_user.id)  # CUSTOM 回退 SELF
\ No newline at end of file
diff --git a/user-service/back-end/app/application/services/user_service.py b/user-service/back-end/app/application/services/user_service.py
index 56a890b..821620d 100644
--- a/user-service/back-end/app/application/services/user_service.py
+++ b/user-service/back-end/app/application/services/user_service.py
@@ -6,49 +6,62 @@ import uuid
 from collections.abc import Sequence
 
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.application.schemas.user import UserCreate, UserUpdate
+from app.application.services.data_permission_filter import DataPermissionFilter
 from app.core.exceptions import ConflictError, NotFoundError
 from app.core.security import hash_password
 from app.domain.models.enums import UserStatus
 from app.domain.models.user import User
+from app.repositories.department_repository import DepartmentRepository
 from app.repositories.role_repository import RoleRepository
 from app.repositories.user_repository import UserRepository
 
 
 class UserService:
     def __init__(self, db: AsyncSession):
         self.db = db
         self.users = UserRepository(db)
         self.roles = RoleRepository(db)
+        self.filter = DataPermissionFilter(db, DepartmentRepository(db))
 
-    async def create(self, req: UserCreate) -> User:
+    async def create(self, req: UserCreate, actor: User | None = None) -> User:
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
+            created_by=actor.id if actor is not None else None,
         )
         await self.users.add(user)
         await self.db.commit()
         await self.db.refresh(user)
         return user
 
-    async def get(self, user_id: uuid.UUID) -> User:
-        user = await self.users.get_by_id(user_id)
+    async def get(self, user_id: uuid.UUID, current_user: User | None = None) -> User:
+        stmt = User.with_roles().where(User.id == user_id)
+        if current_user is not None:
+            stmt = await self.filter.apply(stmt, current_user)
+        result = await self.db.execute(stmt)
+        user = result.unique().scalar_one_or_none()
         if user is None:
             raise NotFoundError("用户不存在")
         return user
 
-    async def list(self, page: int = 1, size: int = 20) -> tuple[Sequence[User], int]:
-        return await self.users.list(page, size)
+    async def list(
+        self, page: int = 1, size: int = 20, current_user: User | None = None
+    ) -> tuple[Sequence[User], int]:
+        stmt = User.with_roles()
+        if current_user is not None:
+            stmt = await self.filter.apply(stmt, current_user)
+        return await self.users.list_from_stmt(stmt, page, size)
 
     async def update(self, user_id: uuid.UUID, req: UserUpdate) -> User:
         user = await self.get(user_id)
         data = req.model_dump(exclude_unset=True)
         for field, value in data.items():
diff --git a/user-service/back-end/app/domain/models/user.py b/user-service/back-end/app/domain/models/user.py
index 72679af..f340e88 100644
--- a/user-service/back-end/app/domain/models/user.py
+++ b/user-service/back-end/app/domain/models/user.py
@@ -42,10 +42,14 @@ class User(Base):
     email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
     failed_login_attempts: Mapped[int] = mapped_column(default=0, nullable=False)
     is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
     last_login_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
 
+    created_by: Mapped[uuid.UUID | None] = mapped_column(
+        UUIDType, ForeignKey("user_account.id"), nullable=True, index=True
+    )
+
     roles: Mapped[list[Role]] = relationship(
         secondary="user_role", back_populates="users", lazy="selectin"
     )
 
     @property
diff --git a/user-service/back-end/app/interfaces/api/users.py b/user-service/back-end/app/interfaces/api/users.py
index cc1316e..c2384df 100644
--- a/user-service/back-end/app/interfaces/api/users.py
+++ b/user-service/back-end/app/interfaces/api/users.py
@@ -2,11 +2,11 @@
 
 from __future__ import annotations
 
 import uuid
 
-from fastapi import APIRouter, Depends, Query, status
+from fastapi import APIRouter, Depends, HTTPException, Query, status
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.application.deps import get_db
 from app.application.schemas.user import UserCreate, UserListOut, UserOut, UserUpdate
 from app.application.services.user_service import UserService
@@ -19,45 +19,46 @@ router = APIRouter(prefix="/users", tags=["users"])
 @router.get("", response_model=UserListOut)
 async def list_users(
     page: int = Query(1, ge=1),
     size: int = Query(20, ge=1, le=100),
     db: AsyncSession = Depends(get_db),
-    _: User = Depends(require_permission("user:read")),
+    current_user: User = Depends(get_current_user),
 ) -> UserListOut:
+    codes = await current_user.permission_codes()
+    if "user:read" not in codes:
+        raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
     service = UserService(db)
-    items, total = await service.list(page, size)
+    items, total = await service.list(page, size, current_user=current_user)
     return UserListOut(
         items=[UserOut.model_validate(u) for u in items], total=total, page=page, size=size
     )
 
 
 @router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
 async def create_user(
     req: UserCreate,
     db: AsyncSession = Depends(get_db),
-    _: User = Depends(require_permission("user:create")),
+    current_user: User = Depends(require_permission("user:create")),
 ) -> UserOut:
     service = UserService(db)
-    return UserOut.model_validate(await service.create(req))
+    return UserOut.model_validate(await service.create(req, actor=current_user))
 
 
 @router.get("/{user_id}", response_model=UserOut)
 async def get_user(
     user_id: uuid.UUID,
     db: AsyncSession = Depends(get_db),
-    current: User = Depends(get_current_user),
+    current_user: User = Depends(get_current_user),
 ) -> UserOut:
-    # 本人可直接查看；否则需要 user:read 权限
-    if current.id != user_id:
-        codes = await current.permission_codes()
-        if "user:read" not in codes:
-            from fastapi import HTTPException, status
-
-            raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
-        service = UserService(db)
-        return UserOut.model_validate(await service.get(user_id))
-    return UserOut.model_validate(current)
+    # 本人直查:跳过权限检查与 data_scope 过滤
+    if current_user.id == user_id:
+        return UserOut.model_validate(current_user)
+    codes = await current_user.permission_codes()
+    if "user:read" not in codes:
+        raise HTTPException(status.HTTP_403_FORBIDDEN, "缺少权限: user:read")
+    service = UserService(db)
+    return UserOut.model_validate(await service.get(user_id, current_user=current_user))
 
 
 @router.put("/{user_id}", response_model=UserOut)
 async def update_user(
     user_id: uuid.UUID,
diff --git a/user-service/back-end/app/repositories/department_repository.py b/user-service/back-end/app/repositories/department_repository.py
index 7c1ec79..6111a07 100644
--- a/user-service/back-end/app/repositories/department_repository.py
+++ b/user-service/back-end/app/repositories/department_repository.py
@@ -39,10 +39,20 @@ class DepartmentRepository:
         result = await self.db.execute(
             select(Department).where(Department.path.like(f"{root_path}%"))
         )
         return list(result.scalars().all())
 
+    async def get_sub_department_ids(self, dept_id: uuid.UUID) -> list[uuid.UUID]:
+        """返回 dept_id 的子部门 id 列表(不含自身)。"""
+        dept = await self.db.get(Department, dept_id)
+        if dept is None:
+            return []
+        result = await self.db.execute(
+            select(Department.id).where(Department.path.like(f"{dept.path}/%"))
+        )
+        return list(result.scalars().all())
+
     async def count_children(self, parent_id: uuid.UUID) -> int:
         result = await self.db.execute(
             select(func.count())
             .select_from(Department)
             .where(
diff --git a/user-service/back-end/app/repositories/user_repository.py b/user-service/back-end/app/repositories/user_repository.py
index 451f096..ba6d630 100644
--- a/user-service/back-end/app/repositories/user_repository.py
+++ b/user-service/back-end/app/repositories/user_repository.py
@@ -33,10 +33,19 @@ class UserRepository:
         total = total_result.scalar_one()
         stmt = User.with_roles().offset(offset).limit(size)
         result = await self.db.execute(stmt)
         return result.unique().scalars().all(), total
 
+    async def list_from_stmt(
+        self, stmt, page: int = 1, size: int = 20
+    ) -> tuple[Sequence[User], int]:
+        offset = (page - 1) * size
+        total_result = await self.db.execute(select(func.count()).select_from(stmt.subquery()))
+        total = total_result.scalar_one()
+        result = await self.db.execute(stmt.offset(offset).limit(size))
+        return result.unique().scalars().all(), total
+
     async def add(self, user: User) -> User:
         self.db.add(user)
         await self.db.flush()
         await self.db.refresh(user)
         return user
diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
index 8428248..f91676d 100644
--- a/user-service/back-end/tests/conftest.py
+++ b/user-service/back-end/tests/conftest.py
@@ -120,10 +120,12 @@ async def seed(db_session):
     await db_session.flush()
 
     admin = Role(name="管理员", code="ADMIN", data_scope=DataScope.ALL)
     admin.permissions = perms
     user_role = Role(name="普通用户", code="USER", data_scope=DataScope.SELF)
+    # 普通用户可读用户(本人,受 SELF data_scope 限制),但不能增删改/分配角色
+    user_role.permissions = [p for p in perms if p.code == "user:read"]
     db_session.add_all([admin, user_role])
     await db_session.commit()
     return {"admin": admin, "user": user_role, "permissions": perms}
 
 
diff --git a/user-service/back-end/tests/test_data_permission.py b/user-service/back-end/tests/test_data_permission.py
new file mode 100644
index 0000000..2489e42
--- /dev/null
+++ b/user-service/back-end/tests/test_data_permission.py
@@ -0,0 +1,237 @@
+# tests/test_data_permission.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from sqlalchemy import select
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.application.schemas.user import UserCreate
+from app.application.services.data_permission_filter import DataPermissionFilter
+from app.application.services.user_service import UserService
+from app.core.exceptions import NotFoundError
+from app.domain.models.enums import DataScope
+from app.domain.models.role import Role
+from app.domain.models.user import User
+from app.repositories.department_repository import DepartmentRepository
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_create_sets_created_by(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        # 先建一个 actor 用户(系统建,created_by=None)
+        actor = await UserService(db).create(
+            UserCreate(email="actor@test.com", password="Actor@1234",
+                       first_name="Actor", last_name="L"), actor=None)
+        await db.commit()
+        # 以 actor 身份建另一用户
+        created = await UserService(db).create(
+            UserCreate(email="child@test.com", password="Child@1234",
+                       first_name="Child", last_name="L"), actor=actor)
+        await db.commit()
+        assert created.created_by == actor.id
+
+
+async def test_create_without_actor_has_no_created_by(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        u = await UserService(db).create(
+            UserCreate(email="noparent@test.com", password="NoP@1234",
+                       first_name="No", last_name="P"), actor=None)
+        await db.commit()
+        assert u.created_by is None
+
+
+async def _make_user(db, email, roles=(), department_id=None, created_by=None):
+    from sqlalchemy.orm import selectinload
+
+    from app.core.security import hash_password
+    from app.domain.models.user import User
+    u = User(email=email, password_hash=hash_password("X@1234567"),
+             first_name="U", last_name="L", department_id=department_id, created_by=created_by)
+    for r in roles:
+        u.roles.append(r)
+    db.add(u)
+    await db.flush()
+    # 重新加载以在 greenlet 上下文内初始化 roles 集合(避免 async lazy-load 失败)
+    u = (await db.execute(
+        select(User).options(selectinload(User.roles)).where(User.id == u.id)
+    )).scalar_one()
+    return u
+
+
+async def test_effective_scope_all_wins(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        all_role = Role(name="ALL", code="D_ALL", data_scope=DataScope.ALL)
+        self_role = Role(name="SELF", code="D_SELF", data_scope=DataScope.SELF)
+        db.add_all([all_role, self_role])
+        await db.flush()
+        u = await _make_user(db, "a@t.com", roles=[all_role, self_role])
+        await db.commit()
+        assert DataPermissionFilter._effective_scope(u) is DataScope.ALL
+
+
+async def test_effective_scope_dept_over_self(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        d_role = Role(name="DEPT", code="D_DEPT", data_scope=DataScope.DEPT)
+        s_role = Role(name="SELF2", code="D_SELF2", data_scope=DataScope.SELF)
+        db.add_all([d_role, s_role])
+        await db.flush()
+        u = await _make_user(db, "b@t.com", roles=[d_role, s_role])
+        await db.commit()
+        assert DataPermissionFilter._effective_scope(u) is DataScope.DEPT
+
+
+async def test_effective_scope_custom_falls_back_self(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        c_role = Role(name="CUST", code="D_CUST", data_scope=DataScope.CUSTOM)
+        db.add(c_role)
+        await db.flush()
+        u = await _make_user(db, "c@t.com", roles=[c_role])
+        await db.commit()
+        assert DataPermissionFilter._effective_scope(u) is DataScope.SELF
+
+
+async def test_effective_scope_no_roles_self(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        u = await _make_user(db, "d@t.com")
+        await db.commit()
+        assert DataPermissionFilter._effective_scope(u) is DataScope.SELF
+
+
+async def test_filter_all_no_where(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        all_role = Role(name="ALLB", code="D_ALLB", data_scope=DataScope.ALL)
+        db.add(all_role)
+        await db.flush()
+        u = await _make_user(db, "e@t.com", roles=[all_role])
+        await db.commit()
+        f = DataPermissionFilter(db, DepartmentRepository(db))
+        stmt = select(User)
+        out = await f.apply(stmt, u)
+        # ALL 不过滤:返回的 stmt 仍是 select(User) 无 where
+        assert out.whereclause is None
+
+
+async def test_filter_self_only_created(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        s_role = Role(name="SELFB", code="D_SELFB", data_scope=DataScope.SELF)
+        db.add(s_role)
+        await db.flush()
+        me = await _make_user(db, "me@t.com", roles=[s_role])
+        await db.commit()
+        # 另建两个用户,一个 created_by=me,一个 created_by=None
+        other_mine = await _make_user(db, "mine@t.com", created_by=me.id)
+        await db.commit()
+        other_not = await _make_user(db, "notmine@t.com", created_by=None)
+        await db.commit()
+        f = DataPermissionFilter(db, DepartmentRepository(db))
+        result = await db.execute(await f.apply(select(User), me))
+        ids = {u.id for u in result.scalars().all()}
+        assert other_mine.id in ids
+        assert other_not.id not in ids
+
+
+async def test_filter_dept_subtree(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        # 建部门树:HQ(/1) -> RD(/1/2)
+        from app.domain.models.department import Department
+        hq = Department(node_seq=1, name="HQ", code="HQ", level=1, path="/1")
+        rd = Department(
+            node_seq=2, name="RD", code="RDB", level=2,
+            path="/1/2", parent_id=uuid.uuid4(),
+        )
+        db.add_all([hq, rd])
+        await db.flush()
+        d_role = Role(name="DEPTB", code="D_DEPTB", data_scope=DataScope.DEPT)
+        db.add(d_role)
+        await db.flush()
+        me = await _make_user(db, "deptme@t.com", roles=[d_role], department_id=hq.id)
+        in_dept = await _make_user(db, "indept@t.com", department_id=rd.id)  # 子部门
+        out_dept = await _make_user(db, "outdept@t.com")  # 无部门
+        await db.commit()
+        f = DataPermissionFilter(db, DepartmentRepository(db))
+        result = await db.execute(await f.apply(select(User), me))
+        ids = {u.id for u in result.scalars().all()}
+        assert in_dept.id in ids and me.id in ids  # 本部门 + 子部门
+        assert out_dept.id not in ids
+
+
+async def test_filter_dept_no_department_empty(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        d_role = Role(name="DEPTC", code="D_DEPTC", data_scope=DataScope.DEPT)
+        db.add(d_role)
+        await db.flush()
+        me = await _make_user(db, "nodept@t.com", roles=[d_role])  # 无 department_id
+        await db.commit()
+        f = DataPermissionFilter(db, DepartmentRepository(db))
+        result = await db.execute(await f.apply(select(User), me))
+        assert result.scalars().all() == []  # 空集
+
+
+# --- Task 3: UserService.list/get 集成 current_user ---
+
+
+async def test_service_list_filtered_self(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        s_role = Role(name="SELC", code="D_SELC", data_scope=DataScope.SELF)
+        db.add(s_role)
+        await db.flush()
+        me = await _make_user(db, "me2@t.com", roles=[s_role])
+        mine = await _make_user(db, "mine2@t.com", created_by=me.id)
+        other = await _make_user(db, "other2@t.com")
+        await db.commit()
+        svc = UserService(db)
+        items, total = await svc.list(1, 20, current_user=me)
+        ids = {u.id for u in items}
+        assert mine.id in ids and other.id not in ids
+        assert total == 1
+
+
+async def test_service_list_no_current_user_no_filter(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        await _make_user(db, "x@t.com")
+        await _make_user(db, "y@t.com")
+        await db.commit()
+        svc = UserService(db)
+        items, total = await svc.list(1, 20, current_user=None)
+        assert total >= 2
+
+
+async def test_service_get_filtered_returns_404(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        s_role = Role(name="SELD", code="D_SELD", data_scope=DataScope.SELF)
+        db.add(s_role)
+        await db.flush()
+        me = await _make_user(db, "me3@t.com", roles=[s_role])
+        other = await _make_user(db, "other3@t.com")  # 非 me 创建
+        await db.commit()
+        svc = UserService(db)
+        # me 无权看 other(SELF)→ 404
+        with pytest.raises(NotFoundError):
+            await svc.get(other.id, current_user=me)
+
+
+async def test_service_get_self_can_see_own(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        a = await _make_user(db, "own@t.com")
+        await db.commit()
+        svc = UserService(db)
+        # 无 current_user(向后兼容)能查
+        got = await svc.get(a.id, current_user=None)
+        assert got.id == a.id
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_users.py b/user-service/back-end/tests/test_users.py
index bea0822..07c60a7 100644
--- a/user-service/back-end/tests/test_users.py
+++ b/user-service/back-end/tests/test_users.py
@@ -128,6 +128,51 @@ async def test_admin_get_other_user_as_admin(client, admin_token):
         headers=await _auth_header(admin_token),
     )
     uid = create.json()["id"]
     resp = await client.get(f"/api/v1/users/{uid}", headers=await _auth_header(admin_token))
     assert resp.status_code == 200
-    assert resp.json()["email"] == "erin@test.com"
\ No newline at end of file
+    assert resp.json()["email"] == "erin@test.com"
+
+
+async def test_admin_all_sees_all_users(client, admin_token):
+    # admin(ALL)能看到所有用户
+    h = await _auth_header(admin_token)
+    create = await client.post("/api/v1/users", json={
+        "email": "selfuser@test.com", "password": "Self@1234",
+        "first_name": "Self", "last_name": "L"}, headers=h)
+    assert create.status_code == 201
+    lst = await client.get("/api/v1/users", headers=h)
+    assert lst.status_code == 200
+    emails = {u["email"] for u in lst.json()["items"]}
+    assert "selfuser@test.com" in emails
+
+
+async def test_get_other_as_regular_404(client):
+    # 普通用户(SELF,注册即 USER 角色 data_scope=SELF)查不属于自己的用户 → 404
+    reg = await client.post("/api/v1/auth/register", json={
+        "email": "reg@t.com", "password": "Reg@1234",
+        "first_name": "R", "last_name": "L"})
+    assert reg.status_code == 201
+    other = await client.post("/api/v1/auth/register", json={
+        "email": "other@t.com", "password": "Other@1234",
+        "first_name": "O", "last_name": "L"})
+    assert other.status_code == 201
+    login = await client.post("/api/v1/auth/login",
+                              json={"email": "reg@t.com", "password": "Reg@1234"})
+    token = login.json()["access_token"]
+    resp = await client.get(f"/api/v1/users/{other.json()['id']}",
+                           headers={"Authorization": f"Bearer {token}"})
+    assert resp.status_code == 404
+
+
+async def test_self_can_see_own_via_api(client):
+    reg = await client.post("/api/v1/auth/register", json={
+        "email": "own@t.com", "password": "Own@1234",
+        "first_name": "O", "last_name": "L"})
+    assert reg.status_code == 201
+    uid = reg.json()["id"]
+    login = await client.post("/api/v1/auth/login",
+                              json={"email": "own@t.com", "password": "Own@1234"})
+    token = login.json()["access_token"]
+    resp = await client.get(f"/api/v1/users/{uid}",
+                           headers={"Authorization": f"Bearer {token}"})
+    assert resp.status_code == 200  # 本人直查
\ No newline at end of file
