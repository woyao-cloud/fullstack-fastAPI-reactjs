# Task 9 报告：API 路由 + main 注册 + seed 扩展

## Status: DONE

## Commit
- SHA: `09d9b37`
- Subject: `feat(dept): 部门 API 路由 + main 注册 + seed dept 权限`
- Branch: `feat/department-management`

## 测试摘要
`uv run pytest tests/test_departments_api.py -v` → 6 passed；全套件 `uv run pytest` → 60 passed。

## 变更文件
1. **新建** `app/interfaces/api/departments.py` — 部门路由，9 个端点，全部以 `require_permission("dept:*")` 守卫。
2. **修改** `app/main.py` — 在 `from app.interfaces.api import ...` 增加 `departments`；在 `users` 路由注册后追加 `app.include_router(departments.router, prefix=settings.API_V1_PREFIX)`。
3. **修改** `tests/conftest.py` — `seed` fixture 的 `perms` 列表追加 `dept:read/create/update/delete` 4 条权限（ADMIN 通过 `admin.permissions = perms` 自动绑定）；`client` fixture 内追加 `app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()` 的缓存覆盖。
4. **新建** `tests/test_departments_api.py` — 6 个 API 集成测试。

## 端点清单（前缀 `/api/v1/departments`）
| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/tree` | dept:read | 全量树 |
| GET | `/{dept_id}/subtree` | dept:read | 子树 |
| GET | `` (空) | dept:read | 分页列表 |
| GET | `/{dept_id}` | dept:read | 单个详情 |
| POST | `` | dept:create | 创建（201） |
| PUT | `/{dept_id}` | dept:update | 更新 |
| POST | `/{dept_id}/move` | dept:update | 移动 |
| DELETE | `/{dept_id}` | dept:delete | 删除（204） |
| GET | `/{dept_id}/users` | dept:read | 部门下用户（`response_model=list`） |

## 测试用例
1. `test_create_and_get_tree` — 创建顶级部门（level==1），树端点返回该节点。
2. `test_create_code_conflict` — 重复 code → 409。
3. `test_move_endpoint` — RD 从 HQ 移到 SL 下，parent_id 更新成功。
4. `test_delete_with_children_409` — 有子部门时 DELETE → 409。
5. `test_regular_user_forbidden` — 无 dept:create 权限的普通用户 → 403。
6. `test_list_users_endpoint` — 空部门 list users → 200 `[]`。

## 设计说明
- `_svc(db, cache)` 工厂在路由层组装 `DepartmentService(db, DepartmentRepository(db), cache)`，符合 brief。
- `list_dept_users` 按 brief 使用 `response_model=list`，函数内 `from app.application.schemas.user import UserOut` 导入（服务层已返回 `UserOut` 列表，FastAPI 直接序列化）。
- conftest cache override 用同步 lambda 返回 `NoopDepartmentCache()`，FastAPI 接受同步依赖覆盖；该 override 在 `app.dependency_overrides.clear()` 之前生效。
- `admin_token` fixture 的 admin 用户通过直接 DB 操作追加 ADMIN 角色，而 ADMIN 在 seed 阶段已绑定全部 dept:* 权限，因此 dept 端点对 admin 可访问。

## 关注点
- 无功能性问题。
- SQLite DROP 时存在 `department ↔ user_account` 外键循环依赖警告（既有，非本次引入），仅日志噪声。
- 部分非 async 测试带 `pytest.mark.asyncio` 警告（既有，非本次引入）。

## Self-Review
- 完整性：9 端点全部 dept:* 权限守卫；main 已注册；conftest seed + cache override 已加；6 测试覆盖 create+tree、code conflict、move、delete-with-children 409、regular-user 403、list-users empty。
- 质量：路由简洁，复用 `_svc` 工厂；遵循 brief；无过度工程。
- 测试：先写测试 → 失败（404/KeyError）→ 实现 → 通过 → 全套件 60 passed。