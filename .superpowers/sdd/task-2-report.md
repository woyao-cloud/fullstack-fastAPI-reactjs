# Task 2 Report — DepartmentRepository

## Status: DONE

## What I Implemented

Created `app/repositories/department_repository.py` with the `DepartmentRepository` class taking an `AsyncSession`, exposing all 10 brief-mandated methods:

- `next_node_seq()` — `coalesce(max(node_seq),0)+1`
- `get_by_id(id)` — `db.get(Department, id)`
- `get_by_code(code)` — `select.where(code==code)`
- `list_active()` — `status=="ACTIVE"`, order `sort_order, code`
- `find_subtree(root_path)` — `path LIKE root_path%`
- `count_children(parent_id)` — count of departments with that parent_id
- `count_users(dept_id)` — count of users with that department_id
- `max_descendant_depth(root_path, root_level)` — `max(level)` over `path LIKE root_path/%` (excludes self), returns `max_level - root_level` or 0
- `add(dept)` — add/flush/refresh
- `replace_subtree_paths(old_prefix, new_prefix, level_delta, root_path)` — `UPDATE ... WHERE path LIKE root_path%` with `func.replace(path, old_prefix, new_prefix)` and `level + level_delta`

Followed the established `UserRepository`/`RoleRepository` pattern (class with `db: AsyncSession`, `select`/`func` style). No extra methods or fields. Repository does not commit — service layer commits.

## Files Changed

- `D:\claude-code-project\fullstack-fastAPI-reactjs\user-service\back-end\app\repositories\department_repository.py` (new, 62 lines)
- `D:\claude-code-project\fullstack-fastAPI-reactjs\user-service\back-end\tests\test_department_repository.py` (new, 120 lines)

## TDD Evidence

RED (verified by temporarily renaming the repo module to `.bak`):

```
ERROR collecting tests/test_department_repository.py
E   ModuleNotFoundError: No module named 'app.repositories.department_repository'
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
```

GREEN (after restoring module):

```
tests\test_department_repository.py ......                               [100%]
======================== 6 passed, 6 warnings in 0.71s ========================
```

Full suite regression check: `26 passed, 26 warnings in 10.02s` — no regressions.

## Test-Code Deviations from the Brief

Only one: the brief's Chinese string literals were mojibake-corrupted in the markdown (e.g., `鎬婚儴` instead of `总部`). I replaced them with the correct UTF-8 Chinese strings (`总部`, `研发`, `其他`, `后端`) to match the model layer's intent. No structural/logic changes — all signatures, assertions, and test behavior are verbatim from the brief.

## Self-Review Findings

- Completeness: all 10 methods present with exact signatures. ✅
- Quality: matches `UserRepository` style (single `db` attr, `select`/`func` usage, no commits). ✅
- Discipline: no extra methods, no extra fields, no scope creep. ✅
- Testing: tests exercise real SQLite DB via `engine` fixture; no mocks. ✅
- Output: pristine (only pre-existing FK-cycle SAWarning about DROP ordering, unrelated to this task).

## Concerns

- The pre-existing SAWarning about unresolvable FK cycle between `department` and `user_account` (DROP ordering on SQLite) shows up in test output. It's cosmetic and pre-dates this task (department.manager_id → user_account.id, user_account.department_id → department.id). Not blocking; could be addressed later with `use_alter=True` if desired.

## Commit

`40e78a1 feat(dept): DepartmentRepository(CRUD/子树/计数/路径批量更新)`
## Fix-Report: replace_subtree_paths 严格前缀替换

**问题**: `replace_subtree_paths` 原用 SQL `func.replace(path, old_prefix, new_prefix)`,而 SQL `REPLACE()` 是全局子串替换,不是严格前缀替换。当 `old_prefix` 作为非首段子串出现时会误伤 - 例如子树 `/1` 下后代 `/1/10/11`,`REPLACE('/1/10/11','/1','/9')` 错误得到 `/9/90/91`,应为 `/9/10/11`。多位 `node_seq`(10+) 是常见场景,`move` 操作会破坏路径数据。

**修复**: 改为 Python 端严格前缀替换 - 拉取 `path LIKE root_path%` 的子树行,逐行 `dept.path = new_prefix + dept.path[len(old_prefix):]` 并 `dept.level += level_delta`,然后 `flush`。跨数据库(SQLite/PostgreSQL)一致且显然正确。方法签名不变。同时移除不再使用的 `update` 导入。

**覆盖回归测试**: `tests/test_department_repository.py::test_replace_subtree_paths_multidigit` 构造 `node_seq=1/10/100` 三层路径 `/1`、`/1/10`、`/1/10/100`,以 `old_prefix="/1"`,`new_prefix="/9"`,`level_delta=1` 调用,断言:
- `d1.path == "/9"`、`level == 2`
- `d10.path == "/9/10"`、`level == 3`  (不被误改为 `/9/90`)
- `d100.path == "/9/10/100"`、`level == 4`  (不被误改为 `/9/90/900`)

**命令与结果**:

- RED(修复前,新测试对旧实现):
  `uv run pytest tests/test_department_repository.py::test_replace_subtree_paths_multidigit -v`
  -> FAILED, `AssertionError: assert ('/9/90' == '/9/10')`,证实多位误伤。
- GREEN(修复后,本仓库测试文件):
  `uv run pytest tests/test_department_repository.py -v`
  -> 7 passed (含原有 6 + 新增 1)。
- 全量回归:
  `uv run pytest`
  -> 27 passed, 无失败。

**改动文件**:
- `user-service/back-end/app/repositories/department_repository.py`
- `user-service/back-end/tests/test_department_repository.py`

**Commit**: `fix(dept): replace_subtree_paths 严格前缀替换,修复多位 node_seq 误伤` (HEAD of feat/department-management)
