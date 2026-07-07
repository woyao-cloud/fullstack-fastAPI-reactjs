# Task 1 Report: SystemConfig / ConfigHistory / EmailTemplate 模型

## 已实现

按 brief 原文实现了三个 SQLAlchemy 模型，注册到 `Base.metadata`，并通过测试验证列集合与唯一约束。

### 文件变更
- 新建 `app/domain/models/system_config.py`：`SystemConfig`、`ConfigHistory`、`EmailTemplate` 三个模型，字段与 brief 完全一致。
  - `SystemConfig`：`id`(UUID PK)、`config_key`(String 100, unique+index)、`config_value`(Text)、`config_group`(String 50, index)、`config_type`(String 20)、`is_encrypted`(Boolean)、`description`(String 500, nullable)、`updated_by`(UUID FK→user_account.id, nullable)。
  - `ConfigHistory`：`id`、`config_key`(index)、`old_value`(Text nullable)、`new_value`(Text nullable)、`changed_by`(UUID)、`changed_at`(DateTime tz)。
  - `EmailTemplate`：`id`、`template_code`(String 50, unique)、`template_name`、`subject`、`content`(Text)、`variables`(JSON nullable)、`is_active`(Boolean)。
  - 三者均继承 `Base`，自动获得 `created_at`/`updated_at`。
- 修改 `app/main.py`：在模型注册块追加 `import app.domain.models.system_config  # noqa: F401`。
- 新建 `tests/test_system_config_model.py`：按 brief 原文，三组列集合断言 + `config_key`/`template_code` 唯一性断言（直接基于 `Base.metadata.tables` 检查）。

## TDD 证据
- RED：`uv run pytest tests/test_system_config_model.py -v` → `ModuleNotFoundError: No module named 'app.domain.models.system_config'`（模型尚未创建时收集失败）。
- GREEN：创建模型并在 `main.py` 注册后，`uv run pytest tests/test_system_config_model.py -v` → `3 passed`。
- 全量回归：`uv run pytest` → `72 passed`，无回归。

## 提交
- SHA: `cae42721a36a56fbcc01621fc9d6bae521e99434`
- Subject: `feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型`
- Branch: `feat/system-config`

## Self-Review
- 完整性：3 个模型、列与 brief 一一对应；`config_key`/`template_code` 唯一；`config_group`/`config_key`(history)/`changed_at`（注：brief 中 ConfigHistory 仅 `config_key` 显式 index，`changed_at` 未显式 index，已按 brief 原文实现，未额外加索引）；`variables` 用 `sqlalchemy.JSON`。
- 风格一致性：与现有 `department.py`/`user.py` 同样的 `Mapped` + `mapped_column` + `Uuid` 跨 DB 写法，继承 `Base`。
- 纪律：未新增任何额外字段、表或索引；测试仅做 metadata 检视，未引入新依赖。
- 测试：通过真实 `Base.metadata.tables` 检查列集合与 `unique` 标志，不依赖运行时建表。

## 关注点
- 测试中 `pytestmark = pytest.mark.asyncio` 但用例均为同步，pytest 产生 PytestWarning（与现有 `test_department_model.py` 同样的已知现象，非本次回归）。
- brief 描述中提到 `ConfigHistory.config_key + changed_at` 索引；brief 代码原文仅 `config_key` 显式 `index=True`，`changed_at` 未加 `index=True`。已严格按 brief 代码原文实现；若需复合索引需后续任务补充。
- `updated_by` 外键指向 `user_account.id`，已确认 user 模型表名为 `user_account`。

## Fix-Report (C1 评审整改 — `ConfigHistory.changed_at` 索引)

### 评审发现
C1 评审 (review-cfg1-5b85747-cae4272) 指出：`app/domain/models/system_config.py` 第 37 行 `ConfigHistory.changed_at` 缺少 `index=True`。规范 §4.2 与计划正文均要求 `ConfigHistory.config_key + changed_at` 建索引；仅计划代码块漏写。

### 变更内容
- `app/domain/models/system_config.py`：`changed_at` 由 `mapped_column(DateTime(timezone=True), nullable=False)` 改为 `mapped_column(DateTime(timezone=True), index=True, nullable=False)`，保留时区与 NOT NULL，新增单列索引。
- `tests/test_system_config_model.py::test_config_history_columns`：新增断言 `Base.metadata.tables["config_history"].columns["changed_at"].index is True`，防止回归。

### 测试结果
- 目标测试：`uv run pytest tests/test_system_config_model.py -v` → `3 passed`（含新增 index 断言）。
- 全量回归：`uv run pytest` → `72 passed, 66 warnings in 28.78s`，无回归。

### 提交
- SHA: `d1e9ac1562fa20aa390b53f6ba4c8694a9863ffe`
- Subject: `fix(config): ConfigHistory.changed_at 加索引 + 测试断言`
- Branch: `feat/system-config`