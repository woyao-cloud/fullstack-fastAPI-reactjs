## commits 5f5b713..36a5725
36a5725 feat(dept): DepartmentService.move(防循环/深度校验/子树批量路径更新)

## stat
 .../app/application/services/department_service.py | 45 +++++++++++++++++-
 .../back-end/tests/test_department_service.py      | 53 +++++++++++++++++++++-
 2 files changed, 96 insertions(+), 2 deletions(-)

## diff -U10
diff --git a/user-service/back-end/app/application/services/department_service.py b/user-service/back-end/app/application/services/department_service.py
index de03633..7d066f8 100644
--- a/user-service/back-end/app/application/services/department_service.py
+++ b/user-service/back-end/app/application/services/department_service.py
@@ -77,11 +77,54 @@ class DepartmentService:
         if await self.repo.count_users(dept_id) > 0:
             raise ConflictError("存在关联用户,无法删除")
         from datetime import datetime, timezone
 
         dept.status = "INACTIVE"
         dept.deleted_at = datetime.now(timezone.utc)
         await self.db.flush()
         await self.db.commit()
         await self.cache.invalidate()
 
-    # move / get_tree / get_subtree / list_users 见 Task 7、Task 8
\ No newline at end of file
+    async def move(self, dept_id: uuid.UUID, new_parent_id: uuid.UUID | None) -> Department:
+        dept = await self._get_or_404(dept_id)
+        old_path = dept.path
+        old_level = dept.level
+
+        if new_parent_id is None:
+            new_parent = None
+            new_level = 1
+            new_prefix = f"/{dept.node_seq}"
+        else:
+            if new_parent_id == dept_id:
+                raise BusinessException("不能将部门移动到自身之下")
+            new_parent = await self.repo.get_by_id(new_parent_id)
+            if new_parent is None:
+                raise NotFoundError("父部门不存在")
+            # 防循环:新父不能是自身或自身后代
+            if new_parent.path == old_path or new_parent.path.startswith(old_path + "/"):
+                raise BusinessException("不能形成循环依赖")
+            new_level = new_parent.level + 1
+            new_prefix = f"{new_parent.path}/{dept.node_seq}"
+
+        # 深度校验:移动后子树最大深度不超过 5
+        max_depth = await self.repo.max_descendant_depth(old_path, old_level)
+        if new_level + max_depth > MAX_LEVEL:
+            raise BusinessException("移动后层级超过 5 级限制")
+
+        level_delta = new_level - old_level
+        # 注: brief 使用 `async with self.db.begin()`,但预检读取已触发 autobegin,
+        # 再次 begin 会抛 InvalidRequestError。改为 flush+commit(与本仓 user_service 一致)。
+        dept.parent_id = new_parent_id
+        dept.level = new_level
+        dept.path = new_prefix
+        await self.db.flush()
+        # 批量更新后代(排除自身,自身已更新)
+        await self.repo.replace_subtree_paths(
+            old_prefix=old_path, new_prefix=new_prefix,
+            level_delta=level_delta, root_path=old_path + "/",
+        )
+        await self.db.commit()
+        await self.db.refresh(dept)
+        await self.cache.invalidate()
+        return dept
+
+    # get_tree / get_subtree / list_users 见 Task 8
\ No newline at end of file
diff --git a/user-service/back-end/tests/test_department_service.py b/user-service/back-end/tests/test_department_service.py
index 421ee5c..6145254 100644
--- a/user-service/back-end/tests/test_department_service.py
+++ b/user-service/back-end/tests/test_department_service.py
@@ -102,11 +102,62 @@ async def test_delete_with_users_rejected(engine, seed):
         await db.commit()
         with pytest.raises(ConflictError):
             await svc.delete(root.id)
 
 
 async def test_update_not_found(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         svc = _service(db)
         with pytest.raises(NotFoundError):
-            await svc.update(uuid.uuid4(), DepartmentUpdate(name="x"))
\ No newline at end of file
+            await svc.update(uuid.uuid4(), DepartmentUpdate(name="x"))
+
+
+async def test_move_subtree_updates_paths(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _service(db)
+        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
+        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
+        be = await svc.create(DepartmentCreate(name="后端", code="BE", parent_id=rd.id))
+        other = await svc.create(DepartmentCreate(name="销售", code="SL"))
+        moved = await svc.move(rd.id, other.id)
+        assert moved.parent_id == other.id
+        assert moved.path == f"/{other.node_seq}/{rd.node_seq}" and moved.level == 2
+        # 后代路径/层级跟随
+        be_db = await db.get(Department, be.id)
+        assert be_db.path == f"/{other.node_seq}/{rd.node_seq}/{be.node_seq}" and be_db.level == 3
+
+
+async def test_move_to_root(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _service(db)
+        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
+        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
+        moved = await svc.move(rd.id, None)
+        assert moved.parent_id is None and moved.level == 1 and moved.path == f"/{rd.node_seq}"
+
+
+async def test_move_circular_rejected(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _service(db)
+        root = await svc.create(DepartmentCreate(name="总部", code="HQ"))
+        rd = await svc.create(DepartmentCreate(name="研发", code="RD", parent_id=root.id))
+        # 把 root 移到 rd 之下 → 循环
+        with pytest.raises(BusinessException):
+            await svc.move(root.id, rd.id)
+
+
+async def test_move_exceeds_5levels_rejected(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _service(db)
+        prev = await svc.create(DepartmentCreate(name="L1", code="C1"))
+        chain_root = prev
+        for i in range(4):
+            prev = await svc.create(DepartmentCreate(name=f"L{i+2}", code=f"C{i+2}", parent_id=prev.id))
+        # chain_root.level==1,后代最深 L5;把 chain_root 子树挂到 root2 下 → root2.level1, chain_root 变 2,后代变 6 → 超限
+        root2 = await svc.create(DepartmentCreate(name="R2", code="R2"))
+        with pytest.raises(BusinessException):
+            await svc.move(chain_root.id, root2.id)
\ No newline at end of file
