# Task 9 报告 — 配置 + 模板 API 路由 + main 注册 + seed 扩展

## Status: DONE

## Commit
- SHA: `cbb531efa0f7a8d5368be8e1231f5db578866415`
- Subject: `feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展`
- Branch: `feat/system-config`

## 测试
- 目标测试: `uv run pytest tests/test_system_config_api.py tests/test_email_templates_api.py -v` → **8 passed** (6 配置 + 2 模板)
- 全量回归: `uv run pytest` → **112 passed**, 0 failed

## 完成内容

### 新增文件
- `app/interfaces/api/system_config.py` — 配置路由(`/config/groups`、`/config`、`/config/{key}` GET、`/config/{key}` PUT、`/config/init` POST、`/config/history`)。SECRET 字段值在 `get_group`/`get_value`/`history` 中掩码为 `"***"`。所有端点带 `require_permission` 守卫(`config:read` / `config:update`)。
- `app/interfaces/api/email_templates.py` — 模板 CRUD 路由(list / get / create / update / delete),响应模型 `EmailTemplateOut` / `EmailTemplateListOut`,201/204 状态码。权限守卫 `template:read|create|update|delete`。
- `tests/test_system_config_api.py` — 6 个测试:init + GET group 掩码、list groups、PUT 校验失败(400)、PUT secret + GET 单 key 掩码、history、普通用户 403。
- `tests/test_email_templates_api.py` — 2 个测试:CRUD 全流程、template_code 冲突 409。

### 修改文件
- `app/main.py` — `from app.interfaces.api import ...` 追加 `system_config, email_templates`;新增两个 `include_router(..., prefix=settings.API_V1_PREFIX)`。
- `tests/conftest.py` — `seed` fixture 的 `perms` 追加 6 项(config:read/update、template:read/create/update/delete);`client` fixture 增加 `app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()`。

## 关键实现说明

### 路由顺序修正(对 brief 的必要偏离)
Brief 中 `GET /config/{key}` 声明在 `GET /config/history` 之前。FastAPI 按声明顺序匹配,`/config/history` 会被 `/{key}` 先捕获并以 `key="history"` 调用 `group_of_key` → `ValueError` → 400。为让 `test_history` 通过,我将 `GET /config/history` 移到 `GET /config/{key}` 之前声明。这是 FastAPI 路由匹配语义要求的修正,功能与 brief 意图一致。

### SECRET 掩码
- `_mask(values, group)`:遍历 values,用 `GROUP_MODELS[group].model_fields[k].annotation` 检测 `SecretStr`,命中则替换为 `"***"`。
- `get_value`:同样按字段 annotation 判断,SECRET 字段返回 `"***"`。
- `history`:同字段判断,对 `old_value`/`new_value` 都做掩码。

### conftest cache override
`get_config_cache` 在测试中被覆盖为 `LocalTTLCache()` 实例,避免触碰 Redis 依赖;`_encryption_key` autouse fixture 已存在,提供 `CONFIG_ENCRYPTION_KEY`。

## 自审
- 完整性:6 配置端点 + 5 模板端点 + main 注册 + conftest seed + cache override ✓
- SECRET 掩码 `"***"`(group/value/history)✓
- 权限守卫全覆盖 ✓
- 8 API 测试通过 ✓
- 全量 112 测试无回归 ✓
- 真实 HTTP via `AsyncClient` + `ASGITransport` ✓
- 输出洁净(仅既有非阻塞 warnings)✓

## Concerns
无。偏离 brief 的路由顺序修正已在报告中说明,是功能正确性所必需。