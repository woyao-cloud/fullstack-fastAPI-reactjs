## Task 7: DepartmentService — move

**Files:**
- Modify: `app/application/services/department_service.py`(补 `move`)
- Test: `tests/test_department_service.py`(追加 move 用例)

**Interfaces:**
- Produces:`async move(dept_id: uuid.UUID, new_parent_id: uuid.UUID | None) -> Department`。

- [ ] **Step 1: 写失败测试(追加)**

```python
# tests/test_department_service.py —— 末尾追加
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
        for i in range(4):
            prev = await svc.create(DepartmentCreate(name=f"L{i+2}", code=f"C{i+2}", parent_id=prev.id))
        # prev.level==5;另起一棵 root2,把 prev 子树挂到 root2 下 → root2.level1, prev 变 2,后代变 6 → 超限
        root2 = await svc.create(DepartmentCreate(name="R2", code="R2"))
        with pytest.raises(BusinessException):
            await svc.move(prev.id, root2.id)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: 4 个新用例 FAIL(AttributeError: move 方法不存在)

- [ ] **Step 3: 实现 move(追加到 DepartmentService 类)**

```python
# app/application/services/department_service.py —— 在 delete 方法后追加
    async def move(self, dept_id: uuid.UUID, new_parent_id: uuid.UUID | None) -> Department:
        dept = await self._get_or_404(dept_id)
        old_path = dept.path
        old_level = dept.level

        if new_parent_id is None:
            new_parent = None
            new_level = 1
            new_prefix = f"/{dept.node_seq}"
        else:
            if new_parent_id == dept_id:
                raise BusinessException("不能将部门移动到自身之下")
            new_parent = await self.repo.get_by_id(new_parent_id)
            if new_parent is None:
                raise NotFoundError("父部门不存在")
            # 防循环:新父不能是自身或自身后代
            if new_parent.path == old_path or new_parent.path.startswith(old_path + "/"):
                raise BusinessException("不能形成循环依赖")
            new_level = new_parent.level + 1
            new_prefix = f"{new_parent.path}/{dept.node_seq}"

        # 深度校验:移动后子树最大深度不超过 5
        max_depth = await self.repo.max_descendant_depth(old_path, old_level)
        if new_level + max_depth > MAX_LEVEL:
            raise BusinessException("移动后层级超过 5 级限制")

        level_delta = new_level - old_level
        # 注意:replace_subtree_paths 用 dept.path 作为根前缀;先把自身 path 换好再批量
        async with self.db.begin():
            dept.parent_id = new_parent_id if new_parent else None
            dept.level = new_level
            dept.path = new_prefix
            await self.db.flush()
            # 批量更新后代(排除自身,自身已更新)
            await self.repo.replace_subtree_paths(
                old_prefix=old_path, new_prefix=new_prefix,
                level_delta=level_delta, root_path=old_path + "/",
            )
            await self.db.refresh(dept)
        await self.cache.invalidate()
        return dept
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: PASS(13 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/services/department_service.py tests/test_department_service.py
git commit -m "feat(dept): DepartmentService.move(防循环/深度校验/子树批量路径更新)"
```

---

