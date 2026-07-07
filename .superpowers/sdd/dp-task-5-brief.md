## Task 5: 全量回归 + 覆盖率 + ruff

**Files:** 无新增(验证性任务)

- [ ] **Step 1: 全量测试 + 覆盖率**

Run: `uv run pytest --cov=app --cov-report=term-missing`
Expected: 全部 PASS;`app.application.services.data_permission_filter` ≥90%;TOTAL ≥85%。

- [ ] **Step 2: ruff**

Run: `uv run ruff check app tests`
Expected: 0 errors。

- [ ] **Step 3: 修复失败后再次运行至全绿**

- [ ] **Step 4: 提交(如有修复)**

```bash
git add -A
git commit -m "test(dataperm): 全量回归通过,覆盖率≥85%,ruff 清零"
```

---

## Self-Review 结论

**Spec coverage**:
- §3 模块边界 → Task 1-4 文件结构 ✓
- §4 数据模型(created_by)→ Task 1 ✓
- §5 DataPermissionFilter + 有效范围 → Task 2 ✓
- §6 UserService/API 集成 → Task 3、4 ✓
- §7 错误处理(404 不泄露、空集 false())→ Task 2/3 测试 ✓
- §8 测试矩阵 → Task 1/2/3/4 测试覆盖各用例 ✓

**Placeholder scan**:无 TBD/TODO;每步含完整代码与命令。Task 4 Step 1 的笔误已标注并用正确版本替代。

**Type一致性**:`DataPermissionFilter(db, dept_repo).apply(stmt, current_user)` 跨 Task 2/3 一致;`UserService.list/get(current_user=None)` 跨 Task 3/4 一致;`UserRepository.list_from_stmt(stmt, page, size)` 跨 Task 3 一致;`DepartmentRepository.get_sub_department_ids(dept_id)` 跨 Task 2 一致;`_effective_scope` staticmethod 跨 Task 2 一致。
