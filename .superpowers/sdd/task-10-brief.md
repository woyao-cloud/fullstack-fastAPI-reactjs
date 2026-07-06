## Task 10: 全量回归 + 覆盖率 + ruff

**Files:** 无新增(验证性任务)

- [ ] **Step 1: 全量测试 + 覆盖率**

Run: `uv run pytest --cov=app --cov-report=term-missing`
Expected: 全部 PASS;`app.application.services.department_service`、`app.repositories.department_repository`、`app.interfaces.api.departments` 覆盖率 ≥ 85%;TOTAL ≥ 85%。

- [ ] **Step 2: ruff 检查**

Run: `uv run ruff check app tests`
Expected: 无 error(若有 E501 等,按提示修复:换行/缩短)。

- [ ] **Step 3: 修复任何失败后再次运行**

如 Step 1/2 失败,修复后重跑直至 PASS 且无 ruff error。

- [ ] **Step 4: 提交(如有修复)**

```bash
git add -A
git commit -m "test(dept): 全量回归通过,覆盖率≥85%,ruff 清零"
```

- [ ] **Step 5: 验证 OpenAPI 文档可访问(可选冒烟)**

Run: `uv run python -c "from app.main import app; print([r.path for r in app.routes if 'departments' in getattr(r,'path','')])"`
Expected: 输出包含 `/api/v1/departments`、`/api/v1/departments/tree`、`/api/v1/departments/{dept_id}/move` 等。

---

## Self-Review 结论

**Spec coverage**:
- §3 模块边界 → Task 1-9 文件结构对应 ✓
- §4 数据模型 → Task 1 ✓
- §5 缓存层 → Task 3、Task 4 ✓
- §6 业务层(create/update/move/delete/get_tree/get_subtree/list_users)→ Task 6、7、8 ✓
- §7 API → Task 9 ✓
- §8 错误处理 → 各 service 任务内异常 + Task 9 路由 ✓
- §9 测试矩阵 → Task 6-9 测试覆盖矩阵各用例 ✓

**Placeholder scan**:无 TBD/TODO;每步含完整代码与命令。

**Type consistency**:`DepartmentCache` 方法名、`DepartmentRepository` 方法名、`DepartmentService` 方法签名、schema 类名在各任务间一致;`move(dept_id, new_parent_id)` 与路由 `DepartmentMove.parent_id` 对齐;`list_users` 返回 `UserOut` 与 `app.application.schemas.user.UserOut` 一致。
