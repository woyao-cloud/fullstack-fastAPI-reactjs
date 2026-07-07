# Task 3 Report — UserService.list/get 集成 current_user 过滤

## Status
DONE

## Commit
- SHA: `d6238996b2dcfe46b2346714f9330d3361e39534`
- Subject: `feat(dataperm): UserService.list/get 集成 current_user 过滤`
- Branch: `feat/data-permission`

## Changes

### 1. `app/repositories/user_repository.py`
- 新增 `list_from_stmt(stmt, page, size) -> tuple[Sequence[User], int]`:
  - `total` 通过 `select(func.count()).select_from(stmt.subquery())` 计算已过滤 stmt 的行数。
  - 分页通过 `stmt.offset(offset).limit(size)` 实现。
  - 返回 `result.unique().scalars().all(), total`。
- 顶部 `from sqlalchemy import func, select` 已存在,无需补充。
- 保留原 `list`、`get_by_id`、`add`、`delete`、`assign_role`、`count` 不变。

### 2. `app/application/services/user_service.py`
- 新增 import:
  - `from app.application.services.data_permission_filter import DataPermissionFilter`
  - `from app.repositories.department_repository import DepartmentRepository`
- `__init__` 末尾追加 `self.filter = DataPermissionFilter(db, DepartmentRepository(db))`。
- 重写 `list(page, size, current_user=None)`:
  - `stmt = User.with_roles()`,若 `current_user is not None` 则 `stmt = await self.filter.apply(stmt, current_user)`,再 `self.users.list_from_stmt(stmt, page, size)`。
- 重写 `get(user_id, current_user=None)`:
  - `stmt = User.with_roles().where(User.id == user_id)`,可过滤,执行后 `None → NotFoundError("用户不存在")`。被过滤掉的用户返回 404,不泄露存在性。
- `create`/`update`/`delete`/`assign_role` 完全不变。

### 3. `tests/test_data_permission.py`
末尾追加 4 个 service 集成测试:
- `test_service_list_filtered_self`:SELF scope 用户只能看到 `created_by=me` 的用户,total == 1。
- `test_service_list_no_current_user_no_filter`:`current_user=None` 不过滤,total >= 2。
- `test_service_get_filtered_returns_404`:SELF scope 用户查非自己创建的用户 → `NotFoundError`。
- `test_service_get_self_can_see_own`:`current_user=None` 向后兼容能查。

## Testing

### 步骤 2(写完测试,实现前)
```
4 failed, 10 passed
```
新 4 用例 `TypeError: UserService.list/get() got an unexpected keyword argument 'current_user'`。

### 步骤 5(实现后)
```
uv run pytest tests/test_data_permission.py -v
14 passed, 14 warnings in 6.72s
```

### 全量回归
```
uv run pytest
128 passed, 112 warnings in 35.28s
```
无回归。

## Self-Review
- Completeness: ✓ list_from_stmt count via subquery + offset/limit;list/get 接 current_user;None → 不过滤;get 过滤 → 404。
- Quality: ✓ 复用 `User.with_roles()` 与 `DataPermissionFilter`;count 基于子查询保证过滤后总数正确。
- Discipline: ✓ `create`/`update`/`delete`/`assign_role` 未改;原 `UserRepository.list` 保留向后兼容。
- Testing: ✓ 真实 DB(engine + seed fixtures);测试输出干净(仅 SQLAlchemy DROP 排序警告,与本次改动无关)。

## Concerns
无。

## Report File
D:/claude-code-project/fullstack-fastAPI-reactjs/.superpowers/sdd/dp-task-3-report.md