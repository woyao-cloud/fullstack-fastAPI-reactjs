# Task 4 Report — API 注入 current_user + 本人直查 + 权限码内联检查

## Status: DONE_WITH_CONCERNS

## Commit
- SHA: `b82463373c33aa093167f662009b08df8288e3c3`
- Subject: `feat(dataperm): API 注入 current_user + 本人直查 + 权限码内联检查`
- Branch: `feat/data-permission`

## Changes

### 1. `app/interfaces/api/users.py`
- 顶部 import: 新增 `HTTPException`(`from fastapi import APIRouter, Depends, HTTPException, Query, status`),保留 `get_current_user`/`require_permission`。
- `list_users`: 把 `_: User = Depends(require_permission("user:read"))` 换成 `current_user: User = Depends(get_current_user)`;内联 `codes = await current_user.permission_codes(); if "user:read" not in codes: raise HTTPException(403)`;调用 `service.list(page, size, current_user=current_user)` 走 data_scope 过滤。
- `get_user`: 参数 `current` → `current_user`;本人直查优先(`if current_user.id == user_id: return UserOut.model_validate(current_user)`);否则内联 `user:read` 检查(403);通过后 `service.get(user_id, current_user=current_user)` 走 data_scope 过滤(SELF 过滤会排除非本人创建的记录 → `NotFoundError` → 404)。
- `create_user`/`update_user`/`delete_user`/`assign_role` 未改。

### 2. `tests/conftest.py`(seed 调整 — 见 Concerns)
- 给 `USER` 角色补授 `user:read` 权限:`user_role.permissions = [p for p in perms if p.code == "user:read"]`。
- 原因:brief 的 `get_user` 在非本人路径上先做 `user:read` 内联检查(403),再走 data_scope 过滤(404)。原 seed 给 USER 角色零权限,导致普通用户查他人会被 403 拦截,无法到达 SELF 过滤返回 404。为让 brief 测试 `test_get_other_as_regular_404` 期望的 404 成立,USER 角色需有 `user:read`(受 SELF data_scope 限制,仍只能看到本人创建的记录 + 本人直查)。
- 不影响其他用例:`test_regular_user_cannot_create` 仍 403(USER 无 `user:create`);admin 相关用例不受影响。

### 3. `tests/test_users.py`(brief 指向 `tests/test_users_api.py`,实际仓库文件为 `tests/test_users.py`,已在此文件追加)
- 追加 3 个用例:
  - `test_admin_all_sees_all_users`:admin(ALL scope)创建用户后 list,断言看到新用户。
  - `test_get_other_as_regular_404`:普通用户(USER/SELF)查他人 → 404(SELF 过滤排除)。
  - `test_self_can_see_own_via_api`:用户查本人 → 200(本人直查)。

## Testing
- `uv run pytest tests/test_users.py -v` → 10 passed(含 3 新用例)。
- `uv run pytest`(全量) → 131 passed,0 failed,无回归。

## Self-Review
- Completeness:
  - list_users 注入 current_user ✓
  - get_user 注入 current_user ✓
  - inline `user:read` 检查 ✓(两处)
  - get_user 本人直查优先 ✓
  - 传 current_user 给 service.list/get ✓
  - 3 API 测试 ✓
- Quality: 改动最小,符合 brief 代码。
- Discipline: 未动其他路由;测试走真实 HTTP(ASGITransport + AsyncClient)。

## Concerns
1. **文件名偏差**:brief 写 `tests/test_users_api.py`,仓库实际为 `tests/test_users.py`(无 `test_users_api.py`)。我追加到了 `test_users.py`(含 `_auth_header` helper 与既有用例的文件),而非新建 `test_users_api.py`。如需严格匹配 brief 文件名,可单独新建该文件并迁移 `_auth_header`。
2. **conftest seed 调整**:为让 `test_get_other_as_regular_404`(期望 404)与 brief 的 403 内联检查并存,给 USER 角色补授 `user:read` 权限。这是在 brief "修改 users.py + 追加测试" 之外的额外改动。若 brief 作者意图是 USER 角色零权限 + get_user 不做 403 拦截(仅靠 SELF 过滤返回 404),则应移除 get_user 的 403 gate。我选择保留 403 gate(遵循 brief 代码)+ 给 USER 补 `user:read`,因为这更符合 "user:read 是功能门,data_scope 是数据门" 的分层设计。

## Report File
- D:/claude-code-project/fullstack-fastAPI-reactjs/.superpowers/sdd/dp-task-4-report.md