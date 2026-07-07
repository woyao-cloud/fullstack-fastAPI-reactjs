## commits ca535d0..d5b562a
d5b562a feat(dataperm): User.created_by 字段 + create 接 actor

## stat
 .../app/application/services/user_service.py       |  3 +-
 user-service/back-end/app/domain/models/user.py    |  4 +++
 user-service/back-end/app/interfaces/api/users.py  |  4 +--
 .../back-end/tests/test_data_permission.py         | 39 ++++++++++++++++++++++
 4 files changed, 47 insertions(+), 3 deletions(-)

## diff -U10
diff --git a/user-service/back-end/app/application/services/user_service.py b/user-service/back-end/app/application/services/user_service.py
index 56a890b..b127704 100644
--- a/user-service/back-end/app/application/services/user_service.py
+++ b/user-service/back-end/app/application/services/user_service.py
@@ -15,31 +15,32 @@ from app.domain.models.user import User
 from app.repositories.role_repository import RoleRepository
 from app.repositories.user_repository import UserRepository
 
 
 class UserService:
     def __init__(self, db: AsyncSession):
         self.db = db
         self.users = UserRepository(db)
         self.roles = RoleRepository(db)
 
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
 
     async def get(self, user_id: uuid.UUID) -> User:
         user = await self.users.get_by_id(user_id)
         if user is None:
             raise NotFoundError("用户不存在")
diff --git a/user-service/back-end/app/domain/models/user.py b/user-service/back-end/app/domain/models/user.py
index 72679af..f340e88 100644
--- a/user-service/back-end/app/domain/models/user.py
+++ b/user-service/back-end/app/domain/models/user.py
@@ -37,20 +37,24 @@ class User(Base):
         UUIDType, ForeignKey("department.id"), nullable=True
     )
     status: Mapped[UserStatus] = mapped_column(
         String(20), default=UserStatus.PENDING, nullable=False
     )
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
     def full_name(self) -> str:
         return f"{self.first_name} {self.last_name}"
 
     async def permission_codes(self) -> set[str]:
         """获取用户所有权限代码（含角色继承，简化为直接角色权限）。"""
diff --git a/user-service/back-end/app/interfaces/api/users.py b/user-service/back-end/app/interfaces/api/users.py
index cc1316e..b44f7f8 100644
--- a/user-service/back-end/app/interfaces/api/users.py
+++ b/user-service/back-end/app/interfaces/api/users.py
@@ -27,24 +27,24 @@ async def list_users(
     items, total = await service.list(page, size)
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
     current: User = Depends(get_current_user),
 ) -> UserOut:
     # 本人可直接查看；否则需要 user:read 权限
     if current.id != user_id:
diff --git a/user-service/back-end/tests/test_data_permission.py b/user-service/back-end/tests/test_data_permission.py
new file mode 100644
index 0000000..d6faedc
--- /dev/null
+++ b/user-service/back-end/tests/test_data_permission.py
@@ -0,0 +1,39 @@
+# tests/test_data_permission.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.application.schemas.user import UserCreate
+from app.application.services.user_service import UserService
+from app.domain.models.user import User
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
\ No newline at end of file
