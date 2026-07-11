## Task 8: DepartmentService — get_tree / get_subtree / list_users

**Files:**
- Modify: `app/application/services/department_service.py`(补方法)
- Modify: `app/application/schemas/department.py`(无需改,已有 TreeNode/Out)
- Test: `tests/test_department_service.py`(追加用例)

**Interfaces:**
- Produces:
  - `async get_tree() -> list[DepartmentTreeNode]`
  - `async get_subtree(root_id: uuid.UUID) -> list[DepartmentTreeNode]`
  - `async list_users(dept_id: uuid.UUID) -> list[UserOut]`

- [ ] **Step 1: 写失败测试(追加)**

```python
# tests/test_department_service.py —— 末尾追加
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: 4 个新用例 FAIL

- [ ] **Step 3: 实现 get_tree/get_subtree/list_users(追加到类)**

```python
# app/application/services/department_service.py —— 顶部导入补充
from app.application.schemas.department import DepartmentTreeNode
from app.application.schemas.user import UserOut
from app.domain.models.user import User
from sqlalchemy import select

# —— 类内追加方法 ——
    @staticmethod
    def _build_tree(flat: list[Department]) -> list[DepartmentTreeNode]:
        nodes: dict[uuid.UUID, DepartmentTreeNode] = {}
        for d in flat:
            nodes[d.id] = DepartmentTreeNode(
                id=d.id, node_seq=d.node_seq, name=d.name, code=d.code,
                parent_id=d.parent_id, level=d.level, path=d.path,
                sort_order=d.sort_order, manager_id=d.manager_id, status=d.status,
                created_at=d.created_at, updated_at=d.updated_at, children=[],
            )
        roots: list[DepartmentTreeNode] = []
        for d in flat:
            node = nodes[d.id]
            if d.parent_id is not None and d.parent_id in nodes:
                nodes[d.parent_id].children.append(node)
            else:
                roots.append(node)
        return roots

    async def get_tree(self) -> list[DepartmentTreeNode]:
        cached = await self.cache.get_tree()
        if cached is not None:
            return [DepartmentTreeNode.model_validate(n) for n in cached]
        flat = await self.repo.list_active()
        tree = self._build_tree(flat)
        await self.cache.set_tree([n.model_dump() for n in tree])
        return tree

    async def get_subtree(self, root_id: uuid.UUID) -> list[DepartmentTreeNode]:
        root = await self._get_or_404(root_id)
        flat = await self.repo.find_subtree(root.path)
        # 以 root 为根组装
        nodes: dict[uuid.UUID, DepartmentTreeNode] = {}
        for d in flat:
            nodes[d.id] = DepartmentTreeNode(
                id=d.id, node_seq=d.node_seq, name=d.name, code=d.code,
                parent_id=d.parent_id, level=d.level, path=d.path,
                sort_order=d.sort_order, manager_id=d.manager_id, status=d.status,
                created_at=d.created_at, updated_at=d.updated_at, children=[],
            )
        roots: list[DepartmentTreeNode] = []
        for d in flat:
            node = nodes[d.id]
            if d.id == root.id:
                roots.append(node)
            elif d.parent_id is not None and d.parent_id in nodes:
                nodes[d.parent_id].children.append(node)
        return roots

    async def list_users(self, dept_id: uuid.UUID) -> list[UserOut]:
        await self._get_or_404(dept_id)
        result = await self.db.execute(select(User).where(User.department_id == dept_id))
        return [UserOut.model_validate(u) for u in result.scalars().all()]
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_department_service.py -v`
Expected: PASS(17 passed)

- [ ] **Step 5: 提交**

```bash
git add app/application/services/department_service.py tests/test_department_service.py
git commit -m "feat(dept): DepartmentService.get_tree/get_subtree/list_users(Cache Aside)"
```

---

