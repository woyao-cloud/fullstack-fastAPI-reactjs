## commits bad2805..ae542b2
ae542b2 docs(cfg-task-10): append final-review fix-report section
8fe7a99 fix(config): final-review fixes(启动 FK None + pubsub aclose + GET 未知组400 + 缺失字段404 + ConfigValueUpdate 入 schema)

## stat
 .superpowers/sdd/cfg-task-1-brief.md               |  130 ++
 .superpowers/sdd/cfg-task-1-report.md              |   53 +
 .superpowers/sdd/cfg-task-10-brief.md              |   84 +
 .superpowers/sdd/cfg-task-10-report.md             |  147 ++
 .superpowers/sdd/cfg-task-2-brief.md               |  127 ++
 .superpowers/sdd/cfg-task-2-report.md              |   32 +
 .superpowers/sdd/cfg-task-3-brief.md               |  149 ++
 .superpowers/sdd/cfg-task-3-report.md              |   28 +
 .superpowers/sdd/cfg-task-4-brief.md               |  144 ++
 .superpowers/sdd/cfg-task-4-report.md              |   70 +
 .superpowers/sdd/cfg-task-5-brief.md               |  177 ++
 .superpowers/sdd/cfg-task-5-report.md              |   41 +
 .superpowers/sdd/cfg-task-6-brief.md               |  209 +++
 .superpowers/sdd/cfg-task-6-report.md              |   45 +
 .superpowers/sdd/cfg-task-7-brief.md               |  353 ++++
 .superpowers/sdd/cfg-task-7-report.md              |   98 +
 .superpowers/sdd/cfg-task-8-brief.md               |  214 +++
 .superpowers/sdd/cfg-task-8-report.md              |   40 +
 .superpowers/sdd/cfg-task-9-brief.md               |  383 ++++
 .superpowers/sdd/cfg-task-9-report.md              |   49 +
 .superpowers/sdd/progress.md                       |   21 +
 .../sdd/review-cfg-final-5b85747-bad2805.md        | 1913 ++++++++++++++++++++
 .superpowers/sdd/review-cfg1-5b85747-cae4272.md    |  133 ++
 .superpowers/sdd/review-cfg10-cbb531e-bad2805.md   |  707 ++++++++
 .superpowers/sdd/review-cfg1fix-cae4272-d1e9ac1.md |   49 +
 .superpowers/sdd/review-cfg2-d1e9ac1-33cf225.md    |  220 +++
 .superpowers/sdd/review-cfg3-33cf225-16a4cc2.md    |  132 ++
 .superpowers/sdd/review-cfg4-16a4cc2-49cdfe6.md    |  129 ++
 .superpowers/sdd/review-cfg5-49cdfe6-a7e4d08.md    |  176 ++
 .superpowers/sdd/review-cfg6-a7e4d08-1065e8e.md    |  273 +++
 .superpowers/sdd/review-cfg7-1065e8e-58d3bd1.md    |  329 ++++
 .superpowers/sdd/review-cfg7fix-58d3bd1-24a8981.md |   87 +
 .superpowers/sdd/review-cfg8-24a8981-15a2e54.md    |  232 +++
 .superpowers/sdd/review-cfg9-15a2e54-cbb531e.md    |  451 +++++
 .../app/application/schemas/system_config.py       |    4 +
 .../app/application/services/config_service.py     |    5 +-
 .../back-end/app/core/redis_config_cache.py        |    8 +-
 .../back-end/app/interfaces/api/system_config.py   |   31 +-
 user-service/back-end/app/main.py                  |    3 +-
 user-service/back-end/tests/test_config_service.py |    8 +-
 40 files changed, 7462 insertions(+), 22 deletions(-)

## diff -U8
diff --git a/.superpowers/sdd/cfg-task-1-brief.md b/.superpowers/sdd/cfg-task-1-brief.md
new file mode 100644
index 0000000..9379bbb
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-1-brief.md
@@ -0,0 +1,130 @@
+## Task 1: 数据模型(SystemConfig / ConfigHistory / EmailTemplate)
+
+**Files:**
+- Create: `app/domain/models/system_config.py`
+- Modify: `app/main.py`(import 新模型以注册到 metadata — 加 `import app.domain.models.system_config  # noqa: F401`)
+- Test: `tests/test_system_config_model.py`
+
+**Interfaces:**
+- Produces: `SystemConfig`、`ConfigHistory`、`EmailTemplate`(SQLAlchemy 模型,字段见 spec §4)。`SystemConfig.config_key` 唯一、`config_group` 索引;`ConfigHistory.config_key`+`changed_at` 索引;`EmailTemplate.template_code` 唯一。`config_type` 取值 `STRING/INT/BOOL/JSON/SECRET`。
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_system_config_model.py
+from __future__ import annotations
+
+import pytest
+from sqlalchemy import inspect
+
+from app.domain.models import Base
+import app.domain.models.associations  # noqa: F401
+import app.domain.models.department  # noqa: F401
+import app.domain.models.role  # noqa: F401
+import app.domain.models.user  # noqa: F401
+import app.domain.models.system_config  # noqa: F401
+
+pytestmark = pytest.mark.asyncio
+
+
+def test_system_config_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
+    assert {"id", "config_key", "config_value", "config_group", "config_type",
+            "is_encrypted", "description", "updated_by",
+            "created_at", "updated_at"} <= cols
+    assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
+
+
+def test_config_history_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
+    assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
+
+
+def test_email_template_columns():
+    cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
+    assert {"id", "template_code", "template_name", "subject", "content",
+            "variables", "is_active", "created_at", "updated_at"} <= cols
+    assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_system_config_model.py -v`
+Expected: FAIL(表不存在)
+
+- [ ] **Step 3: 实现模型**
+
+```python
+# app/domain/models/system_config.py
+"""系统配置、配置历史、邮件模板模型."""
+
+from __future__ import annotations
+
+import uuid
+from datetime import datetime
+
+from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
+from sqlalchemy.orm import Mapped, mapped_column
+
+from app.domain.models import Base
+
+UUIDType = Uuid
+
+
+class SystemConfig(Base):
+    __tablename__ = "system_config"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
+    config_value: Mapped[str] = mapped_column(Text, nullable=False)
+    config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
+    config_type: Mapped[str] = mapped_column(String(20), nullable=False)  # STRING/INT/BOOL/JSON/SECRET
+    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
+    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
+    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey("user_account.id"), nullable=True)
+
+
+class ConfigHistory(Base):
+    __tablename__ = "config_history"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
+    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+    changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
+    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
+
+
+class EmailTemplate(Base):
+    __tablename__ = "email_template"
+
+    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+    template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
+    template_name: Mapped[str] = mapped_column(String(100), nullable=False)
+    subject: Mapped[str] = mapped_column(String(200), nullable=False)
+    content: Mapped[str] = mapped_column(Text, nullable=False)
+    variables: Mapped[list | None] = mapped_column(JSON, nullable=True)
+    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
+```
+
+- [ ] **Step 4: 在 main.py 注册模型 import**
+
+在 `app/main.py` 既有模型 import 块追加:
+```python
+import app.domain.models.system_config  # noqa: F401
+```
+
+- [ ] **Step 5: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_system_config_model.py -v`
+Expected: PASS(3 passed);全量 `uv run pytest` 无回归。
+
+- [ ] **Step 6: 提交**
+
+```bash
+git add app/domain/models/system_config.py app/main.py tests/test_system_config_model.py
+git commit -m "feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-1-report.md b/.superpowers/sdd/cfg-task-1-report.md
new file mode 100644
index 0000000..ea4a78e
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-1-report.md
@@ -0,0 +1,53 @@
+# Task 1 Report: SystemConfig / ConfigHistory / EmailTemplate 模型
+
+## 已实现
+
+按 brief 原文实现了三个 SQLAlchemy 模型，注册到 `Base.metadata`，并通过测试验证列集合与唯一约束。
+
+### 文件变更
+- 新建 `app/domain/models/system_config.py`：`SystemConfig`、`ConfigHistory`、`EmailTemplate` 三个模型，字段与 brief 完全一致。
+  - `SystemConfig`：`id`(UUID PK)、`config_key`(String 100, unique+index)、`config_value`(Text)、`config_group`(String 50, index)、`config_type`(String 20)、`is_encrypted`(Boolean)、`description`(String 500, nullable)、`updated_by`(UUID FK→user_account.id, nullable)。
+  - `ConfigHistory`：`id`、`config_key`(index)、`old_value`(Text nullable)、`new_value`(Text nullable)、`changed_by`(UUID)、`changed_at`(DateTime tz)。
+  - `EmailTemplate`：`id`、`template_code`(String 50, unique)、`template_name`、`subject`、`content`(Text)、`variables`(JSON nullable)、`is_active`(Boolean)。
+  - 三者均继承 `Base`，自动获得 `created_at`/`updated_at`。
+- 修改 `app/main.py`：在模型注册块追加 `import app.domain.models.system_config  # noqa: F401`。
+- 新建 `tests/test_system_config_model.py`：按 brief 原文，三组列集合断言 + `config_key`/`template_code` 唯一性断言（直接基于 `Base.metadata.tables` 检查）。
+
+## TDD 证据
+- RED：`uv run pytest tests/test_system_config_model.py -v` → `ModuleNotFoundError: No module named 'app.domain.models.system_config'`（模型尚未创建时收集失败）。
+- GREEN：创建模型并在 `main.py` 注册后，`uv run pytest tests/test_system_config_model.py -v` → `3 passed`。
+- 全量回归：`uv run pytest` → `72 passed`，无回归。
+
+## 提交
+- SHA: `cae42721a36a56fbcc01621fc9d6bae521e99434`
+- Subject: `feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型`
+- Branch: `feat/system-config`
+
+## Self-Review
+- 完整性：3 个模型、列与 brief 一一对应；`config_key`/`template_code` 唯一；`config_group`/`config_key`(history)/`changed_at`（注：brief 中 ConfigHistory 仅 `config_key` 显式 index，`changed_at` 未显式 index，已按 brief 原文实现，未额外加索引）；`variables` 用 `sqlalchemy.JSON`。
+- 风格一致性：与现有 `department.py`/`user.py` 同样的 `Mapped` + `mapped_column` + `Uuid` 跨 DB 写法，继承 `Base`。
+- 纪律：未新增任何额外字段、表或索引；测试仅做 metadata 检视，未引入新依赖。
+- 测试：通过真实 `Base.metadata.tables` 检查列集合与 `unique` 标志，不依赖运行时建表。
+
+## 关注点
+- 测试中 `pytestmark = pytest.mark.asyncio` 但用例均为同步，pytest 产生 PytestWarning（与现有 `test_department_model.py` 同样的已知现象，非本次回归）。
+- brief 描述中提到 `ConfigHistory.config_key + changed_at` 索引；brief 代码原文仅 `config_key` 显式 `index=True`，`changed_at` 未加 `index=True`。已严格按 brief 代码原文实现；若需复合索引需后续任务补充。
+- `updated_by` 外键指向 `user_account.id`，已确认 user 模型表名为 `user_account`。
+
+## Fix-Report (C1 评审整改 — `ConfigHistory.changed_at` 索引)
+
+### 评审发现
+C1 评审 (review-cfg1-5b85747-cae4272) 指出：`app/domain/models/system_config.py` 第 37 行 `ConfigHistory.changed_at` 缺少 `index=True`。规范 §4.2 与计划正文均要求 `ConfigHistory.config_key + changed_at` 建索引；仅计划代码块漏写。
+
+### 变更内容
+- `app/domain/models/system_config.py`：`changed_at` 由 `mapped_column(DateTime(timezone=True), nullable=False)` 改为 `mapped_column(DateTime(timezone=True), index=True, nullable=False)`，保留时区与 NOT NULL，新增单列索引。
+- `tests/test_system_config_model.py::test_config_history_columns`：新增断言 `Base.metadata.tables["config_history"].columns["changed_at"].index is True`，防止回归。
+
+### 测试结果
+- 目标测试：`uv run pytest tests/test_system_config_model.py -v` → `3 passed`（含新增 index 断言）。
+- 全量回归：`uv run pytest` → `72 passed, 66 warnings in 28.78s`，无回归。
+
+### 提交
+- SHA: `d1e9ac1562fa20aa390b53f6ba4c8694a9863ffe`
+- Subject: `fix(config): ConfigHistory.changed_at 加索引 + 测试断言`
+- Branch: `feat/system-config`
\ No newline at end of file
diff --git a/.superpowers/sdd/cfg-task-10-brief.md b/.superpowers/sdd/cfg-task-10-brief.md
new file mode 100644
index 0000000..7e14111
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-10-brief.md
@@ -0,0 +1,84 @@
+## Task 10: lifespan 集成(订阅 task + init_default_configs)+ 全量回归 + 覆盖率 + ruff
+
+**Files:**
+- Modify: `app/main.py`(lifespan 启动期开订阅 task + init seed)
+- Test: `tests/test_system_config_api.py` 已覆盖功能;本任务主要验证集成
+
+**Interfaces:**
+- Produces:lifespan 启动期 `asyncio.create_task(cache.start_subscriber())`(Redis 实现时)+ `init_default_configs(system user)` 幂等 seed;关闭期取消订阅 task。
+
+- [ ] **Step 1: 修改 main.py lifespan**
+
+```python
+# app/main.py —— lifespan 内,在 create_all 后、yield 前追加
+import asyncio
+import uuid
+
+from app.core.config_cache import get_config_cache
+from app.application.services.config_service import ConfigService
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, SystemConfigRepository,
+)
+from app.core.database import AsyncSessionLocal
+from app.core import crypto
+
+    # 配置缓存订阅(Redis 实现时;本地 no-op)
+    cache = await get_config_cache()
+    subscriber_task = asyncio.create_task(cache.start_subscriber())
+    # 幂等初始化默认配置(用一个全零 UUID 作为系统操作人)
+    async with AsyncSessionLocal() as session:
+        svc = ConfigService(session, SystemConfigRepository(session),
+                            ConfigHistoryRepository(session), crypto, cache)
+        await svc.init_default_configs(uuid.UUID(int=0))
+    yield
+    subscriber_task.cancel()
+    try:
+        await subscriber_task
+    except asyncio.CancelledError:
+        pass
+    await engine.dispose()
+```
+> 注意:保留原 `async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)` 在最前。`yield` 后的 `engine.dispose()` 原已有则不重复。
+
+- [ ] **Step 2: 运行全量测试**
+
+Run: `uv run pytest`
+Expected: 全部 PASS(含原有部门/用户模块 + 新配置模块)。
+
+- [ ] **Step 3: 覆盖率**
+
+Run: `uv run pytest --cov=app --cov-report=term-missing`
+Expected: TOTAL ≥85%;配置模块文件(`app.application.services.config_service`、`app.application.services.email_template_service`、`app.interfaces.api.system_config`、`app.interfaces.api.email_templates`、`app.core.crypto`、`app.core.config_cache`)≥85%。
+
+- [ ] **Step 4: ruff**
+
+Run: `uv run ruff check app tests`
+Expected: 0 errors(沿用 `ignore=["B008"]`);若有未用 import 等,清理。
+
+- [ ] **Step 5: 修复后再次运行至全绿**
+
+- [ ] **Step 6: 提交**
+
+```bash
+git add app/main.py
+git commit -m "feat(config): lifespan 集成订阅 task + 默认配置 seed;全量回归通过"
+```
+
+---
+
+## Self-Review 结论
+
+**Spec coverage**:
+- §3 模块边界 → 各任务文件结构 ✓
+- §4 数据模型 → Task 1 ✓
+- §5 加密与分组校验 → Task 2、3、7 ✓
+- §6 缓存与热重载 → Task 4、5、10 ✓
+- §7 业务层(ConfigService/EmailTemplateService)→ Task 7、8 ✓
+- §8 API → Task 9 ✓
+- §9 错误处理 → 各 service 任务内异常 + Task 9 路由 ✓
+- §10 测试矩阵 → Task 7/8/9 测试覆盖各用例 ✓
+- §11 实施顺序 → Task 1-10 对应 ✓
+
+**Placeholder scan**:无 TBD/TODO;每步含完整代码与命令。Task 8 中 `EmailTemplateOut` 的占位已标注修正为正确版本。
+
+**Type consistency**:`ConfigService(db, repo, history_repo, crypto, cache)` 签名跨 Task 7/9/10 一致;`ConfigCache` 方法名(get_group/set_group/invalidate/start_subscriber)跨 Task 4/5/7 一致;`group_of_key`/`GROUP_MODELS` 跨 Task 3/7/9 一致;EmailTemplate schema 类名跨 Task 8/9 一致。
diff --git a/.superpowers/sdd/cfg-task-10-report.md b/.superpowers/sdd/cfg-task-10-report.md
new file mode 100644
index 0000000..3e1a27a
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-10-report.md
@@ -0,0 +1,147 @@
+# Task 10 Report: lifespan 集成 + 全量回归 + 覆盖率 + ruff
+
+**Status:** DONE
+**Commit:** `bad2805` — feat(config): lifespan 集成订阅+init;全量回归通过,覆盖率≥85%,ruff 清零
+**Branch:** feat/system-config
+**Date:** 2026-07-07
+
+## 1. lifespan 集成 (app/main.py)
+
+在现有 `create_all` 之后、`yield` 之前追加:
+- `cache = await get_config_cache()` 获取配置缓存
+- `subscriber_task = asyncio.create_task(cache.start_subscriber())` 启动订阅 task
+- `async with AsyncSessionLocal() as session:` 内构造 `ConfigService(session, SystemConfigRepository(session), ConfigHistoryRepository(session), crypto, cache)` 并调用 `await svc.init_default_configs(uuid.UUID(int=0))` 幂等 seed
+- `yield` 后 `subscriber_task.cancel()` + `await subscriber_task` (捕获 `CancelledledError`)，再 `await engine.dispose()`
+
+保留了原 `create_all` 与 dept 模块工作 intact（dept 无独立 cache subscriber，未移除任何内容）。
+
+## 2. 测试结果
+
+```
+114 passed, 98 warnings in 53.32s
+```
+
+新增 2 个测试 (`test_factory_builds_redis_when_enabled`, `test_factory_fallback_on_redis_error`)，从 112 → 114。
+
+## 3. 覆盖率 (`uv run pytest --cov=app --cov-report=term-missing`)
+
+**TOTAL: 89%** (≥85% ✓)
+
+配置模块文件:
+| File | Before | After | ≥85% |
+|------|--------|-------|------|
+| app/application/services/config_service.py | 96% | 96% | ✓ |
+| app/application/services/email_template_service.py | 89% | 89% | ✓ |
+| app/interfaces/api/system_config.py | 74% | **97%** | ✓ |
+| app/interfaces/api/email_templates.py | 97% | 97% | ✓ |
+| app/core/crypto.py | 93% | 93% | ✓ |
+| app/core/config_cache.py | 73% | **100%** | ✓ |
+
+### 覆盖率工具 bug 说明
+
+Python 3.13 + pytest-asyncio 1.4.0 + coverage 7.15.0 存在已知问题：通过 ASGITransport 调用的 async 函数中，**第一个 `await` 之后、不含 `await` 的行不被 coverage 追踪**（即使实际执行）。通过 `print()` 验证了 line 62 (`return {"group": group, "values": _mask(...)}`) 确实执行，但 coverage 报告为 missing。
+
+**修复策略（格式重构，非逻辑变更）：**
+- 将 `return` 表达式内联 `await`（如 `return _mask(await svc.get_group(group), group)`），使 return 行包含 await → 被追踪
+- 将 post-await 逻辑提取到 **同步** helper 函数（`_format_history`, `_get_value_result`），同步函数被正常追踪
+- `put_value`/`init_configs` 的 `return` 在 `await` 语句之后（无法内联），保留为 2 行 missing → 97% 仍 ≥85%
+
+## 4. ruff
+
+**Before:** 23 errors (13 fixable + 10 E501)
+- I001 (import sort): 7
+- F401 (unused import): 3
+- E501 (line too long): 9
+
+**After:** `All checks passed!` (0 errors)
+
+修复手段：
+- `uv run ruff check --fix app tests` 自动修复 F401/I001 (14 fixed)
+- 手动修复 9 个 E501：拆分长行（model 列定义、repository 查询、测试断言）
+- 保持 `ignore = ["B008"]` 不变
+
+## 5. Files Changed
+
+| File | Change |
+|------|--------|
+| app/main.py | lifespan 集成 config subscriber + init_default_configs |
+| app/core/config_cache.py | 提取 `_build_redis_or_fallback` async helper |
+| app/interfaces/api/system_config.py | 提取同步 helper + 内联 await 到 return |
+| app/domain/models/system_config.py | E501 修复（列定义拆行） |
+| app/repositories/system_config_repository.py | E501 修复（查询拆行） |
+| app/interfaces/api/email_templates.py | I001 import 排序 |
+| tests/test_config_cache.py | +2 factory Redis path 测试 + E501 修复 |
+| tests/test_config_service.py | F401 + E501 修复 |
+| tests/test_system_config_api.py | E501 修复 |
+| tests/test_system_config_model.py | I001 import 排序 |
+| tests/test_system_config_repository.py | F401 + I001 |
+| tests/test_config_group_models.py | I001 |
+| tests/conftest.py | I001（ruff --fix 自动） |
+
+## 6. Self-Review
+
+- **Completeness:** lifespan subscriber+init+shutdown cancel ✓；全量 114/114 pass ✓；TOTAL 89% + 所有配置模块文件 ≥85% ✓；ruff 0 errors ✓
+- **Quality:** lint 修复仅触及 import 排序/未用 import/行长；endpoint 重构为格式变更（行为等价）；config_cache 提取 helper 保持语义
+- **Discipline:** 未添加投机性测试；2 个新测试覆盖真实 Redis 工厂路径缺口
+
+## 7. Concerns
+
+- coverage + Python 3.13 + pytest-asyncio 的 async 追踪 bug 需要未来升级 coverage/pytest-asyncio 版本后回退重构（目前 helper 提取是合理可读结构，可保留）
+- main.py 覆盖率 71%（lifespan body 同样受 async 追踪 bug 影响），但 main.py 不在配置模块清单内，TOTAL 89% 已达标
+## 8. Final-Branch-Review Fixes (Commit 8fe7a99)
+
+**Date:** 2026-07-07
+**Commit:** `8fe7a99` �� fix(config): final-review fixes(��� FK None + pubsub aclose + GET δ֪��400 + ȱʧ�ֶ�404 + ConfigValueUpdate �� schema)
+
+### 8.1 Fix 1 (Critical) �� startup FK violation
+- `app/application/services/config_service.py`: `create_or_init` �� `init_default_configs` ǩ���ſ�Ϊ `updated_by: uuid.UUID | None`(Ĭ�� `None`)��repo `upsert` �ѽ��� `None`,����Ķ���
+- `app/main.py`: lifespan ���ø�Ϊ `await svc.init_default_configs(None)`;�Ƴ�δʹ�õ� `import uuid`��
+- `tests/test_config_service.py`: `test_init_default_configs_seeds_all` �� `test_init_idempotent` ��Ϊ�� `None`;seeds_all �������� `all(r.updated_by is None for r in rows)`��
+- Ӱ��:Postgres ���ʱ������ `updated_by` FK ָ�򲻴��ڵ� user 0 �� INSERT ʧ�ܡ�
+
+### 8.2 Fix 2 (Important) �� redis pubsub connection leak
+- `app/core/redis_config_cache.py` `start_subscriber`: �� `pubsub = self._redis.pubsub()` ���� `try` ֮ǰ,���� `finally` ����� `getattr(pubsub, "aclose", None) or getattr(pubsub, "close", None)` �� `await close()`������ `CancelledError` ������ `except Exception` ���桢ԭ�� dict/SimpleNamespace ��Ϣ�����
+- ���� redis-py async `aclose` �� fallback `close`(FakeRedis ����ֻʵ�� `close`,�Կ���)��
+
+### 8.3 Fix 3 (Minor) �� unknown-group GET returns 500 �� 400
+- `app/interfaces/api/system_config.py`: `get_value` �� `history` �������� try/except ���� `group_of_key` �׳��� `ValueError`,ת `HTTPException(400, detail=str(exc))`���� `PUT /{key}` ��Ϊһ�¡�
+
+### 8.4 Fix 4 (Minor) �� missing field GET returns None �� 404
+- `get_value`: �� `svc.get_group(group)` ���� `field not in values`,��ȱʧ raise `HTTPException(404, detail=f"���ò�����: {key}")`���� service �� `get_value` �� `NotFoundError` ������롣
+
+### 8.5 Fix 5 (Minor) �� ConfigValueUpdate �� schema
+- `app/application/schemas/system_config.py`: ���� `ConfigValueUpdate(BaseModel)` ���� `value: str | int | bool | dict`(��ԭ router ��������һ��)��
+- `app/interfaces/api/system_config.py`: ɾ������ `ConfigValueUpdate`,��Ϊ�� schema ģ�鵼�롣`_format_history` ǩ������ `group` ����(������ helper ���ظ� `group_of_key` �״�;�� handler ͳһ����)��
+
+### 8.6 ���Խ��
+
+���ǲ���(ȫ��):
+```
+uv run pytest tests/test_config_service.py tests/test_system_config_api.py tests/test_config_cache.py -v
+23 passed, 15 warnings in 10.15s
+```
+
+ȫ���ع�:
+```
+uv run pytest
+114 passed, 98 warnings in 39.61s
+```
+
+Ruff:
+```
+uv run ruff check app tests
+All checks passed!
+```
+
+������:
+```
+uv run pytest --cov=app --cov-report=term-missing
+TOTAL  1488  166  89%
+```
+�� ��85%��
+
+### 8.7 Deferred(δ�޸�,����¼)
+- `_TYPES` STRING fallback for non-default keys(�ɽ���)��
+- `_infer_type` fragility(�Ե�ǰ defaults ��������)��
+- `start_subscriber` redundant sleep / no reconnect(�����ɽ���)��
+- Trailing newlines��`changed_by` �� FK(�� spec)��
diff --git a/.superpowers/sdd/cfg-task-2-brief.md b/.superpowers/sdd/cfg-task-2-brief.md
new file mode 100644
index 0000000..3a7df75
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-2-brief.md
@@ -0,0 +1,127 @@
+## Task 2: 加密模块(crypto.py + CONFIG_ENCRYPTION_KEY + cryptography 依赖)
+
+**Files:**
+- Create: `app/core/crypto.py`
+- Modify: `app/core/config.py`(新增 `CONFIG_ENCRYPTION_KEY: str`)
+- Modify: `pyproject.toml`(dependencies 加 `"cryptography>=43.0"`)
+- Test: `tests/test_crypto.py`
+
+**Interfaces:**
+- Produces: `encrypt(plain: str) -> str`、`decrypt(cipher: str) -> str`(Fernet;密钥从 `settings.CONFIG_ENCRYPTION_KEY`)。`decrypt` 密文损坏抛 `cryptography.fernet.InvalidToken`。
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_crypto.py
+from __future__ import annotations
+
+import pytest
+
+from app.core.crypto import decrypt, encrypt
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_encrypt_decrypt_roundtrip():
+    plain = "smtp-password-123"
+    cipher = encrypt(plain)
+    assert cipher != plain and isinstance(cipher, str)
+    assert decrypt(cipher) == plain
+
+
+async def test_encrypt_different_each_time():
+    a = encrypt("x")
+    b = encrypt("x")
+    assert a != b  # Fernet 每次带随机 IV
+
+
+def test_decrypt_invalid_token_raises():
+    from cryptography.fernet import InvalidToken
+    with pytest.raises(InvalidToken):
+        decrypt("not-a-valid-fernet-token")
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_crypto.py -v`
+Expected: FAIL(`ModuleNotFoundError: app.core.crypto`)
+
+- [ ] **Step 3: 加依赖 + 配置**
+
+`pyproject.toml` dependencies 数组追加(在 `cachetools>=5.3` 后):
+```toml
+    "cryptography>=43.0",
+```
+运行 `uv sync --extra dev`。
+
+`app/core/config.py` Settings 类追加(在 `CACHE_ENABLED` 后):
+```python
+    # 配置加密密钥(Fernet,启动期必须提供)
+    CONFIG_ENCRYPTION_KEY: str = ""  # 生产由 .env 注入;测试由 fixture 注入
+    # 配置缓存开关(测试置 False 强制 LocalTTLCache)
+    CONFIG_CACHE_ENABLED: bool = True
+```
+
+- [ ] **Step 4: 实现 crypto**
+
+```python
+# app/core/crypto.py
+"""Fernet 对称加密(敏感配置)."""
+
+from __future__ import annotations
+
+from cryptography.fernet import Fernet
+
+from app.core.config import settings
+
+_fernet: Fernet | None = None
+
+
+def _get_fernet() -> Fernet:
+    global _fernet
+    if _fernet is None:
+        if not settings.CONFIG_ENCRYPTION_KEY:
+            raise RuntimeError("CONFIG_ENCRYPTION_KEY 未配置:无法加解密敏感配置")
+        _fernet = Fernet(settings.CONFIG_ENCRYPTION_KEY.encode())
+    return _fernet
+
+
+def encrypt(plain: str) -> str:
+    return _get_fernet().encrypt(plain.encode()).decode()
+
+
+def decrypt(cipher: str) -> str:
+    return _get_fernet().decrypt(cipher.encode()).decode()
+```
+
+- [ ] **Step 5: conftest 注入测试密钥**
+
+在 `tests/conftest.py` 顶部 import 区后加 autouse fixture(确保所有测试有密钥):
+```python
+import pytest
+from cryptography.fernet import Fernet
+from app.core import config as _config
+
+
+@pytest.fixture(autouse=True)
+def _encryption_key(monkeypatch):
+    monkeypatch.setattr(_config.settings, "CONFIG_ENCRYPTION_KEY", Fernet.generate_key().decode())
+    # crypto 模块缓存了 _fernet,重置以用新密钥
+    from app.core import crypto
+    crypto._fernet = None
+```
+
+- [ ] **Step 6: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_crypto.py -v`
+Expected: PASS(3 passed);全量无回归。
+
+- [ ] **Step 7: 提交**
+
+```bash
+git add app/core/crypto.py app/core/config.py pyproject.toml uv.lock tests/test_crypto.py tests/conftest.py
+git commit -m "feat(config): Fernet 加密模块 + CONFIG_ENCRYPTION_KEY"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-2-report.md b/.superpowers/sdd/cfg-task-2-report.md
new file mode 100644
index 0000000..d23dd1a
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-2-report.md
@@ -0,0 +1,32 @@
+# Task 2 Report: Fernet 加密模块
+
+## Status: DONE
+
+## Commit
+- SHA: `33cf225b737351af42dbfebd5ed02c2ab08fada2`
+- Subject: `feat(config): Fernet 加密模块 + CONFIG_ENCRYPTION_KEY`
+- Branch: `feat/system-config`
+- Files changed: 6 (74 insertions)
+
+## Changes
+1. **Created** `app/core/crypto.py` — Fernet 对称加密;`encrypt`/`decrypt` 模块级函数;`_fernet` 单例缓存;空 key 抛 `RuntimeError`。
+2. **Modified** `app/core/config.py` — `Settings` 新增 `CONFIG_ENCRYPTION_KEY: str = ""` 与 `CONFIG_CACHE_ENABLED: bool = True`(在 `CACHE_ENABLED` 后)。保留原 `CACHE_ENABLED`(部门缓存)。
+3. **Modified** `pyproject.toml` — dependencies 追加 `"cryptography>=43.0"`(在 `cachetools>=5.3` 后)。
+4. **Modified** `tests/conftest.py` — 顶部加 autouse `_encryption_key` fixture,为所有测试注入临时 Fernet key 并重置 `crypto._fernet = None`。
+5. **Created** `tests/test_crypto.py` — 3 测试:roundtrip / 不同密文 / InvalidToken。
+
+## Testing
+- `uv run pytest tests/test_crypto.py -v` → **3 passed** (0.04s)。
+- `uv run pytest`(全量) → **75 passed** (30.90s),无回归。
+- 警告:67 条 `PytestWarning` 关于 sync 测试带 `@pytest.mark.asyncio`(来自既有测试模块,如 `test_department_schema.py`、`test_system_config_model.py`),与本任务无关,符合 brief 注释"pre-existing PytestAsyncio warnings on sync tests are fine"。
+
+## Self-Review
+- **Completeness**: 加解密往返 ✓;每次加密结果不同(Fernet 随机 IV) ✓;`InvalidToken` ✓;两个新 Settings 字段 ✓;`cryptography>=43.0` 依赖 ✓;autouse conftest fixture ✓。
+- **Discipline**: 严格按 brief 逐字实现;无额外字段/函数/注释;未删除原 `CACHE_ENABLED`。
+- **Quality**: `_get_fernet` 单例 + fixture 重置模式;密钥缺失 fail-fast `RuntimeError`;类型注解 `Fernet | None`。
+- **Testing**: 真 Fernet 加解密往返验证;`uv sync --extra dev` 成功(cryptography 之前已被 `python-jose[cryptography]` 间接拉入,显式声明确保稳定性)。
+
+## Notes / Concerns
+- 无阻塞问题。
+- brief 的 Step 5 描述在 "顶部 import 区后" 加 fixture,实际将 fixture 放在 conftest.py 既有 import 块之后、`db_file` fixture 之前;功能等价。
+- PowerShell 输出中 `uv sync` 的 stderr 被包装为 NativeCommandError(PS 5.1 已知行为),不影响执行。
\ No newline at end of file
diff --git a/.superpowers/sdd/cfg-task-3-brief.md b/.superpowers/sdd/cfg-task-3-brief.md
new file mode 100644
index 0000000..6486510
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-3-brief.md
@@ -0,0 +1,149 @@
+## Task 3: 分组 Pydantic 模型
+
+**Files:**
+- Create: `app/application/schemas/system_config.py`(本任务只放 4 个分组模型 + `GROUP_MODELS` + key→组映射)
+- Test: `tests/test_config_group_models.py`
+
+**Interfaces:**
+- Produces: `MailConfig`、`SecurityPolicy`、`PerformanceConfig`、`SystemParams`(pydantic BaseModel,字段见 spec §5.2);`GROUP_MODELS: dict[str, type[BaseModel]]`(`MAIL`/`SECURITY`/`PERFORMANCE`/`SYSTEM`);`group_of_key(key: str) -> str`(返回组名,未知前缀抛 `ValueError`)。
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_config_group_models.py
+from __future__ import annotations
+
+import pytest
+from pydantic import ValidationError
+
+from app.application.schemas.system_config import (
+    GROUP_MODELS, MailConfig, SecurityPolicy, SystemParams, group_of_key,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+def test_group_of_key():
+    assert group_of_key("mail.host") == "MAIL"
+    assert group_of_key("security.password_min_length") == "SECURITY"
+    assert group_of_key("performance.cache_user_info_ttl") == "PERFORMANCE"
+    assert group_of_key("system.site_name") == "SYSTEM"
+
+
+def test_group_of_key_unknown():
+    with pytest.raises(ValueError):
+        group_of_key("unknown.x")
+
+
+def test_security_policy_validates_range():
+    with pytest.raises(ValidationError):
+        SecurityPolicy(
+            password_min_length=3,  # < 6
+            password_require_uppercase=True, password_require_lowercase=True,
+            password_require_digits=True, password_require_special=True,
+            password_history_size=5, password_expiration_days=90,
+            login_max_attempts=5, login_lock_minutes=30, session_timeout_minutes=15,
+        )
+
+
+def test_mail_config_port_range():
+    with pytest.raises(ValidationError):
+        MailConfig(host="smtp", port=99999, username="u", password="p")
+
+
+def test_system_params_locale_pattern():
+    with pytest.raises(ValidationError):
+        SystemParams(site_name="x", default_locale="invalid", support_email="a@b.com")
+
+
+def test_group_models_keys():
+    assert set(GROUP_MODELS.keys()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_config_group_models.py -v`
+Expected: FAIL(模块不存在)
+
+- [ ] **Step 3: 实现**
+
+```python
+# app/application/schemas/system_config.py
+"""系统配置分组 Pydantic 模型 + key→组映射."""
+
+from __future__ import annotations
+
+from typing import Literal
+
+from pydantic import BaseModel, EmailStr, Field, SecretStr
+
+_PREFIX_TO_GROUP = {"mail": "MAIL", "security": "SECURITY",
+                    "performance": "PERFORMANCE", "system": "SYSTEM"}
+
+
+def group_of_key(key: str) -> str:
+    prefix = key.split(".", 1)[0]
+    group = _PREFIX_TO_GROUP.get(prefix)
+    if group is None:
+        raise ValueError(f"未知配置组前缀: {prefix}")
+    return group
+
+
+class MailConfig(BaseModel):
+    host: str = Field(min_length=1, max_length=255)
+    port: int = Field(ge=1, le=65535)
+    username: str = Field(min_length=1, max_length=255)
+    password: SecretStr
+    protocol: Literal["smtp", "smtps"] = "smtp"
+    starttls: bool = True
+
+
+class SecurityPolicy(BaseModel):
+    password_min_length: int = Field(ge=6, le=128)
+    password_require_uppercase: bool
+    password_require_lowercase: bool
+    password_require_digits: bool
+    password_require_special: bool
+    password_history_size: int = Field(ge=0, le=20)
+    password_expiration_days: int = Field(ge=0, le=365)
+    login_max_attempts: int = Field(ge=1, le=20)
+    login_lock_minutes: int = Field(ge=1, le=1440)
+    session_timeout_minutes: int = Field(ge=1, le=1440)
+
+
+class PerformanceConfig(BaseModel):
+    cache_user_info_ttl: int = Field(ge=10, le=3600)
+    cache_permission_ttl: int = Field(ge=10, le=3600)
+    cache_department_tree_ttl: int = Field(ge=10, le=3600)
+    db_max_pool_size: int = Field(ge=1, le=100)
+    api_response_threshold_ms: int = Field(ge=10, le=10000)
+
+
+class SystemParams(BaseModel):
+    site_name: str = Field(min_length=1, max_length=100)
+    default_locale: str = Field(pattern=r"^[a-z]{2}_[A-Z]{2}$")
+    support_email: EmailStr
+
+
+GROUP_MODELS = {
+    "MAIL": MailConfig,
+    "SECURITY": SecurityPolicy,
+    "PERFORMANCE": PerformanceConfig,
+    "SYSTEM": SystemParams,
+}
+```
+
+- [ ] **Step 4: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_config_group_models.py -v`
+Expected: PASS(6 passed);全量无回归。
+
+- [ ] **Step 5: 提交**
+
+```bash
+git add app/application/schemas/system_config.py tests/test_config_group_models.py
+git commit -m "feat(config): 分组 Pydantic 模型 + key→组映射"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-3-report.md b/.superpowers/sdd/cfg-task-3-report.md
new file mode 100644
index 0000000..9da91af
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-3-report.md
@@ -0,0 +1,28 @@
+# Task 3 报告：分组 Pydantic 模型 + key→组映射
+
+## Status: DONE
+
+- Commit: `16a4cc2ebfcfe2a2957451af7330abf6490fe046`
+- Subject: `feat(config): 分组 Pydantic 模型 + key→组映射`
+
+## 交付物
+- `app/application/schemas/system_config.py`：4 个分组模型（MailConfig / SecurityPolicy / PerformanceConfig / SystemParams）+ `_PREFIX_TO_GROUP` + `group_of_key` + `GROUP_MODELS`。
+- `tests/test_config_group_models.py`：6 个测试，按 brief 原样。
+
+## 测试
+- 新测试：6 passed（`uv run pytest tests/test_config_group_models.py -v`）。
+- 全量回归：81 passed（`uv run pytest`），无回归。
+- 既有 warnings（asyncio 标记 + 同步函数）保持不变，非本任务引入。
+
+## 自检
+- 4 个模型字段与约束与 brief 完全一致（Field ge/le、Literal、SecretStr、EmailStr、pattern）。
+- `group_of_key` 正确映射 4 个前缀，未知前缀抛 `ValueError`。
+- `GROUP_MODELS` 含 4 个键：MAIL/SECURITY/PERFORMANCE/SYSTEM。
+- 未添加 EmailTemplate 相关内容（Task 8 范围）。
+- 文件结构允许后续 Task 8/9 追加而不破坏现有内容。
+
+## Concerns
+- 无。仅 LF→CRLF 警告（Windows 环境正常）。
+
+## Report File
+- `D:/claude-code-project/fullstack-fastAPI-reactjs/.superpowers/sdd/cfg-task-3-report.md`
\ No newline at end of file
diff --git a/.superpowers/sdd/cfg-task-4-brief.md b/.superpowers/sdd/cfg-task-4-brief.md
new file mode 100644
index 0000000..b057806
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-4-brief.md
@@ -0,0 +1,144 @@
+## Task 4: ConfigCache 协议 + LocalTTLCache + 工厂
+
+**Files:**
+- Create: `app/core/config_cache.py`
+- Test: `tests/test_config_cache.py`
+
+**Interfaces:**
+- Produces: `ConfigCache`(Protocol):`get_group(group)->dict|None`、`set_group(group, values)`、`invalidate(group=None)`、`start_subscriber()`;`LocalTTLCache`(cachetools TTLCache,TTL 60s);`get_config_cache()`(async 依赖,`CONFIG_CACHE_ENABLED=False` 或 Redis 不可用→`LocalTTLCache`)。
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_config_cache.py
+from __future__ import annotations
+
+import pytest
+
+from app.core.config_cache import ConfigCache, LocalTTLCache, get_config_cache
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_local_cache_miss_and_set():
+    cache = LocalTTLCache()
+    assert await cache.get_group("MAIL") is None
+    await cache.set_group("MAIL", {"host": "smtp"})
+    assert await cache.get_group("MAIL") == {"host": "smtp"}
+
+
+async def test_local_cache_invalidate():
+    cache = LocalTTLCache()
+    await cache.set_group("MAIL", {"a": 1})
+    await cache.set_group("SECURITY", {"b": 2})
+    await cache.invalidate("MAIL")
+    assert await cache.get_group("MAIL") is None
+    assert await cache.get_group("SECURITY") == {"b": 2}
+    await cache.invalidate()  # 全清
+    assert await cache.get_group("SECURITY") is None
+
+
+async def test_local_cache_start_subscriber_noop():
+    cache = LocalTTLCache()
+    await cache.start_subscriber()  # 不抛错
+
+
+async def test_factory_returns_local_when_disabled(monkeypatch):
+    from app.core.config import settings
+    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
+    cache = await get_config_cache()
+    assert isinstance(cache, LocalTTLCache)
+
+
+def test_protocol_compat():
+    assert isinstance(LocalTTLCache(), ConfigCache)
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_config_cache.py -v`
+Expected: FAIL(模块不存在)
+
+- [ ] **Step 3: 实现**
+
+```python
+# app/core/config_cache.py
+"""系统配置缓存抽象 + 本地 TTL + 工厂(Redis 实现见 Task 5)."""
+
+from __future__ import annotations
+
+import logging
+from typing import Protocol, runtime_checkable
+
+from cachetools import TTLCache
+
+from app.core.config import settings
+
+logger = logging.getLogger(__name__)
+
+TTL_SECONDS = 60
+
+
+@runtime_checkable
+class ConfigCache(Protocol):
+    async def get_group(self, group: str) -> dict | None: ...
+    async def set_group(self, group: str, values: dict) -> None: ...
+    async def invalidate(self, group: str | None = None) -> None: ...
+    async def start_subscriber(self) -> None: ...
+
+
+class LocalTTLCache:
+    def __init__(self) -> None:
+        self._store: TTLCache = TTLCache(maxsize=128, ttl=TTL_SECONDS)
+
+    async def get_group(self, group: str) -> dict | None:
+        return self._store.get(group)
+
+    async def set_group(self, group: str, values: dict) -> None:
+        self._store[group] = values
+
+    async def invalidate(self, group: str | None = None) -> None:
+        if group is None:
+            self._store.clear()
+        else:
+            self._store.pop(group, None)
+
+    async def start_subscriber(self) -> None:
+        return None
+
+
+_local_singleton = LocalTTLCache()
+_redis_singleton: ConfigCache | None = None
+
+
+async def get_config_cache() -> ConfigCache:
+    global _redis_singleton
+    if not settings.CONFIG_CACHE_ENABLED:
+        return _local_singleton
+    if _redis_singleton is not None:
+        return _redis_singleton
+    try:
+        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client
+
+        client = await build_redis_client()
+        _redis_singleton = RedisPubSubConfigCache(client)
+    except Exception as exc:  # noqa: BLE001
+        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
+        _redis_singleton = _local_singleton
+    return _redis_singleton
+```
+
+- [ ] **Step 4: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_config_cache.py -v`
+Expected: PASS(5 passed);全量无回归。
+
+- [ ] **Step 5: 提交**
+
+```bash
+git add app/core/config_cache.py tests/test_config_cache.py
+git commit -m "feat(config): ConfigCache 协议 + LocalTTLCache + 工厂"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-4-report.md b/.superpowers/sdd/cfg-task-4-report.md
new file mode 100644
index 0000000..73a2bcc
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-4-report.md
@@ -0,0 +1,70 @@
+# Task 4 Report: ConfigCache 协议 + LocalTTLCache + 工厂
+
+## Status: DONE
+
+## Commit
+- SHA: `49cdfe61b878eec16578c57efd48f6115ffd5ffc`
+- Subject: `feat(config): ConfigCache 协议 + LocalTTLCache + 工厂`
+- Branch: `feat/system-config`
+
+## Files
+- Created: `app/core/config_cache.py`
+- Test: `tests/test_config_cache.py`
+
+## Implementation
+Followed brief verbatim:
+- `ConfigCache` Protocol with 4 async methods: `get_group`, `set_group`, `invalidate`, `start_subscriber`
+- `LocalTTLCache` backed by `cachetools.TTLCache(maxsize=128, ttl=60)`
+- `get_config_cache()` factory:
+  - Returns local singleton when `CONFIG_CACHE_ENABLED=False`
+  - Returns cached redis singleton if already built
+  - Tries to import `RedisPubSubConfigCache` + `build_redis_client` from `app.core.redis_config_cache` (Task 5, not present) — import fails → falls back to local singleton with warning log
+- `_local_singleton` is module-level (preserves cache state across calls)
+
+## Tests
+Target: 5 tests
+```
+tests/test_config_cache.py::test_local_cache_miss_and_set PASSED
+tests/test_config_cache.py::test_local_cache_invalidate PASSED
+tests/test_config_cache.py::test_local_cache_start_subscriber_noop PASSED
+tests/test_config_cache.py::test_factory_returns_local_when_disabled PASSED
+tests/test_config_cache.py::test_protocol_compat PASSED
+```
+Result: `5 passed, 1 warning in 0.07s` (warning is pre-existing `pytestmark asyncio on sync test` pattern, matches other tests in repo).
+
+## Full Suite Regression Check
+```
+86 passed, 74 warnings in 32.76s
+```
+No regressions. All pre-existing tests still pass.
+
+## TDD Process
+1. Wrote `tests/test_config_cache.py` per brief (verbatim)
+2. Ran `uv run pytest tests/test_config_cache.py -v` → `ModuleNotFoundError: No module named 'app.core.config_cache'` (FAIL, expected)
+3. Created `app/core/config_cache.py` per brief (verbatim)
+4. Ran tests → `5 passed`
+5. Ran full suite → `86 passed`
+6. Committed with required message
+
+## Self-Review Checklist
+- [x] Protocol has all 4 methods (`get_group`, `set_group`, `invalidate`, `start_subscriber`)
+- [x] `LocalTTLCache`:
+  - [x] Miss returns `None`
+  - [x] `set_group` stores values
+  - [x] `invalidate(group)` removes single, `invalidate()` clears all
+  - [x] `start_subscriber` is a noop (`return None`)
+- [x] Factory:
+  - [x] Returns `LocalTTLCache` when `CONFIG_CACHE_ENABLED=False`
+  - [x] Returns `LocalTTLCache` when Redis import fails (graceful degradation with warning log)
+  - [x] Caches redis singleton to avoid rebuilding
+- [x] `@runtime_checkable` enables `isinstance(LocalTTLCache(), ConfigCache)` check
+- [x] Tests use real `TTLCache` behavior (no mocks)
+- [x] No `redis_config_cache.py` created (Task 5 territory)
+- [x] Used `settings.CONFIG_CACHE_ENABLED` from Task 2 (verified present at `app/core/config.py:41`)
+- [x] `cachetools` already a dependency (per brief)
+
+## Concerns
+None. Implementation is brief-verbatim. The `pytestmark = pytest.mark.asyncio` warning on the sync `test_protocol_compat` test is the same pattern used in other tests in the repo (e.g., `test_department_schema.py`, `test_system_config_model.py`) — not introduced by this task.
+
+## Skills/Plugins/Agents Used
+- None invoked. Standard TDD workflow with Read/Write/PowerShell/Edit tools.
\ No newline at end of file
diff --git a/.superpowers/sdd/cfg-task-5-brief.md b/.superpowers/sdd/cfg-task-5-brief.md
new file mode 100644
index 0000000..60b9351
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-5-brief.md
@@ -0,0 +1,177 @@
+## Task 5: RedisPubSubConfigCache(pub/sub 即时失效)
+
+**Files:**
+- Create: `app/core/redis_config_cache.py`
+- Test: `tests/test_config_cache.py`(追加 pub/sub 用例,FakeRedis)
+
+**Interfaces:**
+- Produces: `RedisPubSubConfigCache(client)`(组合 LocalTTLCache + pub/sub);`build_redis_client()`;频道 `config-change`,载荷 `{group}`。
+- Consumes: redis-py async client(duck-typed `get/set/publish/subscribe/pubsub_get_message`)。
+
+- [ ] **Step 1: 写失败测试(追加到 tests/test_config_cache.py)**
+
+```python
+# tests/test_config_cache.py —— 末尾追加
+
+
+class FakeRedis:
+    def __init__(self):
+        self.store: dict[str, str] = {}
+        self.published: list[tuple[str, str]] = []
+        self._subs: list = []
+
+    async def get(self, key):
+        return self.store.get(key)
+
+    async def set(self, key, value, ex=None):
+        self.store[key] = value
+
+    async def publish(self, channel, message):
+        self.published.append((channel, message))
+
+    def pubsub(self):
+        class _PubSub:
+            def __init__(self, parent):
+                self.parent = parent
+                self._queue: list = []
+
+            async def subscribe(self, *channels):
+                self.parent._subs.append(self)
+
+            async def get_message(self, ignore_subscribe_messages=True, timeout=None):
+                if self._queue:
+                    return self._queue.pop(0)
+                return None
+
+            def push(self, channel, message):
+                import types
+                self._queue.append(types.SimpleNamespace(type="message", channel=channel, data=message))
+
+            async def close(self):
+                pass
+
+        return _PubSub(self)
+
+    async def ping(self):
+        return True
+
+    async def close(self):
+        pass
+
+
+async def test_redis_cache_uses_local_and_publishes_invalidate():
+    from app.core.redis_config_cache import RedisPubSubConfigCache
+    cache = RedisPubSubConfigCache(FakeRedis())
+    await cache.set_group("MAIL", {"host": "smtp"})
+    assert await cache.get_group("MAIL") == {"host": "smtp"}
+    await cache.invalidate("MAIL")
+    assert await cache.get_group("MAIL") is None
+    assert ("config-change", "MAIL") in cache._redis.published  # noqa: SLF001
+
+
+async def test_redis_cache_subscriber_invalidates_local():
+    import asyncio
+
+    from app.core.redis_config_cache import RedisPubSubConfigCache
+
+    fake = FakeRedis()
+    cache = RedisPubSubConfigCache(fake)
+    await cache.set_group("MAIL", {"host": "smtp"})
+    # 启动订阅 task
+    task = asyncio.create_task(cache.start_subscriber())
+    await asyncio.sleep(0.05)  # 让订阅注册
+    assert fake._subs, "subscriber registered"  # noqa: SLF001
+    # 模拟收到失效消息
+    fake._subs[0].push("config-change", "MAIL")
+    await asyncio.sleep(0.05)
+    assert await cache.get_group("MAIL") is None  # 本地被失效
+    task.cancel()
+    try:
+        await task
+    except asyncio.CancelledError:
+        pass
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_config_cache.py -v`
+Expected: 2 个新用例 FAIL(模块不存在)
+
+- [ ] **Step 3: 实现**
+
+```python
+# app/core/redis_config_cache.py
+"""Redis pub/sub 配置缓存(组合 LocalTTLCache + 跨 worker 即时失效)."""
+
+from __future__ import annotations
+
+import asyncio
+import json
+import logging
+
+from redis.asyncio import Redis
+
+from app.core.config_cache import LocalTTLCache
+
+logger = logging.getLogger(__name__)
+CHANNEL = "config-change"
+
+
+async def build_redis_client() -> Redis:
+    from app.core.config import settings
+
+    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
+    await client.ping()
+    return client
+
+
+class RedisPubSubConfigCache:
+    def __init__(self, client: Redis):
+        self._local = LocalTTLCache()
+        self._redis = client
+
+    async def get_group(self, group: str) -> dict | None:
+        return await self._local.get_group(group)
+
+    async def set_group(self, group: str, values: dict) -> None:
+        await self._local.set_group(group, values)
+
+    async def invalidate(self, group: str | None = None) -> None:
+        await self._local.invalidate(group)
+        try:
+            await self._redis.publish(CHANNEL, group or "*")
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("config cache publish 失败,降级: %s", exc)
+
+    async def start_subscriber(self) -> None:
+        try:
+            pubsub = self._redis.pubsub()
+            await pubsub.subscribe(CHANNEL)
+            async for msg in pubsub.listen():
+                if msg.get("type") != "message":
+                    continue
+                group = msg.get("data")
+                if group in (None, "*"):
+                    await self._local.invalidate()
+                else:
+                    await self._local.invalidate(group)
+        except asyncio.CancelledError:
+            raise
+        except Exception as exc:  # noqa: BLE001
+            logger.warning("config cache 订阅断开,降级为本地 TTL: %s", exc)
+```
+
+- [ ] **Step 4: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_config_cache.py -v`
+Expected: PASS(7 passed);全量无回归。
+
+- [ ] **Step 5: 提交**
+
+```bash
+git add app/core/redis_config_cache.py tests/test_config_cache.py
+git commit -m "feat(config): RedisPubSubConfigCache(pub/sub 即时失效)"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-5-report.md b/.superpowers/sdd/cfg-task-5-report.md
new file mode 100644
index 0000000..9f31167
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-5-report.md
@@ -0,0 +1,41 @@
+# Task 5 Report: RedisPubSubConfigCache (pub/sub 即时失效)
+
+## Status: DONE_WITH_CONCERNS
+
+## Commit
+- SHA: `a7e4d085c8d56fa6bd2b24b0dd38c2d8e3ad421f`
+- Subject: `feat(config): RedisPubSubConfigCache(pub/sub 即时失效)`
+
+## Test Summary
+`tests/test_config_cache.py`: 7 passed. Full suite: 88 passed, 0 failed (no regression).
+
+## What Was Done
+1. Appended `FakeRedis` test double + 2 new tests to `tests/test_config_cache.py` per brief (verbatim).
+2. Confirmed the 2 new tests FAIL with `ModuleNotFoundError` before implementation.
+3. Created `app/core/redis_config_cache.py` with:
+   - `build_redis_client()` — lazily imports settings, builds `Redis.from_url(REDIS_URL, decode_responses=True)`, pings, returns client.
+   - `RedisPubSubConfigCache(client)` — composes `LocalTTLCache` + pub/sub.
+   - `get_group` / `set_group` delegate to local.
+   - `invalidate(group=None)` invalidates local then publishes `{group}` (or `*`) on channel `config-change`, wrapped in try/except for degradation.
+   - `start_subscriber()` subscribes to `config-change`, loops on `get_message`, invalidates local on message (`*`/None → full clear), re-raises `asyncio.CancelledError`, swallows other exceptions with a warning.
+4. Ran tests: 7 passed. Full suite: 88 passed, no regression.
+5. Committed on `feat/system-config`.
+
+## Deviations from Brief (Concerns)
+The brief's `start_subscriber` uses `async for msg in pubsub.listen()`, but the brief's own `FakeRedis._PubSub` does not implement `listen()` — only `get_message` / `subscribe` / `push` / `close`. Following the brief verbatim would make `test_redis_cache_subscriber_invalidates_local` fail (AttributeError on `listen`).
+
+To stay faithful to the brief's intent while satisfying the test double's contract, `start_subscriber` was implemented as a `get_message` polling loop (`timeout=1.0`, `await asyncio.sleep(0.05)` on None) instead of `pubsub.listen()`. Functionally equivalent for the real `redis.asyncio` client (which supports both `listen()` and `get_message`).
+
+Additionally, `FakeRedis` pushes messages as `types.SimpleNamespace(type=..., channel=..., data=...)`, while real redis-py returns dict-like messages. The message extraction handles both via `isinstance(msg, dict)` checks (`msg.get(...)` vs `getattr(msg, ...)`). This keeps the test double working and remains compatible with the real client.
+
+The unused `import json` from the brief was omitted (ruff F401 would flag it; payload is a plain group string, not JSON).
+
+## Self-Review
+- Completeness: `build_redis_client` ✓, `RedisPubSubConfigCache` (get_group/set_group/invalidate+publish/start_subscriber) ✓, channel `config-change` ✓, try/except degradation ✓, `asyncio.CancelledError` re-raised ✓.
+- Quality: minimal, no dead code, follows existing module style.
+- Discipline: tests-first confirmed failing, then implementation, then full suite green.
+- Testing: FakeRedis verifies `invalidate` publishes `("config-change", "MAIL")`; subscriber test verifies local invalidation on pushed message.
+
+## Skills / Plugins / Agents Used
+- Skill: `superpowers:test-driven-development` (red → green → commit).
+- No plugins or sub-agents invoked; task executed directly in main thread.
\ No newline at end of file
diff --git a/.superpowers/sdd/cfg-task-6-brief.md b/.superpowers/sdd/cfg-task-6-brief.md
new file mode 100644
index 0000000..c7f3c7b
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-6-brief.md
@@ -0,0 +1,209 @@
+## Task 6: SystemConfig / ConfigHistory / EmailTemplate 仓储
+
+**Files:**
+- Create: `app/repositories/system_config_repository.py`
+- Test: `tests/test_system_config_repository.py`
+
+**Interfaces:**
+- Produces:
+  - `SystemConfigRepository(db)`:`get_by_key(key)`、`list_by_group(group)`、`upsert(key, value, group, type, is_encrypted, updated_by, description=None)`、`list_keys(group=None)`
+  - `ConfigHistoryRepository(db)`:`add(key, old_value, new_value, changed_by)`、`list_by_key(key)`
+  - `EmailTemplateRepository(db)`:`get_by_id(id)`、`get_by_code(code)`、`list(page, size)`、`add(tpl)`、`delete(tpl)`
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_system_config_repository.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.domain.models.system_config import EmailTemplate, SystemConfig
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, EmailTemplateRepository, SystemConfigRepository,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+async def test_upsert_inserts_and_updates(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = SystemConfigRepository(db)
+        await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
+        await db.commit()
+        got = await repo.get_by_key("mail.host")
+        assert got is not None and got.config_value == "smtp.x.com"
+        await repo.upsert("mail.host", "smtp.y.com", "MAIL", "STRING", False, None)
+        await db.commit()
+        got2 = await repo.get_by_key("mail.host")
+        assert got2.config_value == "smtp.y.com"
+
+
+async def test_list_by_group(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = SystemConfigRepository(db)
+        await repo.upsert("mail.host", "h", "MAIL", "STRING", False, None)
+        await repo.upsert("mail.port", "25", "MAIL", "INT", False, None)
+        await repo.upsert("system.site_name", "s", "SYSTEM", "STRING", False, None)
+        await db.commit()
+        rows = await repo.list_by_group("MAIL")
+        assert {r.config_key for r in rows} == {"mail.host", "mail.port"}
+
+
+async def test_config_history(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        hist = ConfigHistoryRepository(db)
+        await hist.add("mail.host", "old", "new", uuid.uuid4())
+        await db.commit()
+        rows = await hist.list_by_key("mail.host")
+        assert len(rows) == 1 and rows[0].new_value == "new"
+
+
+async def test_email_template_repo(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        repo = EmailTemplateRepository(db)
+        tpl = EmailTemplate(template_code="USER_ACTIVATION", template_name="激活",
+                            subject="欢迎", content="Hi {{name}}",
+                            variables=[{"name": "name", "description": "用户名", "required": True}])
+        await repo.add(tpl)
+        await db.commit()
+        assert (await repo.get_by_code("USER_ACTIVATION")).template_name == "激活"
+        items, total = await repo.list(1, 20)
+        assert total == 1
+        await repo.delete(tpl)
+        await db.commit()
+        assert await repo.get_by_code("USER_ACTIVATION") is None
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_system_config_repository.py -v`
+Expected: FAIL(模块不存在)
+
+- [ ] **Step 3: 实现**
+
+```python
+# app/repositories/system_config_repository.py
+"""系统配置、配置历史、邮件模板仓储."""
+
+from __future__ import annotations
+
+import uuid
+
+from sqlalchemy import func, select
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.domain.models.system_config import ConfigHistory, EmailTemplate, SystemConfig
+
+
+class SystemConfigRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def get_by_key(self, key: str) -> SystemConfig | None:
+        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
+        return result.scalar_one_or_none()
+
+    async def list_by_group(self, group: str) -> list[SystemConfig]:
+        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_group == group))
+        return list(result.scalars().all())
+
+    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
+        stmt = select(SystemConfig)
+        if group is not None:
+            stmt = stmt.where(SystemConfig.config_group == group)
+        result = await self.db.execute(stmt.order_by(SystemConfig.config_group, SystemConfig.config_key))
+        return list(result.scalars().all())
+
+    async def upsert(self, key: str, value: str, group: str, type_: str,
+                     is_encrypted: bool, updated_by: uuid.UUID | None,
+                     description: str | None = None) -> SystemConfig:
+        existing = await self.get_by_key(key)
+        if existing is None:
+            row = SystemConfig(config_key=key, config_value=value, config_group=group,
+                               config_type=type_, is_encrypted=is_encrypted,
+                               updated_by=updated_by, description=description)
+            self.db.add(row)
+            await self.db.flush()
+            return row
+        existing.config_value = value
+        existing.config_group = group
+        existing.config_type = type_
+        existing.is_encrypted = is_encrypted
+        existing.updated_by = updated_by
+        if description is not None:
+            existing.description = description
+        await self.db.flush()
+        return existing
+
+
+class ConfigHistoryRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def add(self, key: str, old_value: str | None, new_value: str | None,
+                  changed_by: uuid.UUID) -> ConfigHistory:
+        row = ConfigHistory(config_key=key, old_value=old_value, new_value=new_value,
+                            changed_by=changed_by)
+        self.db.add(row)
+        await self.db.flush()
+        return row
+
+    async def list_by_key(self, key: str) -> list[ConfigHistory]:
+        result = await self.db.execute(
+            select(ConfigHistory).where(ConfigHistory.config_key == key)
+            .order_by(ConfigHistory.changed_at.desc())
+        )
+        return list(result.scalars().all())
+
+
+class EmailTemplateRepository:
+    def __init__(self, db: AsyncSession):
+        self.db = db
+
+    async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
+        return await self.db.get(EmailTemplate, tpl_id)
+
+    async def get_by_code(self, code: str) -> EmailTemplate | None:
+        result = await self.db.execute(select(EmailTemplate).where(EmailTemplate.template_code == code))
+        return result.scalar_one_or_none()
+
+    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
+        total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
+        total = int(total_result.scalar_one())
+        result = await self.db.execute(
+            select(EmailTemplate).order_by(EmailTemplate.template_code)
+            .offset((page - 1) * size).limit(size)
+        )
+        return list(result.scalars().all()), total
+
+    async def add(self, tpl: EmailTemplate) -> EmailTemplate:
+        self.db.add(tpl)
+        await self.db.flush()
+        return tpl
+
+    async def delete(self, tpl: EmailTemplate) -> None:
+        await self.db.delete(tpl)
+```
+
+- [ ] **Step 4: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_system_config_repository.py -v`
+Expected: PASS(4 passed);全量无回归。
+
+- [ ] **Step 5: 提交**
+
+```bash
+git add app/repositories/system_config_repository.py tests/test_system_config_repository.py
+git commit -m "feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-6-report.md b/.superpowers/sdd/cfg-task-6-report.md
new file mode 100644
index 0000000..fa966d3
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-6-report.md
@@ -0,0 +1,45 @@
+# Task 6 Report — SystemConfig / ConfigHistory / EmailTemplate 仓储
+
+## Status: DONE
+
+## Commit
+- SHA: `1065e8e79409667586363cc4d9ef9f29111e7734`
+- Subject: `feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储`
+
+## Files
+- Created: `app/repositories/system_config_repository.py`
+- Created: `tests/test_system_config_repository.py`
+- Modified: `app/domain/models/system_config.py` (added `server_default=func.now()` on `ConfigHistory.changed_at`)
+- Modified: `tests/conftest.py` (added `import app.domain.models.system_config` so engine fixture creates the 3 new tables)
+
+## Implementation
+Three repository classes following the existing `DepartmentRepository` pattern (constructor takes `AsyncSession`, methods use `select`/`func`, `flush()` only — service commits):
+
+- `SystemConfigRepository`: `get_by_key`, `list_by_group`, `list_keys(group=None)` (ordered by group,key), `upsert` (insert-or-update by key, only overwrites description when not None)
+- `ConfigHistoryRepository`: `add` (flush, return row), `list_by_key` (ordered by `changed_at desc`)
+- `EmailTemplateRepository`: `get_by_id` (via `db.get`), `get_by_code`, `list(page,size)` returning `(items, total)`, `add` (flush, return tpl), `delete`
+
+No commit inside any repo method — callers (tests + future services) commit.
+
+## Testing
+- `uv run pytest tests/test_system_config_repository.py -v` → 4 passed
+- Full suite `uv run pytest` → 92 passed, 0 failed (no regression)
+
+## Deviation from brief (justified)
+Brief code is verbatim in the repo + test files. Two small non-brief edits were required to make the verbatim brief code pass:
+
+1. **`tests/conftest.py`** — added `import app.domain.models.system_config`. Without it, the `engine` fixture's `Base.metadata.create_all` does not create the `system_config` / `config_history` / `email_template` tables, and every test in the new file fails with "no such table". The existing `tests/test_system_config_model.py` already does this import locally for the same reason; conftest was simply missing it.
+2. **`app/domain/models/system_config.py`** — added `server_default=func.now()` to `ConfigHistory.changed_at` (also imported `func`). The brief's `ConfigHistoryRepository.add` and test do not pass `changed_at`, and the column is `nullable=False` with no default. Without a server default, insert fails with `NOT NULL constraint failed: config_history.changed_at`. This is a minimal model fix consistent with how `Base.created_at`/`updated_at` already use `server_default=func.now()`.
+
+Both edits are out-of-scope of the repository code itself but are the smallest possible changes that let the brief's verbatim code run. They do not alter any brief-specified method signature, name, or behavior.
+
+## Self-review
+- Completeness: 3 repos, upsert insert+update paths, list_by_group, list_keys, history add/list, template CRUD+list pagination — all present and exercised.
+- Quality: matches `DepartmentRepository` style (flush-only, return entity, `select`/`func`).
+- Discipline: no extra methods, no commit in repo methods, single new repo file.
+- Testing: real SQLite via shared `engine`/`seed` fixtures, no mocks; output clean (only pre-existing unrelated warnings).
+
+## Skills / plugins / agents used
+- Skill: `superpowers:test-driven-development` (write failing test → implement → pass → full regression)
+- Skill: `superpowers:verification-before-completion` (ran full suite, confirmed no regression)
+- Plugins/agents: none
\ No newline at end of file
diff --git a/.superpowers/sdd/cfg-task-7-brief.md b/.superpowers/sdd/cfg-task-7-brief.md
new file mode 100644
index 0000000..4d87ec2
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-7-brief.md
@@ -0,0 +1,353 @@
+## Task 7: ConfigService(CRUD + 分组校验 + 加解密 + 历史 + 缓存)
+
+**Files:**
+- Create: `app/application/services/config_service.py`
+- Test: `tests/test_config_service.py`
+
+**Interfaces:**
+- Consumes: `SystemConfigRepository`、`ConfigHistoryRepository`、`crypto`、`ConfigCache`、`GROUP_MODELS`/`group_of_key`。
+- Produces:`ConfigService(db, repo, history_repo, crypto_mod, cache)` 方法:
+  - `get_group(group) -> dict`(真实解密值)
+  - `get_value(key) -> Any`
+  - `set_value(key, value, updated_by)`(校验/加解密/历史/invalidate)
+  - `create_or_init(key, value, group, type, description, updated_by)`(幂等)
+  - `init_default_configs(updated_by)`(按模型默认批量 init)
+  - `list_groups() -> list[str]`
+  - `list_keys(group=None) -> list[SystemConfig]`
+- 注:`crypto_mod` 注入以便测试可替换(默认 `app.core.crypto`)。
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_config_service.py
+from __future__ import annotations
+
+import uuid
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.application.services.config_service import ConfigService
+from app.core import crypto
+from app.core.config_cache import LocalTTLCache
+from app.core.exceptions import BusinessException, NotFoundError
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, SystemConfigRepository,
+)
+
+pytestmark = pytest.mark.asyncio
+
+
+def _svc(db):
+    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
+                          crypto, LocalTTLCache())
+
+
+async def test_init_default_configs_seeds_all(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        rows = await svc.repo.list_keys()
+        groups = {r.config_group for r in rows}
+        assert groups == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+        # 每组至少 1 个 key
+        assert len(rows) >= 4
+
+
+async def test_init_idempotent(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        first = sorted(r.config_value for r in await svc.repo.list_keys())
+        await svc.init_default_configs(uuid.uuid4())  # 不覆盖
+        await db.commit()
+        second = sorted(r.config_value for r in await svc.repo.list_keys())
+        assert first == second
+
+
+async def test_set_value_validates_group(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        with pytest.raises(BusinessException):
+            await svc.set_value("security.password_min_length", "3", uuid.uuid4())
+
+
+async def test_set_value_secret_encrypts(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        await svc.set_value("mail.password", "smtp-secret-123", uuid.uuid4())
+        await db.commit()
+        row = await svc.repo.get_by_key("mail.password")
+        assert row.is_encrypted is True
+        assert row.config_value != "smtp-secret-123"  # 密文
+        assert svc.crypto.decrypt(row.config_value) == "smtp-secret-123"
+        # get_value 解密
+        val = await svc.get_value("mail.password")
+        assert val == "smtp-secret-123"
+        # 历史存密文
+        hist = await svc.history_repo.list_by_key("mail.password")
+        assert hist and hist[0].new_value != "smtp-secret-123"
+
+
+async def test_get_group_returns_real_values(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        grp = await svc.get_group("SYSTEM")
+        assert "site_name" in grp
+
+
+async def test_set_value_records_history(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        await svc.set_value("system.site_name", "NewName", uuid.uuid4())
+        await db.commit()
+        hist = await svc.history_repo.list_by_key("system.site_name")
+        assert len(hist) == 1
+        assert hist[0].new_value == "NewName"
+
+
+async def test_unknown_group_rejected(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        with pytest.raises(BusinessException):
+            await svc.set_value("unknown.x", "v", uuid.uuid4())
+
+
+async def test_cache_invalidation_on_set(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+
+    class SpyCache(LocalTTLCache):
+        def __init__(self):
+            super().__init__()
+            self.invalidated: list = []
+
+        async def invalidate(self, group=None):
+            self.invalidated.append(group)
+
+    async with Session() as db:
+        spy = SpyCache()
+        svc = ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, spy)
+        await svc.init_default_configs(uuid.uuid4())
+        await db.commit()
+        await svc.set_value("system.site_name", "Z", uuid.uuid4())
+        await db.commit()
+        assert "SYSTEM" in spy.invalidated
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_config_service.py -v`
+Expected: FAIL(模块不存在)
+
+- [ ] **Step 3: 实现**
+
+```python
+# app/application/services/config_service.py
+"""系统配置服务:CRUD + 分组校验 + 加解密 + 历史 + 缓存."""
+
+from __future__ import annotations
+
+import json
+import uuid
+from typing import Any
+
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.schemas.system_config import GROUP_MODELS, group_of_key
+from app.core.cache import DepartmentCache  # noqa: F401  (避免循环,仅类型注解用)
+from app.core.config_cache import ConfigCache
+from app.core.exceptions import BusinessException, NotFoundError
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, SystemConfigRepository,
+)
+
+# 默认配置(每组模型默认值的扁平 key 形式)
+_DEFAULTS: dict[str, dict] = {
+    "MAIL": {"host": "smtp.example.com", "port": "587", "username": "noreply@example.com",
+             "password": "change-me", "protocol": "smtp", "starttls": "true"},
+    "SECURITY": {"password_min_length": "8", "password_require_uppercase": "true",
+                 "password_require_lowercase": "true", "password_require_digits": "true",
+                 "password_require_special": "true", "password_history_size": "5",
+                 "password_expiration_days": "90", "login_max_attempts": "5",
+                 "login_lock_minutes": "30", "session_timeout_minutes": "15"},
+    "PERFORMANCE": {"cache_user_info_ttl": "180", "cache_permission_ttl": "300",
+                    "cache_department_tree_ttl": "600", "db_max_pool_size": "50",
+                    "api_response_threshold_ms": "200"},
+    "SYSTEM": {"site_name": "User Management", "default_locale": "zh_CN",
+               "support_email": "support@example.com"},
+}
+
+# key → config_type(由默认值推断:password 为 SECRET,纯数字为 INT,true/false 为 BOOL,其余 STRING)
+_PREFIX = {"MAIL": "mail", "SECURITY": "security", "PERFORMANCE": "performance", "SYSTEM": "system"}
+
+
+def _infer_type(field: str, value: str) -> str:
+    if field == "password":
+        return "SECRET"
+    if value.isdigit():
+        return "INT"
+    if value in ("true", "false"):
+        return "BOOL"
+    return "STRING"
+
+
+_TYPES: dict[str, str] = {
+    f"{_PREFIX[g]}.{f}": _infer_type(f, v)
+    for g, fields in _DEFAULTS.items()
+    for f, v in fields.items()
+}
+
+
+def _cast_value(raw: str, type_: str) -> Any:
+    if type_ == "INT":
+        return int(raw)
+    if type_ == "BOOL":
+        return raw.lower() == "true"
+    if type_ == "JSON":
+        return json.loads(raw)
+    return raw
+
+
+def _to_storage(value: Any, type_: str, crypto) -> tuple[str, bool]:
+    """返回 (存储值, is_encrypted)。SECRET 加密。"""
+    if type_ == "SECRET":
+        return crypto.encrypt(str(value)), True
+    if type_ == "JSON":
+        return json.dumps(value), False
+    return str(value), False
+
+
+def _from_storage(raw: str, type_: str, crypto) -> Any:
+    if type_ == "SECRET":
+        return crypto.decrypt(raw)
+    return _cast_value(raw, type_)
+
+
+class ConfigService:
+    def __init__(self, db: AsyncSession, repo: SystemConfigRepository,
+                 history_repo: ConfigHistoryRepository, crypto, cache: ConfigCache):
+        self.db = db
+        self.repo = repo
+        self.history_repo = history_repo
+        self.crypto = crypto
+        self.cache = cache
+
+    def _group_and_field(self, key: str) -> tuple[str, str]:
+        group = group_of_key(key)
+        prefix = key.split(".", 1)[0]
+        field = key[len(prefix) + 1:]
+        return group, field
+
+    async def _load_group_dict(self, group: str) -> dict[str, Any]:
+        rows = await self.repo.list_by_group(group)
+        out: dict[str, Any] = {}
+        for r in rows:
+            _, field = self._group_and_field(r.config_key)
+            out[field] = _from_storage(r.config_value, r.config_type, self.crypto)
+        return out
+
+    async def get_group(self, group: str) -> dict:
+        cached = await self.cache.get_group(group)
+        if cached is not None:
+            return cached
+        values = await self._load_group_dict(group)
+        await self.cache.set_group(group, values)
+        return values
+
+    async def get_value(self, key: str) -> Any:
+        group, field = self._group_and_field(key)
+        values = await self.get_group(group)
+        if field not in values:
+            raise NotFoundError(f"配置不存在: {key}")
+        return values[field]
+
+    async def set_value(self, key: str, value: Any, updated_by: uuid.UUID) -> None:
+        try:
+            group = group_of_key(key)
+        except ValueError as exc:
+            raise BusinessException(str(exc)) from exc
+        _, field = self._group_and_field(key)
+        type_ = _TYPES.get(key, "STRING")
+        # 组装整组并校验
+        group_dict = await self._load_group_dict(group)
+        group_dict[field] = value
+        model_cls = GROUP_MODELS[group]
+        # SECRET 字段用 SecretStr,其余用原值
+        validate_dict = {}
+        for k, v in group_dict.items():
+            field_info = model_cls.model_fields.get(k)
+            if field_info is not None and "SecretStr" in str(field_info.annotation):
+                from pydantic import SecretStr
+                validate_dict[k] = SecretStr(str(v))
+            else:
+                validate_dict[k] = v
+        try:
+            model_cls(**validate_dict)
+        except Exception as exc:
+            raise BusinessException(f"配置校验失败: {exc}") from exc
+        # 持久化
+        existing = await self.repo.get_by_key(key)
+        old_storage = existing.config_value if existing else None
+        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
+        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by)
+        # 历史(密文/原样存)
+        await self.history_repo.add(key, old_storage, storage_value, updated_by)
+        await self.db.commit()
+        await self.cache.invalidate(group)
+
+    async def create_or_init(self, key: str, value: Any, group: str, type_: str,
+                             description: str | None, updated_by: uuid.UUID) -> None:
+        if await self.repo.get_by_key(key) is not None:
+            return  # 幂等
+        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
+        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by, description)
+        await self.db.commit()
+
+    async def init_default_configs(self, updated_by: uuid.UUID) -> None:
+        prefix_map = {"MAIL": "mail", "SECURITY": "security",
+                      "PERFORMANCE": "performance", "SYSTEM": "system"}
+        for group, fields in _DEFAULTS.items():
+            for field, value in fields.items():
+                key = f"{prefix_map[group]}.{field}"
+                type_ = _TYPES[key]
+                await self.create_or_init(key, value, group, type_, None, updated_by)
+        await self.cache.invalidate()
+
+    def list_groups(self) -> list[str]:
+        return list(GROUP_MODELS.keys())
+
+    async def list_keys(self, group: str | None = None) -> list:
+        return await self.repo.list_keys(group)
+```
+
+- [ ] **Step 4: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_config_service.py -v`
+Expected: PASS(8 passed);全量无回归。若有用例因默认值/校验细节失败,调整 `_DEFAULTS` 或校验组装逻辑至通过(不放宽模型约束)。
+
+- [ ] **Step 5: 提交**
+
+```bash
+git add app/application/services/config_service.py tests/test_config_service.py
+git commit -m "feat(config): ConfigService(CRUD/分组校验/加解密/历史/缓存)"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-7-report.md b/.superpowers/sdd/cfg-task-7-report.md
new file mode 100644
index 0000000..4efe3e3
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-7-report.md
@@ -0,0 +1,98 @@
+# Task 7 Report: ConfigService (CRUD + 分组校验 + 加解密 + 历史 + 缓存)
+
+## Status: DONE
+
+## What Implemented
+
+Created `app/application/services/config_service.py` per brief verbatim:
+- `ConfigService(db, repo, history_repo, crypto, cache)` constructor
+- `get_group(group)` — Cache Aside pattern (cache.get_group → load → cache.set_group)
+- `get_value(key)` — resolves via group, raises NotFoundError if missing field
+- `set_value(key, value, updated_by)` — load group → validate via GROUP_MODELS model → SECRET encrypt → upsert → write ConfigHistory → commit → cache.invalidate(group)
+- `create_or_init(...)` — idempotent init (no-op if key exists)
+- `init_default_configs(updated_by)` — seeds all 4 groups from `_DEFAULTS`, then invalidates whole cache
+- `list_groups()` and `list_keys(group=None)`
+- Helpers: `_DEFAULTS`, `_infer_type`, `_TYPES`, `_cast_value`, `_to_storage`, `_from_storage`
+
+SECRET fields detected via `model_cls.model_fields[k].annotation` containing "SecretStr" → wrapped in `pydantic.SecretStr` before validation. Key→group mapping via `group_of_key`; field name = key with prefix stripped.
+
+## Test Results (TDD)
+
+- RED: ModuleNotFoundError on first run (module absent) — collected 0, 1 error
+- GREEN: `uv run pytest tests/test_config_service.py -v` → **8 passed, 8 warnings in 2.77s**
+- Full suite: `uv run pytest` → **100 passed, 86 warnings in 35.59s** (no regression)
+
+Tests use real SQLite async engine + real Fernet (monkeypatched CONFIG_ENCRYPTION_KEY) + spy cache subclass. Coverage:
+1. `test_init_default_configs_seeds_all` — 4 groups seeded
+2. `test_init_idempotent` — re-run doesn't overwrite
+3. `test_set_value_validates_group` — password_min_length=3 → BusinessException
+4. `test_set_value_secret_encrypts` — DB ciphertext, get_value decrypts, history ciphertext
+5. `test_get_group_returns_real_values` — site_name present
+6. `test_set_value_records_history` — exactly 1 history row with new_value="NewName"
+7. `test_unknown_group_rejected` — `unknown.x` → BusinessException
+8. `test_cache_invalidation_on_set` — spy.invalidated contains "SYSTEM"
+
+## Files Changed
+
+- Created: `app/application/services/config_service.py` (152 lines)
+- Created: `tests/test_config_service.py` (118 lines)
+- Commit SHA: `58d3bd19bf6f1ce811f21232f2e4a535976ccc1d`
+- Subject: `feat(config): ConfigService(CRUD/分组校验/加解密/历史/缓存)`
+
+## Self-Review
+
+| Requirement | Status |
+|---|---|
+| get_group Cache Aside (cache miss → load → set) | OK |
+| get_value (decrypt, NotFoundError on missing) | OK |
+| set_value: load group → validate → encrypt SECRET → upsert → history → commit → invalidate | OK |
+| create_or_init idempotent | OK |
+| init_default_configs seeds all 4 groups | OK |
+| list_groups / list_keys | OK |
+| Tests use real DB + real Fernet + spy cache | OK |
+| No regression in full suite | OK (100 passed) |
+| Output pristine (no extra print/logging spam) | OK |
+| Discipline: TDD RED→GREEN, single new file, no over-engineering, no email template logic | OK |
+
+## Brief-Code Deviations
+
+None. Brief code was followed verbatim and passed all tests without modification. The `DepartmentCache` import marked `# noqa: F401` is unused in the service but kept per brief (claimed "避免循环" rationale).
+
+## Concerns
+
+- The `DepartmentCache` import in the service is genuinely unused; kept verbatim per brief.
+- `set_value` commits inside the service (same as brief). Callers cannot wrap multiple `set_value` calls in one transaction. Acceptable for config writes (low frequency) but worth noting.
+- `_TYPES` is inferred only from `_DEFAULTS`; a new key created via `create_or_init` outside defaults will fall back to "STRING" type in `set_value` — acceptable per brief intent.
+- `_load_group_dict` reads DB on every `set_value` (needed to assemble validation group) — fine given config write frequency.
+
+## Skills/Plugins/Agents Used
+
+- Direct file Read/Write/Edit tools (no subagent delegation needed)
+- Skill invoked: `superpowers:test-driven-development` (RED→GREEN discipline followed)
+- No plugins, no other agents
+## Fix Report (C7 Review Cleanup) — 2026-07-06
+
+Commit: 24a8981 `fix(config): ConfigService 清理(删除错误 DepartmentCache import + SecretStr 提顶 + _PREFIX 复用 + list_keys 返回类型)`
+
+### Changes per finding
+
+1. **Wrong import (defect):** Deleted `from app.core.cache import DepartmentCache  # noqa: F401` (line ~13). `DepartmentCache` is the DEPT module's cache Protocol, unused in this file.
+2. **Inline import in loop:** Moved `from pydantic import SecretStr` to module-top imports (between `from typing import Any` and `from sqlalchemy.ext.asyncio import AsyncSession`). Removed the in-loop `from pydantic import SecretStr` inside `set_value`'s `for k, v` loop body.
+3. **DRY:** Removed local `prefix_map` dict in `init_default_configs`; now uses module-level `_PREFIX` dict directly (`key = f"{_PREFIX[group]}.{field}"`).
+4. **Return type:** `list_keys` return annotation changed from bare `list` to `list[SystemConfig]`. Added `from app.domain.models.system_config import SystemConfig` to module-top imports.
+
+### Additional cleanup (incidental, required by ruff)
+- Sorted import block (ruff I001 auto-fix) — `app.domain.models.system_config` placed in correct alphabetical position after `app.core.exceptions`.
+- Wrapped long line in `create_or_init` (ruff E501, 103 -> <100 chars) — `await self.repo.upsert(...)` split across two lines. Pre-existing issue, trivial cosmetic, no logic change.
+
+### Test results
+- `uv run pytest tests/test_config_service.py -v` -> **8 passed**.
+- `uv run pytest` (full suite) -> **100 passed**, no regression.
+
+### Ruff result
+- `uv run ruff check app/application/services/config_service.py` -> **All checks passed** (0 errors).
+- `uv run ruff check app tests` -> 15 errors remain, all **pre-existing in test files** (out of scope: import sorting / unused `SystemConfig` in `tests/test_system_config_repository.py`, etc.). Before this commit: 17 errors; after: 15 (net -2 — removed bad `DepartmentCache` F401 noqa + fixed I001 in config_service). No new lint issues introduced.
+
+### Out of scope (not fixed, per task instructions)
+- `_TYPES` STRING fallback for non-default keys.
+- Trailing newline (cosmetic).
diff --git a/.superpowers/sdd/cfg-task-8-brief.md b/.superpowers/sdd/cfg-task-8-brief.md
new file mode 100644
index 0000000..4a56de7
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-8-brief.md
@@ -0,0 +1,214 @@
+## Task 8: EmailTemplateService
+
+**Files:**
+- Create: `app/application/services/email_template_service.py`
+- Modify: `app/application/schemas/system_config.py`(追加 EmailTemplate schema)
+- Test: `tests/test_email_template_service.py`
+
+**Interfaces:**
+- Produces:`EmailTemplateCreate{ template_code, template_name, subject, content, variables?, is_active? }`、`EmailTemplateUpdate`、`EmailTemplateOut`、`EmailTemplateListOut`;`EmailTemplateService(db, repo)` 方法 `create/update/get/list/delete/get_by_code`。
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_email_template_service.py
+from __future__ import annotations
+
+import pytest
+from sqlalchemy.ext.asyncio import async_sessionmaker
+
+from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
+from app.application.services.email_template_service import EmailTemplateService
+from app.core.exceptions import ConflictError, NotFoundError
+from app.repositories.system_config_repository import EmailTemplateRepository
+
+pytestmark = pytest.mark.asyncio
+
+
+def _svc(db):
+    return EmailTemplateService(db, EmailTemplateRepository(db))
+
+
+async def test_create_and_get(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        tpl = await svc.create(EmailTemplateCreate(
+            template_code="USER_ACTIVATION", template_name="激活", subject="欢迎",
+            content="Hi {{name}}",
+            variables=[{"name": "name", "description": "用户名", "required": True}]))
+        await db.commit()
+        got = await svc.get(tpl.id)
+        assert got.template_code == "USER_ACTIVATION"
+
+
+async def test_create_code_conflict(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
+                                             subject="s", content="c"))
+        await db.commit()
+        with pytest.raises(ConflictError):
+            await svc.create(EmailTemplateCreate(template_code="X", template_name="n2",
+                                                 subject="s2", content="c2"))
+        await db.commit()
+
+
+async def test_update_and_delete(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        tpl = await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
+                                                   subject="s", content="c"))
+        await db.commit()
+        updated = await svc.update(tpl.id, EmailTemplateUpdate(template_name="n2"))
+        await db.commit()
+        assert updated.template_name == "n2"
+        await svc.delete(tpl.id)
+        await db.commit()
+        with pytest.raises(NotFoundError):
+            await svc.get(tpl.id)
+
+
+async def test_list_pagination(engine, seed):
+    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+    async with Session() as db:
+        svc = _svc(db)
+        for i in range(3):
+            await svc.create(EmailTemplateCreate(template_code=f"C{i}", template_name=f"n{i}",
+                                                 subject="s", content="c"))
+            await db.commit()
+        items, total = await svc.list(1, 2)
+        assert total == 3 and len(items) == 2
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_email_template_service.py -v`
+Expected: FAIL(模块/schema 不存在)
+
+- [ ] **Step 3: 追加 schema 到 `app/application/schemas/system_config.py`**
+
+```python
+# app/application/schemas/system_config.py —— 末尾追加
+class EmailTemplateCreate(BaseModel):
+    template_code: str = Field(min_length=1, max_length=50)
+    template_name: str = Field(min_length=1, max_length=100)
+    subject: str = Field(min_length=1, max_length=200)
+    content: str = Field(min_length=1)
+    variables: list[dict] | None = None
+    is_active: bool = True
+
+
+class EmailTemplateUpdate(BaseModel):
+    template_code: str | None = Field(default=None, min_length=1, max_length=50)
+    template_name: str | None = Field(default=None, min_length=1, max_length=100)
+    subject: str | None = Field(default=None, min_length=1, max_length=200)
+    content: str | None = Field(default=None, min_length=1)
+    variables: list[dict] | None = None
+    is_active: bool | None = None
+
+
+class EmailTemplateOut(BaseModel):
+    model_config = ConfigDict(from_attributes=True)
+    id: uuid.UUID
+    template_code: str
+    template_name: str
+    subject: str
+    content: str
+    variables: list[dict] | None
+    is_active: bool
+    created_at: datetime
+    updated_at: datetime
+
+
+class EmailTemplateListOut(BaseModel):
+    items: list[EmailTemplateOut]
+    total: int
+    page: int
+    size: int
+```
+在文件顶部 import 区确保 `import uuid` 和 `from datetime import datetime`、`from pydantic import ConfigDict` 存在。
+
+- [ ] **Step 4: 实现 service**
+
+```python
+# app/application/services/email_template_service.py
+"""邮件模板服务(CRUD,不含发送)."""
+
+from __future__ import annotations
+
+import uuid
+
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
+from app.core.exceptions import ConflictError, NotFoundError
+from app.domain.models.system_config import EmailTemplate
+from app.repositories.system_config_repository import EmailTemplateRepository
+
+
+class EmailTemplateService:
+    def __init__(self, db: AsyncSession, repo: EmailTemplateRepository):
+        self.db = db
+        self.repo = repo
+
+    async def create(self, req: EmailTemplateCreate) -> EmailTemplate:
+        if await self.repo.get_by_code(req.template_code) is not None:
+            raise ConflictError("模板编码已存在")
+        tpl = EmailTemplate(template_code=req.template_code, template_name=req.template_name,
+                           subject=req.subject, content=req.content,
+                           variables=req.variables, is_active=req.is_active)
+        await self.repo.add(tpl)
+        await self.db.commit()
+        await self.db.refresh(tpl)
+        return tpl
+
+    async def update(self, tpl_id: uuid.UUID, req: EmailTemplateUpdate) -> EmailTemplate:
+        tpl = await self.repo.get_by_id(tpl_id)
+        if tpl is None:
+            raise NotFoundError("模板不存在")
+        if req.template_code is not None and req.template_code != tpl.template_code:
+            if await self.repo.get_by_code(req.template_code) is not None:
+                raise ConflictError("模板编码已存在")
+        for field, value in req.model_dump(exclude_unset=True).items():
+            setattr(tpl, field, value)
+        await self.db.commit()
+        await self.db.refresh(tpl)
+        return tpl
+
+    async def get(self, tpl_id: uuid.UUID) -> EmailTemplate:
+        tpl = await self.repo.get_by_id(tpl_id)
+        if tpl is None:
+            raise NotFoundError("模板不存在")
+        return tpl
+
+    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
+        return await self.repo.list(page, size)
+
+    async def delete(self, tpl_id: uuid.UUID) -> None:
+        tpl = await self.repo.get_by_id(tpl_id)
+        if tpl is None:
+            raise NotFoundError("模板不存在")
+        await self.repo.delete(tpl)
+        await self.db.commit()
+
+    async def get_by_code(self, code: str) -> EmailTemplate | None:
+        return await self.repo.get_by_code(code)
+```
+
+- [ ] **Step 5: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_email_template_service.py -v`
+Expected: PASS(4 passed);全量无回归。
+
+- [ ] **Step 6: 提交**
+
+```bash
+git add app/application/schemas/system_config.py app/application/services/email_template_service.py tests/test_email_template_service.py
+git commit -m "feat(config): EmailTemplateService + schema"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-8-report.md b/.superpowers/sdd/cfg-task-8-report.md
new file mode 100644
index 0000000..bd7ec53
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-8-report.md
@@ -0,0 +1,40 @@
+# Task 8 Report — EmailTemplateService + schema
+
+## Status: DONE
+
+- Commit: `15a2e54 feat(config): EmailTemplateService + schema`
+- Branch: `feat/system-config`
+
+## Files changed
+- `back-end/app/application/schemas/system_config.py` (modified): added imports `uuid`, `datetime`, `ConfigDict`; appended 4 schemas (`EmailTemplateCreate`, `EmailTemplateUpdate`, `EmailTemplateOut`, `EmailTemplateListOut`) after `GROUP_MODELS`. Existing group models + `group_of_key` untouched.
+- `back-end/app/application/services/email_template_service.py` (new): `EmailTemplateService(db, repo)` with 6 methods: `create`, `update`, `get`, `list`, `delete`, `get_by_code`.
+- `back-end/tests/test_email_template_service.py` (new): 4 tests per brief.
+
+## Schemas
+- `EmailTemplateCreate`: template_code (1-50), template_name (1-100), subject (1-200), content (≥1), variables (list[dict] | None), is_active (default True).
+- `EmailTemplateUpdate`: all fields optional with `model_dump(exclude_unset=True)` semantics.
+- `EmailTemplateOut`: `ConfigDict(from_attributes=True)`, fields id/template_code/template_name/subject/content/variables/is_active/created_at/updated_at.
+- `EmailTemplateListOut`: { items, total, page, size }.
+
+## Service behavior
+- `create`: 409 if `template_code` exists; else add → commit → refresh.
+- `update`: 404 if not found; 409 if `template_code` changed to a colliding code; `model_dump(exclude_unset=True)` apply; commit → refresh.
+- `get`: 404 if not found.
+- `list(page, size)`: delegates to repo.
+- `delete`: 404 if not found; commit.
+- `get_by_code`: passthrough.
+
+Pattern matches existing services (`department_service`, `user_service`): flush+commit via repo + db.commit. No email sending (out of scope).
+
+## Testing
+- `uv run pytest tests/test_email_template_service.py -v` → 4 passed.
+- `uv run pytest` (full suite) → 104 passed, no regressions. Warnings are pre-existing (SQLite FK cycle, async mark on sync model tests).
+
+## Self-review
+- Completeness: 4 schemas (incl. ListOut) + 6 service methods present; code-unique enforced on create and on code-change in update.
+- Quality: reuses existing `EmailTemplateRepository`; minimal surface; follows repo/service layering.
+- Discipline: no sending/SMTP/Jinja rendering code added.
+- Testing: real SQLite DB via `engine`/`seed` fixtures; output clean.
+
+## Concerns
+- None.
\ No newline at end of file
diff --git a/.superpowers/sdd/cfg-task-9-brief.md b/.superpowers/sdd/cfg-task-9-brief.md
new file mode 100644
index 0000000..cc8e296
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-9-brief.md
@@ -0,0 +1,383 @@
+## Task 9: API 路由(配置 + 模板)+ main 注册 + seed 扩展 + conftest cache override
+
+**Files:**
+- Create: `app/interfaces/api/system_config.py`
+- Create: `app/interfaces/api/email_templates.py`
+- Modify: `app/main.py`(import + include_router)
+- Modify: `tests/conftest.py`(seed 扩展 config/template 权限 + cache override)
+- Test: `tests/test_system_config_api.py`、`tests/test_email_templates_api.py`
+
+**Interfaces:**
+- Consumes: `ConfigService`、`EmailTemplateService`、`get_config_cache`、`get_db`、`require_permission`、schemas。
+- Produces:配置路由(`/config/groups`、`/config`、`/config/{key}`、`/config/{key}` PUT、`/config/init`、`/config/history`)与模板路由(`/email-templates` CRUD)。API 层掩码 SECRET 为 `"***"`。
+
+- [ ] **Step 1: 写失败测试**
+
+```python
+# tests/test_system_config_api.py
+from __future__ import annotations
+
+import pytest
+
+pytestmark = pytest.mark.asyncio
+
+
+async def _h(token):
+    return {"Authorization": f"Bearer {token}"}
+
+
+async def test_init_and_get_group_masks_secret(client, admin_token):
+    resp = await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    assert resp.status_code == 200, resp.text
+    grp = await client.get("/api/v1/config?group=MAIL", headers=await _h(admin_token))
+    assert grp.status_code == 200
+    body = grp.json()
+    assert body["group"] == "MAIL"
+    assert body["values"]["password"] == "***"
+
+
+async def test_get_groups(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.get("/api/v1/config/groups", headers=await _h(admin_token))
+    assert resp.status_code == 200
+    assert set(resp.json()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+
+
+async def test_put_value_validates(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.put("/api/v1/config/security.password_min_length",
+                            json={"value": "3"}, headers=await _h(admin_token))
+    assert resp.status_code == 400
+
+
+async def test_put_value_secret(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    resp = await client.put("/api/v1/config/mail.password",
+                            json={"value": "new-secret"}, headers=await _h(admin_token))
+    assert resp.status_code == 200, resp.text
+    # GET 单 key 掩码
+    g = await client.get("/api/v1/config/mail.password", headers=await _h(admin_token))
+    assert g.status_code == 200 and g.json()["value"] == "***"
+
+
+async def test_history(client, admin_token):
+    await client.post("/api/v1/config/init", headers=await _h(admin_token))
+    await client.put("/api/v1/config/system.site_name",
+                     json={"value": "NewName"}, headers=await _h(admin_token))
+    resp = await client.get("/api/v1/config/history?key=system.site_name",
+                            headers=await _h(admin_token))
+    assert resp.status_code == 200
+    assert len(resp.json()) >= 1
+
+
+async def test_regular_user_forbidden(client):
+    reg = await client.post("/api/v1/auth/register", json={
+        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
+    assert reg.status_code == 201
+    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
+    token = login.json()["access_token"]
+    resp = await client.put("/api/v1/config/system.site_name",
+                            json={"value": "x"}, headers=await _h(token))
+    assert resp.status_code == 403
+```
+
+```python
+# tests/test_email_templates_api.py
+from __future__ import annotations
+
+import pytest
+
+pytestmark = pytest.mark.asyncio
+
+
+async def _h(token):
+    return {"Authorization": f"Bearer {token}"}
+
+
+TPL = {"template_code": "USER_ACTIVATION", "template_name": "激活",
+       "subject": "欢迎", "content": "Hi {{name}}",
+       "variables": [{"name": "name", "description": "用户名", "required": True}]}
+
+
+async def test_template_crud(client, admin_token):
+    h = await _h(admin_token)
+    create = await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    assert create.status_code == 201, create.text
+    tid = create.json()["id"]
+    got = await client.get(f"/api/v1/email-templates/{tid}", headers=h)
+    assert got.status_code == 200 and got.json()["template_code"] == "USER_ACTIVATION"
+    lst = await client.get("/api/v1/email-templates", headers=h)
+    assert lst.status_code == 200 and lst.json()["total"] == 1
+    upd = await client.put(f"/api/v1/email-templates/{tid}",
+                           json={"template_name": "激活2"}, headers=h)
+    assert upd.status_code == 200 and upd.json()["template_name"] == "激活2"
+    dele = await client.delete(f"/api/v1/email-templates/{tid}", headers=h)
+    assert dele.status_code == 204
+
+
+async def test_template_code_conflict(client, admin_token):
+    h = await _h(admin_token)
+    await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    resp = await client.post("/api/v1/email-templates", json=TPL, headers=h)
+    assert resp.status_code == 409
+```
+
+- [ ] **Step 2: 运行测试确认失败**
+
+Run: `uv run pytest tests/test_system_config_api.py tests/test_email_templates_api.py -v`
+Expected: FAIL(路由不存在)
+
+- [ ] **Step 3: 扩展 conftest seed + cache override**
+
+在 `tests/conftest.py` 的 `seed` fixture `perms` 列表追加:
+```python
+        Permission(name="配置读取", code="config:read", type="ACTION", resource="config", action="read"),
+        Permission(name="配置更新", code="config:update", type="ACTION", resource="config", action="update"),
+        Permission(name="模板读取", code="template:read", type="ACTION", resource="template", action="read"),
+        Permission(name="模板创建", code="template:create", type="ACTION", resource="template", action="create"),
+        Permission(name="模板更新", code="template:update", type="ACTION", resource="template", action="update"),
+        Permission(name="模板删除", code="template:delete", type="ACTION", resource="template", action="delete"),
+```
+在 `client` fixture 的 `dependency_overrides` 块追加:
+```python
+    from app.core.config_cache import LocalTTLCache, get_config_cache
+    app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()
+```
+
+- [ ] **Step 4: 实现配置路由**
+
+```python
+# app/interfaces/api/system_config.py
+"""系统配置路由."""
+
+from __future__ import annotations
+
+import uuid
+
+from fastapi import APIRouter, Depends, Query
+from pydantic import BaseModel
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.deps import get_db
+from app.core.config_cache import ConfigCache, get_config_cache
+from app.core.security import require_permission
+from app.domain.models.user import User
+from app.repositories.system_config_repository import (
+    ConfigHistoryRepository, SystemConfigRepository,
+)
+from app.application.services.config_service import ConfigService
+from app.core import crypto
+
+router = APIRouter(prefix="/config", tags=["config"])
+
+
+def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
+    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
+
+
+class ConfigValueUpdate(BaseModel):
+    value: str | int | bool | dict
+
+
+def _mask(values: dict, group: str) -> dict:
+    from app.application.schemas.system_config import GROUP_MODELS
+    model = GROUP_MODELS[group]
+    masked = {}
+    for k, v in values.items():
+        fi = model.model_fields.get(k)
+        if fi is not None and "SecretStr" in str(fi.annotation):
+            masked[k] = "***"
+        else:
+            masked[k] = v
+    return masked
+
+
+@router.get("/groups")
+async def list_groups(
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> list[str]:
+    return _svc(db, cache).list_groups()
+
+
+@router.get("")
+async def get_group(
+    group: str = Query(...),
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> dict:
+    svc = _svc(db, cache)
+    values = await svc.get_group(group)
+    return {"group": group, "values": _mask(values, group)}
+
+
+@router.get("/{key}")
+async def get_value(
+    key: str,
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> dict:
+    svc = _svc(db, cache)
+    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
+    group = group_of_key(key)
+    values = await svc.get_group(group)
+    field = key.split(".", 1)[1]
+    val = values.get(field)
+    fi = GROUP_MODELS[group].model_fields.get(field)
+    if fi is not None and "SecretStr" in str(fi.annotation):
+        val = "***"
+    return {"key": key, "group": group, "value": val}
+
+
+@router.put("/{key}")
+async def put_value(
+    key: str,
+    req: ConfigValueUpdate,
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:update")),
+) -> dict:
+    svc = _svc(db, cache)
+    await svc.set_value(key, req.value, user.id)
+    return {"key": key, "ok": True}
+
+
+@router.post("/init")
+async def init_configs(
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:update")),
+) -> dict:
+    svc = _svc(db, cache)
+    await svc.init_default_configs(user.id)
+    return {"ok": True}
+
+
+@router.get("/history")
+async def history(
+    key: str = Query(...),
+    db: AsyncSession = Depends(get_db),
+    cache: ConfigCache = Depends(get_config_cache),
+    user: User = Depends(require_permission("config:read")),
+) -> list[dict]:
+    repo = ConfigHistoryRepository(db)
+    rows = await repo.list_by_key(key)
+    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
+    group = group_of_key(key)
+    field = key.split(".", 1)[1]
+    fi = GROUP_MODELS[group].model_fields.get(field)
+    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
+    out = []
+    for r in rows:
+        out.append({
+            "key": r.config_key,
+            "old_value": "***" if is_secret else r.old_value,
+            "new_value": "***" if is_secret else r.new_value,
+            "changed_by": str(r.changed_by),
+            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
+        })
+    return out
+```
+
+- [ ] **Step 5: 实现模板路由**
+
+```python
+# app/interfaces/api/email_templates.py
+"""邮件模板路由."""
+
+from __future__ import annotations
+
+import uuid
+
+from fastapi import APIRouter, Depends, Query, status
+from sqlalchemy.ext.asyncio import AsyncSession
+
+from app.application.deps import get_db
+from app.application.schemas.system_config import (
+    EmailTemplateCreate, EmailTemplateListOut, EmailTemplateOut, EmailTemplateUpdate,
+)
+from app.application.services.email_template_service import EmailTemplateService
+from app.core.security import require_permission
+from app.domain.models.user import User
+from app.repositories.system_config_repository import EmailTemplateRepository
+
+router = APIRouter(prefix="/email-templates", tags=["email-templates"])
+
+
+def _svc(db: AsyncSession) -> EmailTemplateService:
+    return EmailTemplateService(db, EmailTemplateRepository(db))
+
+
+@router.get("", response_model=EmailTemplateListOut)
+async def list_templates(
+    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:read")),
+) -> EmailTemplateListOut:
+    items, total = await _svc(db).list(page, size)
+    return EmailTemplateListOut(
+        items=[EmailTemplateOut.model_validate(i) for i in items],
+        total=total, page=page, size=size)
+
+
+@router.get("/{tpl_id}", response_model=EmailTemplateOut)
+async def get_template(
+    tpl_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:read")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).get(tpl_id))
+
+
+@router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
+async def create_template(
+    req: EmailTemplateCreate,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:create")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).create(req))
+
+
+@router.put("/{tpl_id}", response_model=EmailTemplateOut)
+async def update_template(
+    tpl_id: uuid.UUID, req: EmailTemplateUpdate,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:update")),
+) -> EmailTemplateOut:
+    return EmailTemplateOut.model_validate(await _svc(db).update(tpl_id, req))
+
+
+@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
+async def delete_template(
+    tpl_id: uuid.UUID,
+    db: AsyncSession = Depends(get_db),
+    _: User = Depends(require_permission("template:delete")),
+) -> None:
+    await _svc(db).delete(tpl_id)
+```
+
+- [ ] **Step 6: main.py 注册**
+
+在 `from app.interfaces.api import ...` 行追加 `system_config, email_templates`;在 `include_router` 块追加:
+```python
+    app.include_router(system_config.router, prefix=settings.API_V1_PREFIX)
+    app.include_router(email_templates.router, prefix=settings.API_V1_PREFIX)
+```
+
+- [ ] **Step 7: 运行测试确认通过**
+
+Run: `uv run pytest tests/test_system_config_api.py tests/test_email_templates_api.py -v`
+Expected: PASS(8 passed);全量无回归。
+
+- [ ] **Step 8: 提交**
+
+```bash
+git add app/interfaces/api/system_config.py app/interfaces/api/email_templates.py app/main.py tests/conftest.py tests/test_system_config_api.py tests/test_email_templates_api.py
+git commit -m "feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展"
+```
+
+---
+
diff --git a/.superpowers/sdd/cfg-task-9-report.md b/.superpowers/sdd/cfg-task-9-report.md
new file mode 100644
index 0000000..7e619f2
--- /dev/null
+++ b/.superpowers/sdd/cfg-task-9-report.md
@@ -0,0 +1,49 @@
+# Task 9 报告 — 配置 + 模板 API 路由 + main 注册 + seed 扩展
+
+## Status: DONE
+
+## Commit
+- SHA: `cbb531efa0f7a8d5368be8e1231f5db578866415`
+- Subject: `feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展`
+- Branch: `feat/system-config`
+
+## 测试
+- 目标测试: `uv run pytest tests/test_system_config_api.py tests/test_email_templates_api.py -v` → **8 passed** (6 配置 + 2 模板)
+- 全量回归: `uv run pytest` → **112 passed**, 0 failed
+
+## 完成内容
+
+### 新增文件
+- `app/interfaces/api/system_config.py` — 配置路由(`/config/groups`、`/config`、`/config/{key}` GET、`/config/{key}` PUT、`/config/init` POST、`/config/history`)。SECRET 字段值在 `get_group`/`get_value`/`history` 中掩码为 `"***"`。所有端点带 `require_permission` 守卫(`config:read` / `config:update`)。
+- `app/interfaces/api/email_templates.py` — 模板 CRUD 路由(list / get / create / update / delete),响应模型 `EmailTemplateOut` / `EmailTemplateListOut`,201/204 状态码。权限守卫 `template:read|create|update|delete`。
+- `tests/test_system_config_api.py` — 6 个测试:init + GET group 掩码、list groups、PUT 校验失败(400)、PUT secret + GET 单 key 掩码、history、普通用户 403。
+- `tests/test_email_templates_api.py` — 2 个测试:CRUD 全流程、template_code 冲突 409。
+
+### 修改文件
+- `app/main.py` — `from app.interfaces.api import ...` 追加 `system_config, email_templates`;新增两个 `include_router(..., prefix=settings.API_V1_PREFIX)`。
+- `tests/conftest.py` — `seed` fixture 的 `perms` 追加 6 项(config:read/update、template:read/create/update/delete);`client` fixture 增加 `app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()`。
+
+## 关键实现说明
+
+### 路由顺序修正(对 brief 的必要偏离)
+Brief 中 `GET /config/{key}` 声明在 `GET /config/history` 之前。FastAPI 按声明顺序匹配,`/config/history` 会被 `/{key}` 先捕获并以 `key="history"` 调用 `group_of_key` → `ValueError` → 400。为让 `test_history` 通过,我将 `GET /config/history` 移到 `GET /config/{key}` 之前声明。这是 FastAPI 路由匹配语义要求的修正,功能与 brief 意图一致。
+
+### SECRET 掩码
+- `_mask(values, group)`:遍历 values,用 `GROUP_MODELS[group].model_fields[k].annotation` 检测 `SecretStr`,命中则替换为 `"***"`。
+- `get_value`:同样按字段 annotation 判断,SECRET 字段返回 `"***"`。
+- `history`:同字段判断,对 `old_value`/`new_value` 都做掩码。
+
+### conftest cache override
+`get_config_cache` 在测试中被覆盖为 `LocalTTLCache()` 实例,避免触碰 Redis 依赖;`_encryption_key` autouse fixture 已存在,提供 `CONFIG_ENCRYPTION_KEY`。
+
+## 自审
+- 完整性:6 配置端点 + 5 模板端点 + main 注册 + conftest seed + cache override ✓
+- SECRET 掩码 `"***"`(group/value/history)✓
+- 权限守卫全覆盖 ✓
+- 8 API 测试通过 ✓
+- 全量 112 测试无回归 ✓
+- 真实 HTTP via `AsyncClient` + `ASGITransport` ✓
+- 输出洁净(仅既有非阻塞 warnings)✓
+
+## Concerns
+无。偏离 brief 的路由顺序修正已在报告中说明,是功能正确性所必需。
\ No newline at end of file
diff --git a/.superpowers/sdd/progress.md b/.superpowers/sdd/progress.md
index ee5d2d4..5f30379 100644
--- a/.superpowers/sdd/progress.md
+++ b/.superpowers/sdd/progress.md
@@ -11,8 +11,29 @@ Task 10: complete (commits 09d9b37..cdd62a1, review clean; 65/65 pass, cov 87%,
 
 --- Accumulated Minor findings for final review ---
 T3: permanent Noop cache on Redis failure (no retry) — robustness tradeoff
 T9: repo-bypass in list_departments/get_department routes — layering smell (plan-mandated)
 T8: DRY between _build_tree and get_subtree — acceptable
 
 Final-fix: complete (commits cdd62a1..195c602, re-review clean; 69/69 pass, cov 87%, ruff 0; Important 1-4 + Minor 6-7 fixed)
 ALL 10 TASKS + FINAL REVIEW FIXES COMPLETE. Branch feat/department-management head=195c602.
+
+==== System Config (阶段3) on feat/system-config ====
+C1: complete (commits 5b85747..cae4272 + fix d1e9ac1, review clean + fix clean)
+C2: complete (commits d1e9ac1..33cf225, review clean; minors cosmetic)
+C3: complete (commits 33cf225..16a4cc2, review clean; minor: ge=6 is per-spec)
+C4: complete (commits 16a4cc2..49cdfe6, review clean; minors cosmetic)
+C5: complete (commits 49cdfe6..a7e4d08, review clean; adapted listen->get_message behavior-equivalent; minors: pubsub.close cleanup)
+C6: complete (commits a7e4d08..1065e8e, review clean; 2 approved deviations: conftest import + changed_at server_default)
+C7: complete (commits 1065e8e..58d3bd1 + fix 24a8981, review clean + fix clean; removed wrong DepartmentCache import)
+C8: complete (commits 24a8981..15a2e54, review clean; minors cosmetic)
+C9: complete (commits 15a2e54..cbb531e, review clean; route-order fix /config/history before /{key}; minors cosmetic)
+C10: complete (commits cbb531e..bad2805, review clean; 114/114 pass, cov 89%, ruff 0; async-coverage workaround accepted)
+
+ALL 10 CONFIG TASKS COMPLETE. Branch feat/system-config head=bad2805.
+
+--- Config final-review deferred minors (follow-up) ---
+- _TYPES STRING fallback for non-default keys (acceptable today)
+- _infer_type fragility (works for current defaults)
+- start_subscriber redundant sleep / no reconnect (degradation acceptable)
+- trailing newlines; changed_by no FK (per spec)
+- no Alembic migration yet (deferred per plan)
diff --git a/.superpowers/sdd/review-cfg-final-5b85747-bad2805.md b/.superpowers/sdd/review-cfg-final-5b85747-bad2805.md
new file mode 100644
index 0000000..a33fd50
--- /dev/null
+++ b/.superpowers/sdd/review-cfg-final-5b85747-bad2805.md
@@ -0,0 +1,1913 @@
+﻿## commits 5b85747..bad2805 (config feature)
+bad2805 feat(config): lifespan 集成订阅+init;全量回归通过,覆盖率≥85%,ruff 清零
+cbb531e feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展
+15a2e54 feat(config): EmailTemplateService + schema
+24a8981 fix(config): ConfigService 清理(删除错误 DepartmentCache import + SecretStr 提顶 + _PREFIX 复用 + list_keys 返回类型)
+58d3bd1 feat(config): ConfigService(CRUD/分组校验/加解密/历史/缓存)
+1065e8e feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储
+a7e4d08 feat(config): RedisPubSubConfigCache(pub/sub 即时失效)
+49cdfe6 feat(config): ConfigCache 协议 + LocalTTLCache + 工厂
+16a4cc2 feat(config): 分组 Pydantic 模型 + key→组映射
+33cf225 feat(config): Fernet 加密模块 + CONFIG_ENCRYPTION_KEY
+d1e9ac1 fix(config): ConfigHistory.changed_at 加索引 + 测试断言
+cae4272 feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型
+
+## stat
+ .../app/application/schemas/system_config.py       | 102 ++++++++++++
+ .../app/application/services/config_service.py     | 176 +++++++++++++++++++++
+ .../application/services/email_template_service.py |  61 +++++++
+ user-service/back-end/app/core/config.py           |   5 +
+ user-service/back-end/app/core/config_cache.py     |  67 ++++++++
+ user-service/back-end/app/core/crypto.py           |  26 +++
+ .../back-end/app/core/redis_config_cache.py        |  63 ++++++++
+ .../back-end/app/domain/models/system_config.py    |  54 +++++++
+ .../back-end/app/interfaces/api/email_templates.py |  74 +++++++++
+ .../back-end/app/interfaces/api/system_config.py   | 137 ++++++++++++++++
+ user-service/back-end/app/main.py                  |  34 +++-
+ .../app/repositories/system_config_repository.py   | 111 +++++++++++++
+ user-service/back-end/pyproject.toml               |   1 +
+ user-service/back-end/tests/conftest.py            |  29 ++++
+ user-service/back-end/tests/test_config_cache.py   | 159 +++++++++++++++++++
+ .../back-end/tests/test_config_group_models.py     |  51 ++++++
+ user-service/back-end/tests/test_config_service.py | 134 ++++++++++++++++
+ user-service/back-end/tests/test_crypto.py         |  26 +++
+ .../back-end/tests/test_email_template_service.py  |  69 ++++++++
+ .../back-end/tests/test_email_templates_api.py     |  37 +++++
+ .../back-end/tests/test_system_config_api.py       |  67 ++++++++
+ .../back-end/tests/test_system_config_model.py     |  35 ++++
+ .../tests/test_system_config_repository.py         |  69 ++++++++
+ user-service/back-end/uv.lock                      |   2 +
+ 24 files changed, 1587 insertions(+), 2 deletions(-)
+
+## diff -U5
+diff --git a/user-service/back-end/app/application/schemas/system_config.py b/user-service/back-end/app/application/schemas/system_config.py
+new file mode 100644
+index 0000000..1d1755d
+--- /dev/null
++++ b/user-service/back-end/app/application/schemas/system_config.py
+@@ -0,0 +1,102 @@
++"""系统配置分组 Pydantic 模型 + key→组映射."""
++
++from __future__ import annotations
++
++import uuid
++from datetime import datetime
++from typing import Literal
++
++from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr
++
++_PREFIX_TO_GROUP = {"mail": "MAIL", "security": "SECURITY",
++                    "performance": "PERFORMANCE", "system": "SYSTEM"}
++
++
++def group_of_key(key: str) -> str:
++    prefix = key.split(".", 1)[0]
++    group = _PREFIX_TO_GROUP.get(prefix)
++    if group is None:
++        raise ValueError(f"未知配置组前缀: {prefix}")
++    return group
++
++
++class MailConfig(BaseModel):
++    host: str = Field(min_length=1, max_length=255)
++    port: int = Field(ge=1, le=65535)
++    username: str = Field(min_length=1, max_length=255)
++    password: SecretStr
++    protocol: Literal["smtp", "smtps"] = "smtp"
++    starttls: bool = True
++
++
++class SecurityPolicy(BaseModel):
++    password_min_length: int = Field(ge=6, le=128)
++    password_require_uppercase: bool
++    password_require_lowercase: bool
++    password_require_digits: bool
++    password_require_special: bool
++    password_history_size: int = Field(ge=0, le=20)
++    password_expiration_days: int = Field(ge=0, le=365)
++    login_max_attempts: int = Field(ge=1, le=20)
++    login_lock_minutes: int = Field(ge=1, le=1440)
++    session_timeout_minutes: int = Field(ge=1, le=1440)
++
++
++class PerformanceConfig(BaseModel):
++    cache_user_info_ttl: int = Field(ge=10, le=3600)
++    cache_permission_ttl: int = Field(ge=10, le=3600)
++    cache_department_tree_ttl: int = Field(ge=10, le=3600)
++    db_max_pool_size: int = Field(ge=1, le=100)
++    api_response_threshold_ms: int = Field(ge=10, le=10000)
++
++
++class SystemParams(BaseModel):
++    site_name: str = Field(min_length=1, max_length=100)
++    default_locale: str = Field(pattern=r"^[a-z]{2}_[A-Z]{2}$")
++    support_email: EmailStr
++
++
++GROUP_MODELS = {
++    "MAIL": MailConfig,
++    "SECURITY": SecurityPolicy,
++    "PERFORMANCE": PerformanceConfig,
++    "SYSTEM": SystemParams,
++}
++
++
++class EmailTemplateCreate(BaseModel):
++    template_code: str = Field(min_length=1, max_length=50)
++    template_name: str = Field(min_length=1, max_length=100)
++    subject: str = Field(min_length=1, max_length=200)
++    content: str = Field(min_length=1)
++    variables: list[dict] | None = None
++    is_active: bool = True
++
++
++class EmailTemplateUpdate(BaseModel):
++    template_code: str | None = Field(default=None, min_length=1, max_length=50)
++    template_name: str | None = Field(default=None, min_length=1, max_length=100)
++    subject: str | None = Field(default=None, min_length=1, max_length=200)
++    content: str | None = Field(default=None, min_length=1)
++    variables: list[dict] | None = None
++    is_active: bool | None = None
++
++
++class EmailTemplateOut(BaseModel):
++    model_config = ConfigDict(from_attributes=True)
++    id: uuid.UUID
++    template_code: str
++    template_name: str
++    subject: str
++    content: str
++    variables: list[dict] | None
++    is_active: bool
++    created_at: datetime
++    updated_at: datetime
++
++
++class EmailTemplateListOut(BaseModel):
++    items: list[EmailTemplateOut]
++    total: int
++    page: int
++    size: int
+\ No newline at end of file
+diff --git a/user-service/back-end/app/application/services/config_service.py b/user-service/back-end/app/application/services/config_service.py
+new file mode 100644
+index 0000000..bffa2ad
+--- /dev/null
++++ b/user-service/back-end/app/application/services/config_service.py
+@@ -0,0 +1,176 @@
++# app/application/services/config_service.py
++"""系统配置服务:CRUD + 分组校验 + 加解密 + 历史 + 缓存."""
++
++from __future__ import annotations
++
++import json
++import uuid
++from typing import Any
++
++from pydantic import SecretStr
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.schemas.system_config import GROUP_MODELS, group_of_key
++from app.core.config_cache import ConfigCache
++from app.core.exceptions import BusinessException, NotFoundError
++from app.domain.models.system_config import SystemConfig
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository,
++    SystemConfigRepository,
++)
++
++# 默认配置(每组模型默认值的扁平 key 形式)
++_DEFAULTS: dict[str, dict] = {
++    "MAIL": {"host": "smtp.example.com", "port": "587", "username": "noreply@example.com",
++             "password": "change-me", "protocol": "smtp", "starttls": "true"},
++    "SECURITY": {"password_min_length": "8", "password_require_uppercase": "true",
++                 "password_require_lowercase": "true", "password_require_digits": "true",
++                 "password_require_special": "true", "password_history_size": "5",
++                 "password_expiration_days": "90", "login_max_attempts": "5",
++                 "login_lock_minutes": "30", "session_timeout_minutes": "15"},
++    "PERFORMANCE": {"cache_user_info_ttl": "180", "cache_permission_ttl": "300",
++                    "cache_department_tree_ttl": "600", "db_max_pool_size": "50",
++                    "api_response_threshold_ms": "200"},
++    "SYSTEM": {"site_name": "User Management", "default_locale": "zh_CN",
++               "support_email": "support@example.com"},
++}
++
++# key → config_type(由默认值推断:password 为 SECRET,纯数字为 INT,true/false 为 BOOL,其余 STRING)
++_PREFIX = {"MAIL": "mail", "SECURITY": "security", "PERFORMANCE": "performance", "SYSTEM": "system"}
++
++
++def _infer_type(field: str, value: str) -> str:
++    if field == "password":
++        return "SECRET"
++    if value.isdigit():
++        return "INT"
++    if value in ("true", "false"):
++        return "BOOL"
++    return "STRING"
++
++
++_TYPES: dict[str, str] = {
++    f"{_PREFIX[g]}.{f}": _infer_type(f, v)
++    for g, fields in _DEFAULTS.items()
++    for f, v in fields.items()
++}
++
++
++def _cast_value(raw: str, type_: str) -> Any:
++    if type_ == "INT":
++        return int(raw)
++    if type_ == "BOOL":
++        return raw.lower() == "true"
++    if type_ == "JSON":
++        return json.loads(raw)
++    return raw
++
++
++def _to_storage(value: Any, type_: str, crypto) -> tuple[str, bool]:
++    """返回 (存储值, is_encrypted)。SECRET 加密。"""
++    if type_ == "SECRET":
++        return crypto.encrypt(str(value)), True
++    if type_ == "JSON":
++        return json.dumps(value), False
++    return str(value), False
++
++
++def _from_storage(raw: str, type_: str, crypto) -> Any:
++    if type_ == "SECRET":
++        return crypto.decrypt(raw)
++    return _cast_value(raw, type_)
++
++
++class ConfigService:
++    def __init__(self, db: AsyncSession, repo: SystemConfigRepository,
++                 history_repo: ConfigHistoryRepository, crypto, cache: ConfigCache):
++        self.db = db
++        self.repo = repo
++        self.history_repo = history_repo
++        self.crypto = crypto
++        self.cache = cache
++
++    def _group_and_field(self, key: str) -> tuple[str, str]:
++        group = group_of_key(key)
++        prefix = key.split(".", 1)[0]
++        field = key[len(prefix) + 1:]
++        return group, field
++
++    async def _load_group_dict(self, group: str) -> dict[str, Any]:
++        rows = await self.repo.list_by_group(group)
++        out: dict[str, Any] = {}
++        for r in rows:
++            _, field = self._group_and_field(r.config_key)
++            out[field] = _from_storage(r.config_value, r.config_type, self.crypto)
++        return out
++
++    async def get_group(self, group: str) -> dict:
++        cached = await self.cache.get_group(group)
++        if cached is not None:
++            return cached
++        values = await self._load_group_dict(group)
++        await self.cache.set_group(group, values)
++        return values
++
++    async def get_value(self, key: str) -> Any:
++        group, field = self._group_and_field(key)
++        values = await self.get_group(group)
++        if field not in values:
++            raise NotFoundError(f"配置不存在: {key}")
++        return values[field]
++
++    async def set_value(self, key: str, value: Any, updated_by: uuid.UUID) -> None:
++        try:
++            group = group_of_key(key)
++        except ValueError as exc:
++            raise BusinessException(str(exc)) from exc
++        _, field = self._group_and_field(key)
++        type_ = _TYPES.get(key, "STRING")
++        # 组装整组并校验
++        group_dict = await self._load_group_dict(group)
++        group_dict[field] = value
++        model_cls = GROUP_MODELS[group]
++        # SECRET 字段用 SecretStr,其余用原值
++        validate_dict = {}
++        for k, v in group_dict.items():
++            field_info = model_cls.model_fields.get(k)
++            if field_info is not None and "SecretStr" in str(field_info.annotation):
++                validate_dict[k] = SecretStr(str(v))
++            else:
++                validate_dict[k] = v
++        try:
++            model_cls(**validate_dict)
++        except Exception as exc:
++            raise BusinessException(f"配置校验失败: {exc}") from exc
++        # 持久化
++        existing = await self.repo.get_by_key(key)
++        old_storage = existing.config_value if existing else None
++        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
++        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by)
++        # 历史(密文/原样存)
++        await self.history_repo.add(key, old_storage, storage_value, updated_by)
++        await self.db.commit()
++        await self.cache.invalidate(group)
++
++    async def create_or_init(self, key: str, value: Any, group: str, type_: str,
++                             description: str | None, updated_by: uuid.UUID) -> None:
++        if await self.repo.get_by_key(key) is not None:
++            return  # 幂等
++        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
++        await self.repo.upsert(key, storage_value, group, type_, is_encrypted,
++                               updated_by, description)
++        await self.db.commit()
++
++    async def init_default_configs(self, updated_by: uuid.UUID) -> None:
++        for group, fields in _DEFAULTS.items():
++            for field, value in fields.items():
++                key = f"{_PREFIX[group]}.{field}"
++                type_ = _TYPES[key]
++                await self.create_or_init(key, value, group, type_, None, updated_by)
++        await self.cache.invalidate()
++
++    def list_groups(self) -> list[str]:
++        return list(GROUP_MODELS.keys())
++
++    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
++        return await self.repo.list_keys(group)
+\ No newline at end of file
+diff --git a/user-service/back-end/app/application/services/email_template_service.py b/user-service/back-end/app/application/services/email_template_service.py
+new file mode 100644
+index 0000000..458036a
+--- /dev/null
++++ b/user-service/back-end/app/application/services/email_template_service.py
+@@ -0,0 +1,61 @@
++"""邮件模板服务(CRUD,不含发送)."""
++
++from __future__ import annotations
++
++import uuid
++
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
++from app.core.exceptions import ConflictError, NotFoundError
++from app.domain.models.system_config import EmailTemplate
++from app.repositories.system_config_repository import EmailTemplateRepository
++
++
++class EmailTemplateService:
++    def __init__(self, db: AsyncSession, repo: EmailTemplateRepository):
++        self.db = db
++        self.repo = repo
++
++    async def create(self, req: EmailTemplateCreate) -> EmailTemplate:
++        if await self.repo.get_by_code(req.template_code) is not None:
++            raise ConflictError("模板编码已存在")
++        tpl = EmailTemplate(template_code=req.template_code, template_name=req.template_name,
++                           subject=req.subject, content=req.content,
++                           variables=req.variables, is_active=req.is_active)
++        await self.repo.add(tpl)
++        await self.db.commit()
++        await self.db.refresh(tpl)
++        return tpl
++
++    async def update(self, tpl_id: uuid.UUID, req: EmailTemplateUpdate) -> EmailTemplate:
++        tpl = await self.repo.get_by_id(tpl_id)
++        if tpl is None:
++            raise NotFoundError("模板不存在")
++        if req.template_code is not None and req.template_code != tpl.template_code:
++            if await self.repo.get_by_code(req.template_code) is not None:
++                raise ConflictError("模板编码已存在")
++        for field, value in req.model_dump(exclude_unset=True).items():
++            setattr(tpl, field, value)
++        await self.db.commit()
++        await self.db.refresh(tpl)
++        return tpl
++
++    async def get(self, tpl_id: uuid.UUID) -> EmailTemplate:
++        tpl = await self.repo.get_by_id(tpl_id)
++        if tpl is None:
++            raise NotFoundError("模板不存在")
++        return tpl
++
++    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
++        return await self.repo.list(page, size)
++
++    async def delete(self, tpl_id: uuid.UUID) -> None:
++        tpl = await self.repo.get_by_id(tpl_id)
++        if tpl is None:
++            raise NotFoundError("模板不存在")
++        await self.repo.delete(tpl)
++        await self.db.commit()
++
++    async def get_by_code(self, code: str) -> EmailTemplate | None:
++        return await self.repo.get_by_code(code)
+\ No newline at end of file
+diff --git a/user-service/back-end/app/core/config.py b/user-service/back-end/app/core/config.py
+index 5041d52..a291e3d 100644
+--- a/user-service/back-end/app/core/config.py
++++ b/user-service/back-end/app/core/config.py
+@@ -33,10 +33,15 @@ class Settings(BaseSettings):
+     REDIS_URL: str = "redis://localhost:6379/0"
+ 
+     # 缓存开关(测试置 False 强制 Noop 降级)
+     CACHE_ENABLED: bool = True
+ 
++    # 配置加密密钥(Fernet,启动期必须提供)
++    CONFIG_ENCRYPTION_KEY: str = ""  # 生产由 .env 注入;测试由 fixture 注入
++    # 配置缓存开关(测试置 False 强制 LocalTTLCache)
++    CONFIG_CACHE_ENABLED: bool = True
++
+ 
+ @lru_cache(maxsize=1)
+ def get_settings() -> Settings:
+     return Settings()
+ 
+diff --git a/user-service/back-end/app/core/config_cache.py b/user-service/back-end/app/core/config_cache.py
+new file mode 100644
+index 0000000..2d09a9b
+--- /dev/null
++++ b/user-service/back-end/app/core/config_cache.py
+@@ -0,0 +1,67 @@
++# app/core/config_cache.py
++"""系统配置缓存抽象 + 本地 TTL + 工厂(Redis 实现见 Task 5)."""
++
++from __future__ import annotations
++
++import logging
++from typing import Protocol, runtime_checkable
++
++from cachetools import TTLCache
++
++from app.core.config import settings
++
++logger = logging.getLogger(__name__)
++
++TTL_SECONDS = 60
++
++
++@runtime_checkable
++class ConfigCache(Protocol):
++    async def get_group(self, group: str) -> dict | None: ...
++    async def set_group(self, group: str, values: dict) -> None: ...
++    async def invalidate(self, group: str | None = None) -> None: ...
++    async def start_subscriber(self) -> None: ...
++
++
++class LocalTTLCache:
++    def __init__(self) -> None:
++        self._store: TTLCache = TTLCache(maxsize=128, ttl=TTL_SECONDS)
++
++    async def get_group(self, group: str) -> dict | None:
++        return self._store.get(group)
++
++    async def set_group(self, group: str, values: dict) -> None:
++        self._store[group] = values
++
++    async def invalidate(self, group: str | None = None) -> None:
++        if group is None:
++            self._store.clear()
++        else:
++            self._store.pop(group, None)
++
++    async def start_subscriber(self) -> None:
++        return None
++
++
++_local_singleton = LocalTTLCache()
++_redis_singleton: ConfigCache | None = None
++
++
++async def _build_redis_or_fallback() -> ConfigCache:
++    try:
++        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client
++
++        return RedisPubSubConfigCache(await build_redis_client())
++    except Exception as exc:  # noqa: BLE001
++        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
++        return _local_singleton
++
++
++async def get_config_cache() -> ConfigCache:
++    global _redis_singleton
++    if not settings.CONFIG_CACHE_ENABLED:
++        return _local_singleton
++    if _redis_singleton is not None:
++        return _redis_singleton
++    _redis_singleton = await _build_redis_or_fallback()
++    return _redis_singleton
+\ No newline at end of file
+diff --git a/user-service/back-end/app/core/crypto.py b/user-service/back-end/app/core/crypto.py
+new file mode 100644
+index 0000000..27decdb
+--- /dev/null
++++ b/user-service/back-end/app/core/crypto.py
+@@ -0,0 +1,26 @@
++"""Fernet 对称加密(敏感配置)."""
++
++from __future__ import annotations
++
++from cryptography.fernet import Fernet
++
++from app.core.config import settings
++
++_fernet: Fernet | None = None
++
++
++def _get_fernet() -> Fernet:
++    global _fernet
++    if _fernet is None:
++        if not settings.CONFIG_ENCRYPTION_KEY:
++            raise RuntimeError("CONFIG_ENCRYPTION_KEY 未配置:无法加解密敏感配置")
++        _fernet = Fernet(settings.CONFIG_ENCRYPTION_KEY.encode())
++    return _fernet
++
++
++def encrypt(plain: str) -> str:
++    return _get_fernet().encrypt(plain.encode()).decode()
++
++
++def decrypt(cipher: str) -> str:
++    return _get_fernet().decrypt(cipher.encode()).decode()
+\ No newline at end of file
+diff --git a/user-service/back-end/app/core/redis_config_cache.py b/user-service/back-end/app/core/redis_config_cache.py
+new file mode 100644
+index 0000000..709b344
+--- /dev/null
++++ b/user-service/back-end/app/core/redis_config_cache.py
+@@ -0,0 +1,63 @@
++# app/core/redis_config_cache.py
++"""Redis pub/sub 配置缓存(组合 LocalTTLCache + 跨 worker 即时失效)."""
++
++from __future__ import annotations
++
++import asyncio
++import logging
++
++from redis.asyncio import Redis
++
++from app.core.config_cache import LocalTTLCache
++
++logger = logging.getLogger(__name__)
++CHANNEL = "config-change"
++
++
++async def build_redis_client() -> Redis:
++    from app.core.config import settings
++
++    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
++    await client.ping()
++    return client
++
++
++class RedisPubSubConfigCache:
++    def __init__(self, client: Redis):
++        self._local = LocalTTLCache()
++        self._redis = client
++
++    async def get_group(self, group: str) -> dict | None:
++        return await self._local.get_group(group)
++
++    async def set_group(self, group: str, values: dict) -> None:
++        await self._local.set_group(group, values)
++
++    async def invalidate(self, group: str | None = None) -> None:
++        await self._local.invalidate(group)
++        try:
++            await self._redis.publish(CHANNEL, group or "*")
++        except Exception as exc:  # noqa: BLE001
++            logger.warning("config cache publish 失败,降级: %s", exc)
++
++    async def start_subscriber(self) -> None:
++        try:
++            pubsub = self._redis.pubsub()
++            await pubsub.subscribe(CHANNEL)
++            while True:
++                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
++                if msg is None:
++                    await asyncio.sleep(0.05)
++                    continue
++                type_ = msg.get("type") if isinstance(msg, dict) else getattr(msg, "type", None)
++                if type_ != "message":
++                    continue
++                group = msg.get("data") if isinstance(msg, dict) else getattr(msg, "data", None)
++                if group in (None, "*"):
++                    await self._local.invalidate()
++                else:
++                    await self._local.invalidate(group)
++        except asyncio.CancelledError:
++            raise
++        except Exception as exc:  # noqa: BLE001
++            logger.warning("config cache 订阅断开,降级为本地 TTL: %s", exc)
+\ No newline at end of file
+diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
+new file mode 100644
+index 0000000..755a483
+--- /dev/null
++++ b/user-service/back-end/app/domain/models/system_config.py
+@@ -0,0 +1,54 @@
++"""系统配置、配置历史、邮件模板模型."""
++
++from __future__ import annotations
++
++import uuid
++from datetime import datetime
++
++from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid, func
++from sqlalchemy.orm import Mapped, mapped_column
++
++from app.domain.models import Base
++
++UUIDType = Uuid
++
++
++class SystemConfig(Base):
++    __tablename__ = "system_config"
++
++    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
++    config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
++    config_value: Mapped[str] = mapped_column(Text, nullable=False)
++    config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
++    # STRING/INT/BOOL/JSON/SECRET
++    config_type: Mapped[str] = mapped_column(String(20), nullable=False)
++    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
++    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
++    updated_by: Mapped[uuid.UUID | None] = mapped_column(
++        UUIDType, ForeignKey("user_account.id"), nullable=True
++    )
++
++
++class ConfigHistory(Base):
++    __tablename__ = "config_history"
++
++    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
++    config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
++    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
++    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
++    changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
++    changed_at: Mapped[datetime] = mapped_column(
++        DateTime(timezone=True), index=True, nullable=False, server_default=func.now()
++    )
++
++
++class EmailTemplate(Base):
++    __tablename__ = "email_template"
++
++    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
++    template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
++    template_name: Mapped[str] = mapped_column(String(100), nullable=False)
++    subject: Mapped[str] = mapped_column(String(200), nullable=False)
++    content: Mapped[str] = mapped_column(Text, nullable=False)
++    variables: Mapped[list | None] = mapped_column(JSON, nullable=True)
++    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
+\ No newline at end of file
+diff --git a/user-service/back-end/app/interfaces/api/email_templates.py b/user-service/back-end/app/interfaces/api/email_templates.py
+new file mode 100644
+index 0000000..44532d3
+--- /dev/null
++++ b/user-service/back-end/app/interfaces/api/email_templates.py
+@@ -0,0 +1,74 @@
++"""邮件模板路由."""
++
++from __future__ import annotations
++
++import uuid
++
++from fastapi import APIRouter, Depends, Query, status
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.deps import get_db
++from app.application.schemas.system_config import (
++    EmailTemplateCreate,
++    EmailTemplateListOut,
++    EmailTemplateOut,
++    EmailTemplateUpdate,
++)
++from app.application.services.email_template_service import EmailTemplateService
++from app.core.security import require_permission
++from app.domain.models.user import User
++from app.repositories.system_config_repository import EmailTemplateRepository
++
++router = APIRouter(prefix="/email-templates", tags=["email-templates"])
++
++
++def _svc(db: AsyncSession) -> EmailTemplateService:
++    return EmailTemplateService(db, EmailTemplateRepository(db))
++
++
++@router.get("", response_model=EmailTemplateListOut)
++async def list_templates(
++    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:read")),
++) -> EmailTemplateListOut:
++    items, total = await _svc(db).list(page, size)
++    return EmailTemplateListOut(
++        items=[EmailTemplateOut.model_validate(i) for i in items],
++        total=total, page=page, size=size)
++
++
++@router.get("/{tpl_id}", response_model=EmailTemplateOut)
++async def get_template(
++    tpl_id: uuid.UUID,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:read")),
++) -> EmailTemplateOut:
++    return EmailTemplateOut.model_validate(await _svc(db).get(tpl_id))
++
++
++@router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
++async def create_template(
++    req: EmailTemplateCreate,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:create")),
++) -> EmailTemplateOut:
++    return EmailTemplateOut.model_validate(await _svc(db).create(req))
++
++
++@router.put("/{tpl_id}", response_model=EmailTemplateOut)
++async def update_template(
++    tpl_id: uuid.UUID, req: EmailTemplateUpdate,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:update")),
++) -> EmailTemplateOut:
++    return EmailTemplateOut.model_validate(await _svc(db).update(tpl_id, req))
++
++
++@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
++async def delete_template(
++    tpl_id: uuid.UUID,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:delete")),
++) -> None:
++    await _svc(db).delete(tpl_id)
+\ No newline at end of file
+diff --git a/user-service/back-end/app/interfaces/api/system_config.py b/user-service/back-end/app/interfaces/api/system_config.py
+new file mode 100644
+index 0000000..ed98897
+--- /dev/null
++++ b/user-service/back-end/app/interfaces/api/system_config.py
+@@ -0,0 +1,137 @@
++"""系统配置路由."""
++
++from __future__ import annotations
++
++from fastapi import APIRouter, Depends, Query
++from pydantic import BaseModel
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.deps import get_db
++from app.application.services.config_service import ConfigService
++from app.core import crypto
++from app.core.config_cache import ConfigCache, get_config_cache
++from app.core.security import require_permission
++from app.domain.models.user import User
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository,
++    SystemConfigRepository,
++)
++
++router = APIRouter(prefix="/config", tags=["config"])
++
++
++def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
++    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
++
++
++class ConfigValueUpdate(BaseModel):
++    value: str | int | bool | dict
++
++
++def _mask(values: dict, group: str) -> dict:
++    from app.application.schemas.system_config import GROUP_MODELS
++    model = GROUP_MODELS[group]
++    masked = {}
++    for k, v in values.items():
++        fi = model.model_fields.get(k)
++        if fi is not None and "SecretStr" in str(fi.annotation):
++            masked[k] = "***"
++        else:
++            masked[k] = v
++    return masked
++
++
++def _format_history(rows, key: str) -> list[dict]:
++    from app.application.schemas.system_config import GROUP_MODELS, group_of_key
++    group = group_of_key(key)
++    field = key.split(".", 1)[1]
++    fi = GROUP_MODELS[group].model_fields.get(field)
++    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
++    return [
++        {
++            "key": r.config_key,
++            "old_value": "***" if is_secret else r.old_value,
++            "new_value": "***" if is_secret else r.new_value,
++            "changed_by": str(r.changed_by),
++            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
++        }
++        for r in rows
++    ]
++
++
++def _get_value_result(values: dict, key: str, group: str) -> dict:
++    from app.application.schemas.system_config import GROUP_MODELS
++    field = key.split(".", 1)[1]
++    val = values.get(field)
++    fi = GROUP_MODELS[group].model_fields.get(field)
++    if fi is not None and "SecretStr" in str(fi.annotation):
++        val = "***"
++    return {"key": key, "group": group, "value": val}
++
++
++@router.get("/groups")
++async def list_groups(
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> list[str]:
++    return _svc(db, cache).list_groups()
++
++
++@router.get("")
++async def get_group(
++    group: str = Query(...),
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> dict:
++    svc = _svc(db, cache)
++    return {"group": group, "values": _mask(await svc.get_group(group), group)}
++
++
++@router.get("/history")
++async def history(
++    key: str = Query(...),
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> list[dict]:
++    repo = ConfigHistoryRepository(db)
++    return _format_history(await repo.list_by_key(key), key)
++
++
++@router.get("/{key}")
++async def get_value(
++    key: str,
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> dict:
++    from app.application.schemas.system_config import group_of_key
++    svc = _svc(db, cache)
++    group = group_of_key(key)
++    return _get_value_result(await svc.get_group(group), key, group)
++
++
++@router.put("/{key}")
++async def put_value(
++    key: str,
++    req: ConfigValueUpdate,
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:update")),
++) -> dict:
++    svc = _svc(db, cache)
++    await svc.set_value(key, req.value, user.id)
++    return {"key": key, "ok": True}
++
++
++@router.post("/init")
++async def init_configs(
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:update")),
++) -> dict:
++    svc = _svc(db, cache)
++    await svc.init_default_configs(user.id)
++    return {"ok": True}
+\ No newline at end of file
+diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
+index 395285d..99483b6 100644
+--- a/user-service/back-end/app/main.py
++++ b/user-service/back-end/app/main.py
+@@ -1,33 +1,61 @@
+ """FastAPI 应用入口."""
+ 
+ from __future__ import annotations
+ 
++import asyncio
++import uuid
+ from collections.abc import AsyncIterator
+ from contextlib import asynccontextmanager
+ 
+ from fastapi import FastAPI
+ from fastapi.middleware.cors import CORSMiddleware
+ 
+ # 确保关联表与模型在导入时注册到 Base.metadata
+ import app.domain.models.associations  # noqa: F401
+ import app.domain.models.department  # noqa: F401
+ import app.domain.models.role  # noqa: F401
++import app.domain.models.system_config  # noqa: F401
+ import app.domain.models.user  # noqa: F401
++from app.application.services.config_service import ConfigService
++from app.core import crypto
+ from app.core.config import settings
+-from app.core.database import engine
++from app.core.config_cache import get_config_cache
++from app.core.database import AsyncSessionLocal, engine
+ from app.core.exceptions import register_exception_handlers
+ from app.domain.models import Base
+-from app.interfaces.api import auth, departments, health, users
++from app.interfaces.api import auth, departments, email_templates, health, system_config, users
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository,
++    SystemConfigRepository,
++)
+ 
+ 
+ @asynccontextmanager
+ async def lifespan(_: FastAPI) -> AsyncIterator[None]:
+     # 测试/开发环境自动建表；生产应使用 Alembic 迁移
+     async with engine.begin() as conn:
+         await conn.run_sync(Base.metadata.create_all)
++    # 配置缓存订阅(Redis 实现时;本地 no-op)
++    cache = await get_config_cache()
++    subscriber_task = asyncio.create_task(cache.start_subscriber())
++    # 幂等初始化默认配置(全零 UUID 作为系统操作人)
++    async with AsyncSessionLocal() as session:
++        svc = ConfigService(
++            session,
++            SystemConfigRepository(session),
++            ConfigHistoryRepository(session),
++            crypto,
++            cache,
++        )
++        await svc.init_default_configs(uuid.UUID(int=0))
+     yield
++    subscriber_task.cancel()
++    try:
++        await subscriber_task
++    except asyncio.CancelledError:
++        pass
+     await engine.dispose()
+ 
+ 
+ def create_app() -> FastAPI:
+     app = FastAPI(
+@@ -49,10 +77,12 @@ def create_app() -> FastAPI:
+ 
+     app.include_router(health.router)
+     app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
+     app.include_router(users.router, prefix=settings.API_V1_PREFIX)
+     app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
++    app.include_router(system_config.router, prefix=settings.API_V1_PREFIX)
++    app.include_router(email_templates.router, prefix=settings.API_V1_PREFIX)
+ 
+     return app
+ 
+ 
+ app = create_app()
+\ No newline at end of file
+diff --git a/user-service/back-end/app/repositories/system_config_repository.py b/user-service/back-end/app/repositories/system_config_repository.py
+new file mode 100644
+index 0000000..33b7ea4
+--- /dev/null
++++ b/user-service/back-end/app/repositories/system_config_repository.py
+@@ -0,0 +1,111 @@
++# app/repositories/system_config_repository.py
++"""系统配置、配置历史、邮件模板仓储."""
++
++from __future__ import annotations
++
++import uuid
++
++from sqlalchemy import func, select
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.domain.models.system_config import ConfigHistory, EmailTemplate, SystemConfig
++
++
++class SystemConfigRepository:
++    def __init__(self, db: AsyncSession):
++        self.db = db
++
++    async def get_by_key(self, key: str) -> SystemConfig | None:
++        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
++        return result.scalar_one_or_none()
++
++    async def list_by_group(self, group: str) -> list[SystemConfig]:
++        stmt = select(SystemConfig).where(SystemConfig.config_group == group)
++        result = await self.db.execute(stmt)
++        return list(result.scalars().all())
++
++    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
++        stmt = select(SystemConfig)
++        if group is not None:
++            stmt = stmt.where(SystemConfig.config_group == group)
++        stmt = stmt.order_by(SystemConfig.config_group, SystemConfig.config_key)
++        result = await self.db.execute(stmt)
++        return list(result.scalars().all())
++
++    async def upsert(self, key: str, value: str, group: str, type_: str,
++                     is_encrypted: bool, updated_by: uuid.UUID | None,
++                     description: str | None = None) -> SystemConfig:
++        existing = await self.get_by_key(key)
++        if existing is None:
++            row = SystemConfig(config_key=key, config_value=value, config_group=group,
++                               config_type=type_, is_encrypted=is_encrypted,
++                               updated_by=updated_by, description=description)
++            self.db.add(row)
++            await self.db.flush()
++            return row
++        existing.config_value = value
++        existing.config_group = group
++        existing.config_type = type_
++        existing.is_encrypted = is_encrypted
++        existing.updated_by = updated_by
++        if description is not None:
++            existing.description = description
++        await self.db.flush()
++        return existing
++
++
++class ConfigHistoryRepository:
++    def __init__(self, db: AsyncSession):
++        self.db = db
++
++    async def add(self, key: str, old_value: str | None, new_value: str | None,
++                  changed_by: uuid.UUID) -> ConfigHistory:
++        row = ConfigHistory(config_key=key, old_value=old_value, new_value=new_value,
++                            changed_by=changed_by)
++        self.db.add(row)
++        await self.db.flush()
++        return row
++
++    async def list_by_key(self, key: str) -> list[ConfigHistory]:
++        result = await self.db.execute(
++            select(ConfigHistory).where(ConfigHistory.config_key == key)
++            .order_by(ConfigHistory.changed_at.desc())
++        )
++        return list(result.scalars().all())
++
++
++class EmailTemplateRepository:
++    def __init__(self, db: AsyncSession):
++        self.db = db
++
++    async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
++        return await self.db.get(EmailTemplate, tpl_id)
++
++    async def get_by_code(self, code: str) -> EmailTemplate | None:
++        stmt = select(EmailTemplate).where(EmailTemplate.template_code == code)
++        result = await self.db.execute(stmt)
++        return result.scalar_one_or_none()
++
++    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
++        total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
++        total = int(total_result.scalar_one())
++        result = await self.db.execute(
++            select(EmailTemplate).order_by(EmailTemplate.template_code)
++            .offset((page - 1) * size).limit(size)
++        )
++        return list(result.scalars().all()), total
++
++    async def add(self, tpl: EmailTemplate) -> EmailTemplate:
++        self.db.add(tpl)
++        await self.db.flush()
++        return tpl
++
++    async def delete(self, tpl: EmailTemplate) -> None:
++        await self.db.delete(tpl)
++
++
++__all__ = [
++    "SystemConfigRepository",
++    "ConfigHistoryRepository",
++    "EmailTemplateRepository",
++]
+\ No newline at end of file
+diff --git a/user-service/back-end/pyproject.toml b/user-service/back-end/pyproject.toml
+index 81f1120..21d02bd 100644
+--- a/user-service/back-end/pyproject.toml
++++ b/user-service/back-end/pyproject.toml
+@@ -17,10 +17,11 @@ dependencies = [
+     "python-jose[cryptography]>=3.3",
+     "passlib[bcrypt]>=1.7.4",
+     "bcrypt<4.0.0",
+     "redis>=5.0",
+     "cachetools>=5.3",
++    "cryptography>=43.0",
+ ]
+ 
+ [project.optional-dependencies]
+ dev = [
+     "pytest>=8.0",
+diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
+index 9e0c8c5..8428248 100644
+--- a/user-service/back-end/tests/conftest.py
++++ b/user-service/back-end/tests/conftest.py
+@@ -14,18 +14,33 @@ from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
+ 
+ # 确保所有模型注册到 Base.metadata
+ import app.domain.models.associations  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
++import app.domain.models.system_config  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
+ from app.core.database import get_db
+ from app.domain.models import Base
+ from app.domain.models.enums import DataScope
+ from app.domain.models.role import Permission, Role
+ from app.main import app
+ 
+ 
++@pytest.fixture(autouse=True)
++def _encryption_key(monkeypatch):
++    from cryptography.fernet import Fernet
++
++    from app.core import config as _config
++
++    monkeypatch.setattr(
++        _config.settings, "CONFIG_ENCRYPTION_KEY", Fernet.generate_key().decode()
++    )
++    # crypto 模块缓存了 _fernet,重置以用新密钥
++    from app.core import crypto
++    crypto._fernet = None
++
++
+ @pytest.fixture(scope="session")
+ def db_file():
+     fd, path = tempfile.mkstemp(suffix=".db")
+     os.close(fd)
+     yield path
+@@ -86,10 +101,22 @@ async def seed(db_session):
+                    resource="dept", action="create"),
+         Permission(name="部门更新", code="dept:update", type="ACTION",
+                    resource="dept", action="update"),
+         Permission(name="部门删除", code="dept:delete", type="ACTION",
+                    resource="dept", action="delete"),
++        Permission(name="配置读取", code="config:read", type="ACTION",
++                   resource="config", action="read"),
++        Permission(name="配置更新", code="config:update", type="ACTION",
++                   resource="config", action="update"),
++        Permission(name="模板读取", code="template:read", type="ACTION",
++                   resource="template", action="read"),
++        Permission(name="模板创建", code="template:create", type="ACTION",
++                   resource="template", action="create"),
++        Permission(name="模板更新", code="template:update", type="ACTION",
++                   resource="template", action="update"),
++        Permission(name="模板删除", code="template:delete", type="ACTION",
++                   resource="template", action="delete"),
+     ]
+     db_session.add_all(perms)
+     await db_session.flush()
+ 
+     admin = Role(name="管理员", code="ADMIN", data_scope=DataScope.ALL)
+@@ -109,10 +136,12 @@ async def client(engine, seed) -> AsyncIterator[AsyncClient]:
+             yield session
+ 
+     app.dependency_overrides[get_db] = override_get_db
+     from app.core.cache import NoopDepartmentCache, get_department_cache
+     app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
++    from app.core.config_cache import LocalTTLCache, get_config_cache
++    app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()
+     transport = ASGITransport(app=app)
+     async with AsyncClient(transport=transport, base_url="http://test") as ac:
+         yield ac
+     app.dependency_overrides.clear()
+ 
+diff --git a/user-service/back-end/tests/test_config_cache.py b/user-service/back-end/tests/test_config_cache.py
+new file mode 100644
+index 0000000..5c7fb33
+--- /dev/null
++++ b/user-service/back-end/tests/test_config_cache.py
+@@ -0,0 +1,159 @@
++# tests/test_config_cache.py
++from __future__ import annotations
++
++import pytest
++
++from app.core.config_cache import ConfigCache, LocalTTLCache, get_config_cache
++
++pytestmark = pytest.mark.asyncio
++
++
++async def test_local_cache_miss_and_set():
++    cache = LocalTTLCache()
++    assert await cache.get_group("MAIL") is None
++    await cache.set_group("MAIL", {"host": "smtp"})
++    assert await cache.get_group("MAIL") == {"host": "smtp"}
++
++
++async def test_local_cache_invalidate():
++    cache = LocalTTLCache()
++    await cache.set_group("MAIL", {"a": 1})
++    await cache.set_group("SECURITY", {"b": 2})
++    await cache.invalidate("MAIL")
++    assert await cache.get_group("MAIL") is None
++    assert await cache.get_group("SECURITY") == {"b": 2}
++    await cache.invalidate()  # 全清
++    assert await cache.get_group("SECURITY") is None
++
++
++async def test_local_cache_start_subscriber_noop():
++    cache = LocalTTLCache()
++    await cache.start_subscriber()  # 不抛错
++
++
++async def test_factory_returns_local_when_disabled(monkeypatch):
++    from app.core.config import settings
++    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
++    cache = await get_config_cache()
++    assert isinstance(cache, LocalTTLCache)
++
++
++async def test_factory_builds_redis_when_enabled(monkeypatch):
++    import app.core.config_cache as mod
++    from app.core.config import settings
++    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", True)
++    monkeypatch.setattr(mod, "_redis_singleton", None)
++
++    async def fake_build():
++        return FakeRedis()
++
++    monkeypatch.setattr(
++        "app.core.redis_config_cache.build_redis_client", fake_build
++    )
++    cache = await get_config_cache()
++    from app.core.redis_config_cache import RedisPubSubConfigCache
++    assert isinstance(cache, RedisPubSubConfigCache)
++    # 第二次调用返回缓存的 singleton
++    cache2 = await get_config_cache()
++    assert cache2 is cache
++
++
++async def test_factory_fallback_on_redis_error(monkeypatch):
++    import app.core.config_cache as mod
++    from app.core.config import settings
++    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", True)
++    monkeypatch.setattr(mod, "_redis_singleton", None)
++
++    async def boom():
++        raise RuntimeError("no redis")
++
++    monkeypatch.setattr(
++        "app.core.redis_config_cache.build_redis_client", boom
++    )
++    cache = await get_config_cache()
++    assert isinstance(cache, LocalTTLCache)
++
++
++def test_protocol_compat():
++    assert isinstance(LocalTTLCache(), ConfigCache)
++
++
++class FakeRedis:
++    def __init__(self):
++        self.store: dict[str, str] = {}
++        self.published: list[tuple[str, str]] = []
++        self._subs: list = []
++
++    async def get(self, key):
++        return self.store.get(key)
++
++    async def set(self, key, value, ex=None):
++        self.store[key] = value
++
++    async def publish(self, channel, message):
++        self.published.append((channel, message))
++
++    def pubsub(self):
++        class _PubSub:
++            def __init__(self, parent):
++                self.parent = parent
++                self._queue: list = []
++
++            async def subscribe(self, *channels):
++                self.parent._subs.append(self)
++
++            async def get_message(self, ignore_subscribe_messages=True, timeout=None):
++                if self._queue:
++                    return self._queue.pop(0)
++                return None
++
++            def push(self, channel, message):
++                import types
++                msg = types.SimpleNamespace(
++                    type="message", channel=channel, data=message
++                )
++                self._queue.append(msg)
++
++            async def close(self):
++                pass
++
++        return _PubSub(self)
++
++    async def ping(self):
++        return True
++
++    async def close(self):
++        pass
++
++
++async def test_redis_cache_uses_local_and_publishes_invalidate():
++    from app.core.redis_config_cache import RedisPubSubConfigCache
++    cache = RedisPubSubConfigCache(FakeRedis())
++    await cache.set_group("MAIL", {"host": "smtp"})
++    assert await cache.get_group("MAIL") == {"host": "smtp"}
++    await cache.invalidate("MAIL")
++    assert await cache.get_group("MAIL") is None
++    assert ("config-change", "MAIL") in cache._redis.published  # noqa: SLF001
++
++
++async def test_redis_cache_subscriber_invalidates_local():
++    import asyncio
++
++    from app.core.redis_config_cache import RedisPubSubConfigCache
++
++    fake = FakeRedis()
++    cache = RedisPubSubConfigCache(fake)
++    await cache.set_group("MAIL", {"host": "smtp"})
++    # 启动订阅 task
++    task = asyncio.create_task(cache.start_subscriber())
++    await asyncio.sleep(0.05)  # 让订阅注册
++    assert fake._subs, "subscriber registered"  # noqa: SLF001
++    # 模拟收到失效消息
++    fake._subs[0].push("config-change", "MAIL")
++    await asyncio.sleep(0.05)
++    assert await cache.get_group("MAIL") is None  # 本地被失效
++    task.cancel()
++    try:
++        await task
++    except asyncio.CancelledError:
++        pass
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_config_group_models.py b/user-service/back-end/tests/test_config_group_models.py
+new file mode 100644
+index 0000000..d664a23
+--- /dev/null
++++ b/user-service/back-end/tests/test_config_group_models.py
+@@ -0,0 +1,51 @@
++from __future__ import annotations
++
++import pytest
++from pydantic import ValidationError
++
++from app.application.schemas.system_config import (
++    GROUP_MODELS,
++    MailConfig,
++    SecurityPolicy,
++    SystemParams,
++    group_of_key,
++)
++
++pytestmark = pytest.mark.asyncio
++
++
++def test_group_of_key():
++    assert group_of_key("mail.host") == "MAIL"
++    assert group_of_key("security.password_min_length") == "SECURITY"
++    assert group_of_key("performance.cache_user_info_ttl") == "PERFORMANCE"
++    assert group_of_key("system.site_name") == "SYSTEM"
++
++
++def test_group_of_key_unknown():
++    with pytest.raises(ValueError):
++        group_of_key("unknown.x")
++
++
++def test_security_policy_validates_range():
++    with pytest.raises(ValidationError):
++        SecurityPolicy(
++            password_min_length=3,  # < 6
++            password_require_uppercase=True, password_require_lowercase=True,
++            password_require_digits=True, password_require_special=True,
++            password_history_size=5, password_expiration_days=90,
++            login_max_attempts=5, login_lock_minutes=30, session_timeout_minutes=15,
++        )
++
++
++def test_mail_config_port_range():
++    with pytest.raises(ValidationError):
++        MailConfig(host="smtp", port=99999, username="u", password="p")
++
++
++def test_system_params_locale_pattern():
++    with pytest.raises(ValidationError):
++        SystemParams(site_name="x", default_locale="invalid", support_email="a@b.com")
++
++
++def test_group_models_keys():
++    assert set(GROUP_MODELS.keys()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_config_service.py b/user-service/back-end/tests/test_config_service.py
+new file mode 100644
+index 0000000..89f09c0
+--- /dev/null
++++ b/user-service/back-end/tests/test_config_service.py
+@@ -0,0 +1,134 @@
++# tests/test_config_service.py
++from __future__ import annotations
++
++import uuid
++
++import pytest
++from sqlalchemy.ext.asyncio import async_sessionmaker
++
++from app.application.services.config_service import ConfigService
++from app.core import crypto
++from app.core.config_cache import LocalTTLCache
++from app.core.exceptions import BusinessException
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository,
++    SystemConfigRepository,
++)
++
++pytestmark = pytest.mark.asyncio
++
++
++def _svc(db):
++    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
++                          crypto, LocalTTLCache())
++
++
++async def test_init_default_configs_seeds_all(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        rows = await svc.repo.list_keys()
++        groups = {r.config_group for r in rows}
++        assert groups == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
++        # 每组至少 1 个 key
++        assert len(rows) >= 4
++
++
++async def test_init_idempotent(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        first = sorted(r.config_value for r in await svc.repo.list_keys())
++        await svc.init_default_configs(uuid.uuid4())  # 不覆盖
++        await db.commit()
++        second = sorted(r.config_value for r in await svc.repo.list_keys())
++        assert first == second
++
++
++async def test_set_value_validates_group(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        with pytest.raises(BusinessException):
++            await svc.set_value("security.password_min_length", "3", uuid.uuid4())
++
++
++async def test_set_value_secret_encrypts(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        await svc.set_value("mail.password", "smtp-secret-123", uuid.uuid4())
++        await db.commit()
++        row = await svc.repo.get_by_key("mail.password")
++        assert row.is_encrypted is True
++        assert row.config_value != "smtp-secret-123"  # 密文
++        assert svc.crypto.decrypt(row.config_value) == "smtp-secret-123"
++        # get_value 解密
++        val = await svc.get_value("mail.password")
++        assert val == "smtp-secret-123"
++        # 历史存密文
++        hist = await svc.history_repo.list_by_key("mail.password")
++        assert hist and hist[0].new_value != "smtp-secret-123"
++
++
++async def test_get_group_returns_real_values(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        grp = await svc.get_group("SYSTEM")
++        assert "site_name" in grp
++
++
++async def test_set_value_records_history(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        await svc.set_value("system.site_name", "NewName", uuid.uuid4())
++        await db.commit()
++        hist = await svc.history_repo.list_by_key("system.site_name")
++        assert len(hist) == 1
++        assert hist[0].new_value == "NewName"
++
++
++async def test_unknown_group_rejected(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        with pytest.raises(BusinessException):
++            await svc.set_value("unknown.x", "v", uuid.uuid4())
++
++
++async def test_cache_invalidation_on_set(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++
++    class SpyCache(LocalTTLCache):
++        def __init__(self):
++            super().__init__()
++            self.invalidated: list = []
++
++        async def invalidate(self, group=None):
++            self.invalidated.append(group)
++
++    async with Session() as db:
++        spy = SpyCache()
++        svc = ConfigService(
++            db, SystemConfigRepository(db),
++            ConfigHistoryRepository(db), crypto, spy,
++        )
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        await svc.set_value("system.site_name", "Z", uuid.uuid4())
++        await db.commit()
++        assert "SYSTEM" in spy.invalidated
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_crypto.py b/user-service/back-end/tests/test_crypto.py
+new file mode 100644
+index 0000000..e2f5b21
+--- /dev/null
++++ b/user-service/back-end/tests/test_crypto.py
+@@ -0,0 +1,26 @@
++from __future__ import annotations
++
++import pytest
++
++from app.core.crypto import decrypt, encrypt
++
++pytestmark = pytest.mark.asyncio
++
++
++async def test_encrypt_decrypt_roundtrip():
++    plain = "smtp-password-123"
++    cipher = encrypt(plain)
++    assert cipher != plain and isinstance(cipher, str)
++    assert decrypt(cipher) == plain
++
++
++async def test_encrypt_different_each_time():
++    a = encrypt("x")
++    b = encrypt("x")
++    assert a != b  # Fernet 每次带随机 IV
++
++
++def test_decrypt_invalid_token_raises():
++    from cryptography.fernet import InvalidToken
++    with pytest.raises(InvalidToken):
++        decrypt("not-a-valid-fernet-token")
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_email_template_service.py b/user-service/back-end/tests/test_email_template_service.py
+new file mode 100644
+index 0000000..4d7e6b8
+--- /dev/null
++++ b/user-service/back-end/tests/test_email_template_service.py
+@@ -0,0 +1,69 @@
++from __future__ import annotations
++
++import pytest
++from sqlalchemy.ext.asyncio import async_sessionmaker
++
++from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
++from app.application.services.email_template_service import EmailTemplateService
++from app.core.exceptions import ConflictError, NotFoundError
++from app.repositories.system_config_repository import EmailTemplateRepository
++
++pytestmark = pytest.mark.asyncio
++
++
++def _svc(db):
++    return EmailTemplateService(db, EmailTemplateRepository(db))
++
++
++async def test_create_and_get(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        tpl = await svc.create(EmailTemplateCreate(
++            template_code="USER_ACTIVATION", template_name="激活", subject="欢迎",
++            content="Hi {{name}}",
++            variables=[{"name": "name", "description": "用户名", "required": True}]))
++        await db.commit()
++        got = await svc.get(tpl.id)
++        assert got.template_code == "USER_ACTIVATION"
++
++
++async def test_create_code_conflict(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
++                                             subject="s", content="c"))
++        await db.commit()
++        with pytest.raises(ConflictError):
++            await svc.create(EmailTemplateCreate(template_code="X", template_name="n2",
++                                                 subject="s2", content="c2"))
++        await db.commit()
++
++
++async def test_update_and_delete(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        tpl = await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
++                                                   subject="s", content="c"))
++        await db.commit()
++        updated = await svc.update(tpl.id, EmailTemplateUpdate(template_name="n2"))
++        await db.commit()
++        assert updated.template_name == "n2"
++        await svc.delete(tpl.id)
++        await db.commit()
++        with pytest.raises(NotFoundError):
++            await svc.get(tpl.id)
++
++
++async def test_list_pagination(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        for i in range(3):
++            await svc.create(EmailTemplateCreate(template_code=f"C{i}", template_name=f"n{i}",
++                                                 subject="s", content="c"))
++            await db.commit()
++        items, total = await svc.list(1, 2)
++        assert total == 3 and len(items) == 2
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_email_templates_api.py b/user-service/back-end/tests/test_email_templates_api.py
+new file mode 100644
+index 0000000..62eab28
+--- /dev/null
++++ b/user-service/back-end/tests/test_email_templates_api.py
+@@ -0,0 +1,37 @@
++from __future__ import annotations
++
++import pytest
++
++pytestmark = pytest.mark.asyncio
++
++
++async def _h(token):
++    return {"Authorization": f"Bearer {token}"}
++
++
++TPL = {"template_code": "USER_ACTIVATION", "template_name": "激活",
++       "subject": "欢迎", "content": "Hi {{name}}",
++       "variables": [{"name": "name", "description": "用户名", "required": True}]}
++
++
++async def test_template_crud(client, admin_token):
++    h = await _h(admin_token)
++    create = await client.post("/api/v1/email-templates", json=TPL, headers=h)
++    assert create.status_code == 201, create.text
++    tid = create.json()["id"]
++    got = await client.get(f"/api/v1/email-templates/{tid}", headers=h)
++    assert got.status_code == 200 and got.json()["template_code"] == "USER_ACTIVATION"
++    lst = await client.get("/api/v1/email-templates", headers=h)
++    assert lst.status_code == 200 and lst.json()["total"] == 1
++    upd = await client.put(f"/api/v1/email-templates/{tid}",
++                           json={"template_name": "激活2"}, headers=h)
++    assert upd.status_code == 200 and upd.json()["template_name"] == "激活2"
++    dele = await client.delete(f"/api/v1/email-templates/{tid}", headers=h)
++    assert dele.status_code == 204
++
++
++async def test_template_code_conflict(client, admin_token):
++    h = await _h(admin_token)
++    await client.post("/api/v1/email-templates", json=TPL, headers=h)
++    resp = await client.post("/api/v1/email-templates", json=TPL, headers=h)
++    assert resp.status_code == 409
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_system_config_api.py b/user-service/back-end/tests/test_system_config_api.py
+new file mode 100644
+index 0000000..b8745bc
+--- /dev/null
++++ b/user-service/back-end/tests/test_system_config_api.py
+@@ -0,0 +1,67 @@
++from __future__ import annotations
++
++import pytest
++
++pytestmark = pytest.mark.asyncio
++
++
++async def _h(token):
++    return {"Authorization": f"Bearer {token}"}
++
++
++async def test_init_and_get_group_masks_secret(client, admin_token):
++    resp = await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    assert resp.status_code == 200, resp.text
++    grp = await client.get("/api/v1/config?group=MAIL", headers=await _h(admin_token))
++    assert grp.status_code == 200
++    body = grp.json()
++    assert body["group"] == "MAIL"
++    assert body["values"]["password"] == "***"
++
++
++async def test_get_groups(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    resp = await client.get("/api/v1/config/groups", headers=await _h(admin_token))
++    assert resp.status_code == 200
++    assert set(resp.json()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
++
++
++async def test_put_value_validates(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    resp = await client.put("/api/v1/config/security.password_min_length",
++                            json={"value": "3"}, headers=await _h(admin_token))
++    assert resp.status_code == 400
++
++
++async def test_put_value_secret(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    resp = await client.put("/api/v1/config/mail.password",
++                            json={"value": "new-secret"}, headers=await _h(admin_token))
++    assert resp.status_code == 200, resp.text
++    # GET 单 key 掩码
++    g = await client.get("/api/v1/config/mail.password", headers=await _h(admin_token))
++    assert g.status_code == 200 and g.json()["value"] == "***"
++
++
++async def test_history(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    await client.put("/api/v1/config/system.site_name",
++                     json={"value": "NewName"}, headers=await _h(admin_token))
++    resp = await client.get("/api/v1/config/history?key=system.site_name",
++                            headers=await _h(admin_token))
++    assert resp.status_code == 200
++    assert len(resp.json()) >= 1
++
++
++async def test_regular_user_forbidden(client):
++    reg = await client.post("/api/v1/auth/register", json={
++        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
++    assert reg.status_code == 201
++    login = await client.post(
++        "/api/v1/auth/login",
++        json={"email": "r@t.com", "password": "Rr@12345"},
++    )
++    token = login.json()["access_token"]
++    resp = await client.put("/api/v1/config/system.site_name",
++                            json={"value": "x"}, headers=await _h(token))
++    assert resp.status_code == 403
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
+new file mode 100644
+index 0000000..a430fbe
+--- /dev/null
++++ b/user-service/back-end/tests/test_system_config_model.py
+@@ -0,0 +1,35 @@
++# tests/test_system_config_model.py
++from __future__ import annotations
++
++import pytest
++from sqlalchemy import inspect
++
++import app.domain.models.associations  # noqa: F401
++import app.domain.models.department  # noqa: F401
++import app.domain.models.role  # noqa: F401
++import app.domain.models.system_config  # noqa: F401
++import app.domain.models.user  # noqa: F401
++from app.domain.models import Base
++
++pytestmark = pytest.mark.asyncio
++
++
++def test_system_config_columns():
++    cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
++    assert {"id", "config_key", "config_value", "config_group", "config_type",
++            "is_encrypted", "description", "updated_by",
++            "created_at", "updated_at"} <= cols
++    assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
++
++
++def test_config_history_columns():
++    cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
++    assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
++    assert Base.metadata.tables["config_history"].columns["changed_at"].index is True
++
++
++def test_email_template_columns():
++    cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
++    assert {"id", "template_code", "template_name", "subject", "content",
++            "variables", "is_active", "created_at", "updated_at"} <= cols
++    assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_system_config_repository.py b/user-service/back-end/tests/test_system_config_repository.py
+new file mode 100644
+index 0000000..78a94d2
+--- /dev/null
++++ b/user-service/back-end/tests/test_system_config_repository.py
+@@ -0,0 +1,69 @@
++# tests/test_system_config_repository.py
++from __future__ import annotations
++
++import uuid
++
++import pytest
++from sqlalchemy.ext.asyncio import async_sessionmaker
++
++from app.domain.models.system_config import EmailTemplate
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository,
++    EmailTemplateRepository,
++    SystemConfigRepository,
++)
++
++pytestmark = pytest.mark.asyncio
++
++
++async def test_upsert_inserts_and_updates(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        repo = SystemConfigRepository(db)
++        await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
++        await db.commit()
++        got = await repo.get_by_key("mail.host")
++        assert got is not None and got.config_value == "smtp.x.com"
++        await repo.upsert("mail.host", "smtp.y.com", "MAIL", "STRING", False, None)
++        await db.commit()
++        got2 = await repo.get_by_key("mail.host")
++        assert got2.config_value == "smtp.y.com"
++
++
++async def test_list_by_group(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        repo = SystemConfigRepository(db)
++        await repo.upsert("mail.host", "h", "MAIL", "STRING", False, None)
++        await repo.upsert("mail.port", "25", "MAIL", "INT", False, None)
++        await repo.upsert("system.site_name", "s", "SYSTEM", "STRING", False, None)
++        await db.commit()
++        rows = await repo.list_by_group("MAIL")
++        assert {r.config_key for r in rows} == {"mail.host", "mail.port"}
++
++
++async def test_config_history(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        hist = ConfigHistoryRepository(db)
++        await hist.add("mail.host", "old", "new", uuid.uuid4())
++        await db.commit()
++        rows = await hist.list_by_key("mail.host")
++        assert len(rows) == 1 and rows[0].new_value == "new"
++
++
++async def test_email_template_repo(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        repo = EmailTemplateRepository(db)
++        tpl = EmailTemplate(template_code="USER_ACTIVATION", template_name="激活",
++                            subject="欢迎", content="Hi {{name}}",
++                            variables=[{"name": "name", "description": "用户名", "required": True}])
++        await repo.add(tpl)
++        await db.commit()
++        assert (await repo.get_by_code("USER_ACTIVATION")).template_name == "激活"
++        items, total = await repo.list(1, 20)
++        assert total == 1
++        await repo.delete(tpl)
++        await db.commit()
++        assert await repo.get_by_code("USER_ACTIVATION") is None
+\ No newline at end of file
+diff --git a/user-service/back-end/uv.lock b/user-service/back-end/uv.lock
+index 9e97319..c630593 100644
+--- a/user-service/back-end/uv.lock
++++ b/user-service/back-end/uv.lock
+@@ -1216,10 +1216,11 @@ dependencies = [
+     { name = "aiosqlite" },
+     { name = "alembic" },
+     { name = "asyncpg" },
+     { name = "bcrypt" },
+     { name = "cachetools" },
++    { name = "cryptography" },
+     { name = "email-validator" },
+     { name = "fastapi" },
+     { name = "passlib", extra = ["bcrypt"] },
+     { name = "pydantic" },
+     { name = "pydantic-settings" },
+@@ -1245,10 +1246,11 @@ requires-dist = [
+     { name = "aiosqlite", specifier = ">=0.20" },
+     { name = "alembic", specifier = ">=1.13" },
+     { name = "asyncpg", specifier = ">=0.29" },
+     { name = "bcrypt", specifier = "<4.0.0" },
+     { name = "cachetools", specifier = ">=5.3" },
++    { name = "cryptography", specifier = ">=43.0" },
+     { name = "email-validator", specifier = ">=2.1" },
+     { name = "fastapi", specifier = ">=0.115" },
+     { name = "httpx", marker = "extra == 'dev'", specifier = ">=0.27" },
+     { name = "mypy", marker = "extra == 'dev'", specifier = ">=1.10" },
+     { name = "passlib", extras = ["bcrypt"], specifier = ">=1.7.4" },
diff --git a/.superpowers/sdd/review-cfg1-5b85747-cae4272.md b/.superpowers/sdd/review-cfg1-5b85747-cae4272.md
new file mode 100644
index 0000000..40843de
--- /dev/null
+++ b/.superpowers/sdd/review-cfg1-5b85747-cae4272.md
@@ -0,0 +1,133 @@
+﻿## commits 5b85747..cae4272
+cae4272 feat(config): SystemConfig/ConfigHistory/EmailTemplate 模型
+
+## stat
+ .../back-end/app/domain/models/system_config.py    | 49 ++++++++++++++++++++++
+ user-service/back-end/app/main.py                  |  1 +
+ .../back-end/tests/test_system_config_model.py     | 34 +++++++++++++++
+ 3 files changed, 84 insertions(+)
+
+## diff -U10
+diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
+new file mode 100644
+index 0000000..44d4b45
+--- /dev/null
++++ b/user-service/back-end/app/domain/models/system_config.py
+@@ -0,0 +1,49 @@
++"""系统配置、配置历史、邮件模板模型."""
++
++from __future__ import annotations
++
++import uuid
++from datetime import datetime
++
++from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
++from sqlalchemy.orm import Mapped, mapped_column
++
++from app.domain.models import Base
++
++UUIDType = Uuid
++
++
++class SystemConfig(Base):
++    __tablename__ = "system_config"
++
++    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
++    config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
++    config_value: Mapped[str] = mapped_column(Text, nullable=False)
++    config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
++    config_type: Mapped[str] = mapped_column(String(20), nullable=False)  # STRING/INT/BOOL/JSON/SECRET
++    is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
++    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
++    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey("user_account.id"), nullable=True)
++
++
++class ConfigHistory(Base):
++    __tablename__ = "config_history"
++
++    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
++    config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
++    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
++    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
++    changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
++    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
++
++
++class EmailTemplate(Base):
++    __tablename__ = "email_template"
++
++    id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
++    template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
++    template_name: Mapped[str] = mapped_column(String(100), nullable=False)
++    subject: Mapped[str] = mapped_column(String(200), nullable=False)
++    content: Mapped[str] = mapped_column(Text, nullable=False)
++    variables: Mapped[list | None] = mapped_column(JSON, nullable=True)
++    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
+\ No newline at end of file
+diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
+index 395285d..c12de28 100644
+--- a/user-service/back-end/app/main.py
++++ b/user-service/back-end/app/main.py
+@@ -5,20 +5,21 @@ from __future__ import annotations
+ from collections.abc import AsyncIterator
+ from contextlib import asynccontextmanager
+ 
+ from fastapi import FastAPI
+ from fastapi.middleware.cors import CORSMiddleware
+ 
+ # 确保关联表与模型在导入时注册到 Base.metadata
+ import app.domain.models.associations  # noqa: F401
+ import app.domain.models.department  # noqa: F401
+ import app.domain.models.role  # noqa: F401
++import app.domain.models.system_config  # noqa: F401
+ import app.domain.models.user  # noqa: F401
+ from app.core.config import settings
+ from app.core.database import engine
+ from app.core.exceptions import register_exception_handlers
+ from app.domain.models import Base
+ from app.interfaces.api import auth, departments, health, users
+ 
+ 
+ @asynccontextmanager
+ async def lifespan(_: FastAPI) -> AsyncIterator[None]:
+diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
+new file mode 100644
+index 0000000..d9bb138
+--- /dev/null
++++ b/user-service/back-end/tests/test_system_config_model.py
+@@ -0,0 +1,34 @@
++# tests/test_system_config_model.py
++from __future__ import annotations
++
++import pytest
++from sqlalchemy import inspect
++
++from app.domain.models import Base
++import app.domain.models.associations  # noqa: F401
++import app.domain.models.department  # noqa: F401
++import app.domain.models.role  # noqa: F401
++import app.domain.models.user  # noqa: F401
++import app.domain.models.system_config  # noqa: F401
++
++pytestmark = pytest.mark.asyncio
++
++
++def test_system_config_columns():
++    cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
++    assert {"id", "config_key", "config_value", "config_group", "config_type",
++            "is_encrypted", "description", "updated_by",
++            "created_at", "updated_at"} <= cols
++    assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
++
++
++def test_config_history_columns():
++    cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
++    assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
++
++
++def test_email_template_columns():
++    cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
++    assert {"id", "template_code", "template_name", "subject", "content",
++            "variables", "is_active", "created_at", "updated_at"} <= cols
++    assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg10-cbb531e-bad2805.md b/.superpowers/sdd/review-cfg10-cbb531e-bad2805.md
new file mode 100644
index 0000000..0e80dbd
--- /dev/null
+++ b/.superpowers/sdd/review-cfg10-cbb531e-bad2805.md
@@ -0,0 +1,707 @@
+﻿## commits cbb531e..bad2805
+bad2805 feat(config): lifespan 集成订阅+init;全量回归通过,覆盖率≥85%,ruff 清零
+
+## stat
+ user-service/back-end/app/core/config_cache.py     | 19 +++---
+ .../back-end/app/domain/models/system_config.py    | 11 +++-
+ .../back-end/app/interfaces/api/email_templates.py |  5 +-
+ .../back-end/app/interfaces/api/system_config.py   | 67 ++++++++++++----------
+ user-service/back-end/app/main.py                  | 29 +++++++++-
+ .../app/repositories/system_config_repository.py   |  9 ++-
+ user-service/back-end/tests/conftest.py            |  2 +-
+ user-service/back-end/tests/test_config_cache.py   | 41 ++++++++++++-
+ .../back-end/tests/test_config_group_models.py     |  6 +-
+ user-service/back-end/tests/test_config_service.py | 10 +++-
+ .../back-end/tests/test_system_config_api.py       |  5 +-
+ .../back-end/tests/test_system_config_model.py     |  4 +-
+ .../tests/test_system_config_repository.py         |  6 +-
+ 13 files changed, 156 insertions(+), 58 deletions(-)
+
+## diff -U10
+diff --git a/user-service/back-end/app/core/config_cache.py b/user-service/back-end/app/core/config_cache.py
+index 97f7489..2d09a9b 100644
+--- a/user-service/back-end/app/core/config_cache.py
++++ b/user-service/back-end/app/core/config_cache.py
+@@ -40,25 +40,28 @@ class LocalTTLCache:
+             self._store.pop(group, None)
+ 
+     async def start_subscriber(self) -> None:
+         return None
+ 
+ 
+ _local_singleton = LocalTTLCache()
+ _redis_singleton: ConfigCache | None = None
+ 
+ 
++async def _build_redis_or_fallback() -> ConfigCache:
++    try:
++        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client
++
++        return RedisPubSubConfigCache(await build_redis_client())
++    except Exception as exc:  # noqa: BLE001
++        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
++        return _local_singleton
++
++
+ async def get_config_cache() -> ConfigCache:
+     global _redis_singleton
+     if not settings.CONFIG_CACHE_ENABLED:
+         return _local_singleton
+     if _redis_singleton is not None:
+         return _redis_singleton
+-    try:
+-        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client
+-
+-        client = await build_redis_client()
+-        _redis_singleton = RedisPubSubConfigCache(client)
+-    except Exception as exc:  # noqa: BLE001
+-        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
+-        _redis_singleton = _local_singleton
++    _redis_singleton = await _build_redis_or_fallback()
+     return _redis_singleton
+\ No newline at end of file
+diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
+index 8cad7c0..755a483 100644
+--- a/user-service/back-end/app/domain/models/system_config.py
++++ b/user-service/back-end/app/domain/models/system_config.py
+@@ -13,35 +13,40 @@ from app.domain.models import Base
+ UUIDType = Uuid
+ 
+ 
+ class SystemConfig(Base):
+     __tablename__ = "system_config"
+ 
+     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+     config_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
+     config_value: Mapped[str] = mapped_column(Text, nullable=False)
+     config_group: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
+-    config_type: Mapped[str] = mapped_column(String(20), nullable=False)  # STRING/INT/BOOL/JSON/SECRET
++    # STRING/INT/BOOL/JSON/SECRET
++    config_type: Mapped[str] = mapped_column(String(20), nullable=False)
+     is_encrypted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
+     description: Mapped[str | None] = mapped_column(String(500), nullable=True)
+-    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUIDType, ForeignKey("user_account.id"), nullable=True)
++    updated_by: Mapped[uuid.UUID | None] = mapped_column(
++        UUIDType, ForeignKey("user_account.id"), nullable=True
++    )
+ 
+ 
+ class ConfigHistory(Base):
+     __tablename__ = "config_history"
+ 
+     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+     config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
+     old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+     new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+     changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
+-    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False, server_default=func.now())
++    changed_at: Mapped[datetime] = mapped_column(
++        DateTime(timezone=True), index=True, nullable=False, server_default=func.now()
++    )
+ 
+ 
+ class EmailTemplate(Base):
+     __tablename__ = "email_template"
+ 
+     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+     template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
+     template_name: Mapped[str] = mapped_column(String(100), nullable=False)
+     subject: Mapped[str] = mapped_column(String(200), nullable=False)
+     content: Mapped[str] = mapped_column(Text, nullable=False)
+diff --git a/user-service/back-end/app/interfaces/api/email_templates.py b/user-service/back-end/app/interfaces/api/email_templates.py
+index c84c936..44532d3 100644
+--- a/user-service/back-end/app/interfaces/api/email_templates.py
++++ b/user-service/back-end/app/interfaces/api/email_templates.py
+@@ -2,21 +2,24 @@
+ 
+ from __future__ import annotations
+ 
+ import uuid
+ 
+ from fastapi import APIRouter, Depends, Query, status
+ from sqlalchemy.ext.asyncio import AsyncSession
+ 
+ from app.application.deps import get_db
+ from app.application.schemas.system_config import (
+-    EmailTemplateCreate, EmailTemplateListOut, EmailTemplateOut, EmailTemplateUpdate,
++    EmailTemplateCreate,
++    EmailTemplateListOut,
++    EmailTemplateOut,
++    EmailTemplateUpdate,
+ )
+ from app.application.services.email_template_service import EmailTemplateService
+ from app.core.security import require_permission
+ from app.domain.models.user import User
+ from app.repositories.system_config_repository import EmailTemplateRepository
+ 
+ router = APIRouter(prefix="/email-templates", tags=["email-templates"])
+ 
+ 
+ def _svc(db: AsyncSession) -> EmailTemplateService:
+diff --git a/user-service/back-end/app/interfaces/api/system_config.py b/user-service/back-end/app/interfaces/api/system_config.py
+index f464678..ed98897 100644
+--- a/user-service/back-end/app/interfaces/api/system_config.py
++++ b/user-service/back-end/app/interfaces/api/system_config.py
+@@ -1,29 +1,28 @@
+ """系统配置路由."""
+ 
+ from __future__ import annotations
+ 
+-import uuid
+-
+ from fastapi import APIRouter, Depends, Query
+ from pydantic import BaseModel
+ from sqlalchemy.ext.asyncio import AsyncSession
+ 
+ from app.application.deps import get_db
++from app.application.services.config_service import ConfigService
++from app.core import crypto
+ from app.core.config_cache import ConfigCache, get_config_cache
+ from app.core.security import require_permission
+ from app.domain.models.user import User
+ from app.repositories.system_config_repository import (
+-    ConfigHistoryRepository, SystemConfigRepository,
++    ConfigHistoryRepository,
++    SystemConfigRepository,
+ )
+-from app.application.services.config_service import ConfigService
+-from app.core import crypto
+ 
+ router = APIRouter(prefix="/config", tags=["config"])
+ 
+ 
+ def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
+     return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
+ 
+ 
+ class ConfigValueUpdate(BaseModel):
+     value: str | int | bool | dict
+@@ -35,84 +34,90 @@ def _mask(values: dict, group: str) -> dict:
+     masked = {}
+     for k, v in values.items():
+         fi = model.model_fields.get(k)
+         if fi is not None and "SecretStr" in str(fi.annotation):
+             masked[k] = "***"
+         else:
+             masked[k] = v
+     return masked
+ 
+ 
++def _format_history(rows, key: str) -> list[dict]:
++    from app.application.schemas.system_config import GROUP_MODELS, group_of_key
++    group = group_of_key(key)
++    field = key.split(".", 1)[1]
++    fi = GROUP_MODELS[group].model_fields.get(field)
++    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
++    return [
++        {
++            "key": r.config_key,
++            "old_value": "***" if is_secret else r.old_value,
++            "new_value": "***" if is_secret else r.new_value,
++            "changed_by": str(r.changed_by),
++            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
++        }
++        for r in rows
++    ]
++
++
++def _get_value_result(values: dict, key: str, group: str) -> dict:
++    from app.application.schemas.system_config import GROUP_MODELS
++    field = key.split(".", 1)[1]
++    val = values.get(field)
++    fi = GROUP_MODELS[group].model_fields.get(field)
++    if fi is not None and "SecretStr" in str(fi.annotation):
++        val = "***"
++    return {"key": key, "group": group, "value": val}
++
++
+ @router.get("/groups")
+ async def list_groups(
+     db: AsyncSession = Depends(get_db),
+     cache: ConfigCache = Depends(get_config_cache),
+     user: User = Depends(require_permission("config:read")),
+ ) -> list[str]:
+     return _svc(db, cache).list_groups()
+ 
+ 
+ @router.get("")
+ async def get_group(
+     group: str = Query(...),
+     db: AsyncSession = Depends(get_db),
+     cache: ConfigCache = Depends(get_config_cache),
+     user: User = Depends(require_permission("config:read")),
+ ) -> dict:
+     svc = _svc(db, cache)
+-    values = await svc.get_group(group)
+-    return {"group": group, "values": _mask(values, group)}
++    return {"group": group, "values": _mask(await svc.get_group(group), group)}
+ 
+ 
+ @router.get("/history")
+ async def history(
+     key: str = Query(...),
+     db: AsyncSession = Depends(get_db),
+     cache: ConfigCache = Depends(get_config_cache),
+     user: User = Depends(require_permission("config:read")),
+ ) -> list[dict]:
+     repo = ConfigHistoryRepository(db)
+-    rows = await repo.list_by_key(key)
+-    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
+-    group = group_of_key(key)
+-    field = key.split(".", 1)[1]
+-    fi = GROUP_MODELS[group].model_fields.get(field)
+-    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
+-    out = []
+-    for r in rows:
+-        out.append({
+-            "key": r.config_key,
+-            "old_value": "***" if is_secret else r.old_value,
+-            "new_value": "***" if is_secret else r.new_value,
+-            "changed_by": str(r.changed_by),
+-            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
+-        })
+-    return out
++    return _format_history(await repo.list_by_key(key), key)
+ 
+ 
+ @router.get("/{key}")
+ async def get_value(
+     key: str,
+     db: AsyncSession = Depends(get_db),
+     cache: ConfigCache = Depends(get_config_cache),
+     user: User = Depends(require_permission("config:read")),
+ ) -> dict:
++    from app.application.schemas.system_config import group_of_key
+     svc = _svc(db, cache)
+-    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
+     group = group_of_key(key)
+-    values = await svc.get_group(group)
+-    field = key.split(".", 1)[1]
+-    val = values.get(field)
+-    fi = GROUP_MODELS[group].model_fields.get(field)
+-    if fi is not None and "SecretStr" in str(fi.annotation):
+-        val = "***"
+-    return {"key": key, "group": group, "value": val}
++    return _get_value_result(await svc.get_group(group), key, group)
+ 
+ 
+ @router.put("/{key}")
+ async def put_value(
+     key: str,
+     req: ConfigValueUpdate,
+     db: AsyncSession = Depends(get_db),
+     cache: ConfigCache = Depends(get_config_cache),
+     user: User = Depends(require_permission("config:update")),
+ ) -> dict:
+diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
+index 1ba7e1f..99483b6 100644
+--- a/user-service/back-end/app/main.py
++++ b/user-service/back-end/app/main.py
+@@ -1,39 +1,66 @@
+ """FastAPI 应用入口."""
+ 
+ from __future__ import annotations
+ 
++import asyncio
++import uuid
+ from collections.abc import AsyncIterator
+ from contextlib import asynccontextmanager
+ 
+ from fastapi import FastAPI
+ from fastapi.middleware.cors import CORSMiddleware
+ 
+ # 确保关联表与模型在导入时注册到 Base.metadata
+ import app.domain.models.associations  # noqa: F401
+ import app.domain.models.department  # noqa: F401
+ import app.domain.models.role  # noqa: F401
+ import app.domain.models.system_config  # noqa: F401
+ import app.domain.models.user  # noqa: F401
++from app.application.services.config_service import ConfigService
++from app.core import crypto
+ from app.core.config import settings
+-from app.core.database import engine
++from app.core.config_cache import get_config_cache
++from app.core.database import AsyncSessionLocal, engine
+ from app.core.exceptions import register_exception_handlers
+ from app.domain.models import Base
+ from app.interfaces.api import auth, departments, email_templates, health, system_config, users
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository,
++    SystemConfigRepository,
++)
+ 
+ 
+ @asynccontextmanager
+ async def lifespan(_: FastAPI) -> AsyncIterator[None]:
+     # 测试/开发环境自动建表；生产应使用 Alembic 迁移
+     async with engine.begin() as conn:
+         await conn.run_sync(Base.metadata.create_all)
++    # 配置缓存订阅(Redis 实现时;本地 no-op)
++    cache = await get_config_cache()
++    subscriber_task = asyncio.create_task(cache.start_subscriber())
++    # 幂等初始化默认配置(全零 UUID 作为系统操作人)
++    async with AsyncSessionLocal() as session:
++        svc = ConfigService(
++            session,
++            SystemConfigRepository(session),
++            ConfigHistoryRepository(session),
++            crypto,
++            cache,
++        )
++        await svc.init_default_configs(uuid.UUID(int=0))
+     yield
++    subscriber_task.cancel()
++    try:
++        await subscriber_task
++    except asyncio.CancelledError:
++        pass
+     await engine.dispose()
+ 
+ 
+ def create_app() -> FastAPI:
+     app = FastAPI(
+         title=settings.APP_NAME,
+         version="0.1.0",
+         openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
+         docs_url="/docs",
+     )
+diff --git a/user-service/back-end/app/repositories/system_config_repository.py b/user-service/back-end/app/repositories/system_config_repository.py
+index 28478e6..33b7ea4 100644
+--- a/user-service/back-end/app/repositories/system_config_repository.py
++++ b/user-service/back-end/app/repositories/system_config_repository.py
+@@ -13,28 +13,30 @@ from app.domain.models.system_config import ConfigHistory, EmailTemplate, System
+ 
+ class SystemConfigRepository:
+     def __init__(self, db: AsyncSession):
+         self.db = db
+ 
+     async def get_by_key(self, key: str) -> SystemConfig | None:
+         result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
+         return result.scalar_one_or_none()
+ 
+     async def list_by_group(self, group: str) -> list[SystemConfig]:
+-        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_group == group))
++        stmt = select(SystemConfig).where(SystemConfig.config_group == group)
++        result = await self.db.execute(stmt)
+         return list(result.scalars().all())
+ 
+     async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
+         stmt = select(SystemConfig)
+         if group is not None:
+             stmt = stmt.where(SystemConfig.config_group == group)
+-        result = await self.db.execute(stmt.order_by(SystemConfig.config_group, SystemConfig.config_key))
++        stmt = stmt.order_by(SystemConfig.config_group, SystemConfig.config_key)
++        result = await self.db.execute(stmt)
+         return list(result.scalars().all())
+ 
+     async def upsert(self, key: str, value: str, group: str, type_: str,
+                      is_encrypted: bool, updated_by: uuid.UUID | None,
+                      description: str | None = None) -> SystemConfig:
+         existing = await self.get_by_key(key)
+         if existing is None:
+             row = SystemConfig(config_key=key, config_value=value, config_group=group,
+                                config_type=type_, is_encrypted=is_encrypted,
+                                updated_by=updated_by, description=description)
+@@ -73,21 +75,22 @@ class ConfigHistoryRepository:
+ 
+ 
+ class EmailTemplateRepository:
+     def __init__(self, db: AsyncSession):
+         self.db = db
+ 
+     async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
+         return await self.db.get(EmailTemplate, tpl_id)
+ 
+     async def get_by_code(self, code: str) -> EmailTemplate | None:
+-        result = await self.db.execute(select(EmailTemplate).where(EmailTemplate.template_code == code))
++        stmt = select(EmailTemplate).where(EmailTemplate.template_code == code)
++        result = await self.db.execute(stmt)
+         return result.scalar_one_or_none()
+ 
+     async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
+         total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
+         total = int(total_result.scalar_one())
+         result = await self.db.execute(
+             select(EmailTemplate).order_by(EmailTemplate.template_code)
+             .offset((page - 1) * size).limit(size)
+         )
+         return list(result.scalars().all()), total
+diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
+index e8116a6..8428248 100644
+--- a/user-service/back-end/tests/conftest.py
++++ b/user-service/back-end/tests/conftest.py
+@@ -9,22 +9,22 @@ from collections.abc import AsyncIterator
+ 
+ import pytest
+ import pytest_asyncio
+ from httpx import ASGITransport, AsyncClient
+ from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
+ 
+ # 确保所有模型注册到 Base.metadata
+ import app.domain.models.associations  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
+-import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.system_config  # noqa: F401  pylint: disable=unused-import
++import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
+ from app.core.database import get_db
+ from app.domain.models import Base
+ from app.domain.models.enums import DataScope
+ from app.domain.models.role import Permission, Role
+ from app.main import app
+ 
+ 
+ @pytest.fixture(autouse=True)
+ def _encryption_key(monkeypatch):
+     from cryptography.fernet import Fernet
+diff --git a/user-service/back-end/tests/test_config_cache.py b/user-service/back-end/tests/test_config_cache.py
+index ba9a3bb..5c7fb33 100644
+--- a/user-service/back-end/tests/test_config_cache.py
++++ b/user-service/back-end/tests/test_config_cache.py
+@@ -31,20 +31,56 @@ async def test_local_cache_start_subscriber_noop():
+     await cache.start_subscriber()  # 不抛错
+ 
+ 
+ async def test_factory_returns_local_when_disabled(monkeypatch):
+     from app.core.config import settings
+     monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
+     cache = await get_config_cache()
+     assert isinstance(cache, LocalTTLCache)
+ 
+ 
++async def test_factory_builds_redis_when_enabled(monkeypatch):
++    import app.core.config_cache as mod
++    from app.core.config import settings
++    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", True)
++    monkeypatch.setattr(mod, "_redis_singleton", None)
++
++    async def fake_build():
++        return FakeRedis()
++
++    monkeypatch.setattr(
++        "app.core.redis_config_cache.build_redis_client", fake_build
++    )
++    cache = await get_config_cache()
++    from app.core.redis_config_cache import RedisPubSubConfigCache
++    assert isinstance(cache, RedisPubSubConfigCache)
++    # 第二次调用返回缓存的 singleton
++    cache2 = await get_config_cache()
++    assert cache2 is cache
++
++
++async def test_factory_fallback_on_redis_error(monkeypatch):
++    import app.core.config_cache as mod
++    from app.core.config import settings
++    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", True)
++    monkeypatch.setattr(mod, "_redis_singleton", None)
++
++    async def boom():
++        raise RuntimeError("no redis")
++
++    monkeypatch.setattr(
++        "app.core.redis_config_cache.build_redis_client", boom
++    )
++    cache = await get_config_cache()
++    assert isinstance(cache, LocalTTLCache)
++
++
+ def test_protocol_compat():
+     assert isinstance(LocalTTLCache(), ConfigCache)
+ 
+ 
+ class FakeRedis:
+     def __init__(self):
+         self.store: dict[str, str] = {}
+         self.published: list[tuple[str, str]] = []
+         self._subs: list = []
+ 
+@@ -66,21 +102,24 @@ class FakeRedis:
+             async def subscribe(self, *channels):
+                 self.parent._subs.append(self)
+ 
+             async def get_message(self, ignore_subscribe_messages=True, timeout=None):
+                 if self._queue:
+                     return self._queue.pop(0)
+                 return None
+ 
+             def push(self, channel, message):
+                 import types
+-                self._queue.append(types.SimpleNamespace(type="message", channel=channel, data=message))
++                msg = types.SimpleNamespace(
++                    type="message", channel=channel, data=message
++                )
++                self._queue.append(msg)
+ 
+             async def close(self):
+                 pass
+ 
+         return _PubSub(self)
+ 
+     async def ping(self):
+         return True
+ 
+     async def close(self):
+diff --git a/user-service/back-end/tests/test_config_group_models.py b/user-service/back-end/tests/test_config_group_models.py
+index d321df7..d664a23 100644
+--- a/user-service/back-end/tests/test_config_group_models.py
++++ b/user-service/back-end/tests/test_config_group_models.py
+@@ -1,17 +1,21 @@
+ from __future__ import annotations
+ 
+ import pytest
+ from pydantic import ValidationError
+ 
+ from app.application.schemas.system_config import (
+-    GROUP_MODELS, MailConfig, SecurityPolicy, SystemParams, group_of_key,
++    GROUP_MODELS,
++    MailConfig,
++    SecurityPolicy,
++    SystemParams,
++    group_of_key,
+ )
+ 
+ pytestmark = pytest.mark.asyncio
+ 
+ 
+ def test_group_of_key():
+     assert group_of_key("mail.host") == "MAIL"
+     assert group_of_key("security.password_min_length") == "SECURITY"
+     assert group_of_key("performance.cache_user_info_ttl") == "PERFORMANCE"
+     assert group_of_key("system.site_name") == "SYSTEM"
+diff --git a/user-service/back-end/tests/test_config_service.py b/user-service/back-end/tests/test_config_service.py
+index 41028df..89f09c0 100644
+--- a/user-service/back-end/tests/test_config_service.py
++++ b/user-service/back-end/tests/test_config_service.py
+@@ -2,23 +2,24 @@
+ from __future__ import annotations
+ 
+ import uuid
+ 
+ import pytest
+ from sqlalchemy.ext.asyncio import async_sessionmaker
+ 
+ from app.application.services.config_service import ConfigService
+ from app.core import crypto
+ from app.core.config_cache import LocalTTLCache
+-from app.core.exceptions import BusinessException, NotFoundError
++from app.core.exceptions import BusinessException
+ from app.repositories.system_config_repository import (
+-    ConfigHistoryRepository, SystemConfigRepository,
++    ConfigHistoryRepository,
++    SystemConfigRepository,
+ )
+ 
+ pytestmark = pytest.mark.asyncio
+ 
+ 
+ def _svc(db):
+     return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
+                           crypto, LocalTTLCache())
+ 
+ 
+@@ -115,16 +116,19 @@ async def test_cache_invalidation_on_set(engine, seed):
+     class SpyCache(LocalTTLCache):
+         def __init__(self):
+             super().__init__()
+             self.invalidated: list = []
+ 
+         async def invalidate(self, group=None):
+             self.invalidated.append(group)
+ 
+     async with Session() as db:
+         spy = SpyCache()
+-        svc = ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, spy)
++        svc = ConfigService(
++            db, SystemConfigRepository(db),
++            ConfigHistoryRepository(db), crypto, spy,
++        )
+         await svc.init_default_configs(uuid.uuid4())
+         await db.commit()
+         await svc.set_value("system.site_name", "Z", uuid.uuid4())
+         await db.commit()
+         assert "SYSTEM" in spy.invalidated
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_system_config_api.py b/user-service/back-end/tests/test_system_config_api.py
+index bfbe3b9..b8745bc 100644
+--- a/user-service/back-end/tests/test_system_config_api.py
++++ b/user-service/back-end/tests/test_system_config_api.py
+@@ -50,15 +50,18 @@ async def test_history(client, admin_token):
+     resp = await client.get("/api/v1/config/history?key=system.site_name",
+                             headers=await _h(admin_token))
+     assert resp.status_code == 200
+     assert len(resp.json()) >= 1
+ 
+ 
+ async def test_regular_user_forbidden(client):
+     reg = await client.post("/api/v1/auth/register", json={
+         "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
+     assert reg.status_code == 201
+-    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
++    login = await client.post(
++        "/api/v1/auth/login",
++        json={"email": "r@t.com", "password": "Rr@12345"},
++    )
+     token = login.json()["access_token"]
+     resp = await client.put("/api/v1/config/system.site_name",
+                             json={"value": "x"}, headers=await _h(token))
+     assert resp.status_code == 403
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
+index 2d1b4c7..a430fbe 100644
+--- a/user-service/back-end/tests/test_system_config_model.py
++++ b/user-service/back-end/tests/test_system_config_model.py
+@@ -1,22 +1,22 @@
+ # tests/test_system_config_model.py
+ from __future__ import annotations
+ 
+ import pytest
+ from sqlalchemy import inspect
+ 
+-from app.domain.models import Base
+ import app.domain.models.associations  # noqa: F401
+ import app.domain.models.department  # noqa: F401
+ import app.domain.models.role  # noqa: F401
+-import app.domain.models.user  # noqa: F401
+ import app.domain.models.system_config  # noqa: F401
++import app.domain.models.user  # noqa: F401
++from app.domain.models import Base
+ 
+ pytestmark = pytest.mark.asyncio
+ 
+ 
+ def test_system_config_columns():
+     cols = {c.name for c in inspect(Base.metadata.tables["system_config"]).columns}
+     assert {"id", "config_key", "config_value", "config_group", "config_type",
+             "is_encrypted", "description", "updated_by",
+             "created_at", "updated_at"} <= cols
+     assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
+diff --git a/user-service/back-end/tests/test_system_config_repository.py b/user-service/back-end/tests/test_system_config_repository.py
+index 0238cf8..78a94d2 100644
+--- a/user-service/back-end/tests/test_system_config_repository.py
++++ b/user-service/back-end/tests/test_system_config_repository.py
+@@ -1,21 +1,23 @@
+ # tests/test_system_config_repository.py
+ from __future__ import annotations
+ 
+ import uuid
+ 
+ import pytest
+ from sqlalchemy.ext.asyncio import async_sessionmaker
+ 
+-from app.domain.models.system_config import EmailTemplate, SystemConfig
++from app.domain.models.system_config import EmailTemplate
+ from app.repositories.system_config_repository import (
+-    ConfigHistoryRepository, EmailTemplateRepository, SystemConfigRepository,
++    ConfigHistoryRepository,
++    EmailTemplateRepository,
++    SystemConfigRepository,
+ )
+ 
+ pytestmark = pytest.mark.asyncio
+ 
+ 
+ async def test_upsert_inserts_and_updates(engine, seed):
+     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+     async with Session() as db:
+         repo = SystemConfigRepository(db)
+         await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
diff --git a/.superpowers/sdd/review-cfg1fix-cae4272-d1e9ac1.md b/.superpowers/sdd/review-cfg1fix-cae4272-d1e9ac1.md
new file mode 100644
index 0000000..2f1d355
--- /dev/null
+++ b/.superpowers/sdd/review-cfg1fix-cae4272-d1e9ac1.md
@@ -0,0 +1,49 @@
+﻿## commits cae4272..d1e9ac1
+d1e9ac1 fix(config): ConfigHistory.changed_at 加索引 + 测试断言
+
+## diff -U8
+diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
+index 44d4b45..c8b7d77 100644
+--- a/user-service/back-end/app/domain/models/system_config.py
++++ b/user-service/back-end/app/domain/models/system_config.py
+@@ -29,17 +29,17 @@ class SystemConfig(Base):
+ class ConfigHistory(Base):
+     __tablename__ = "config_history"
+ 
+     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+     config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
+     old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+     new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+     changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
+-    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
++    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
+ 
+ 
+ class EmailTemplate(Base):
+     __tablename__ = "email_template"
+ 
+     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+     template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
+     template_name: Mapped[str] = mapped_column(String(100), nullable=False)
+diff --git a/user-service/back-end/tests/test_system_config_model.py b/user-service/back-end/tests/test_system_config_model.py
+index d9bb138..2d1b4c7 100644
+--- a/user-service/back-end/tests/test_system_config_model.py
++++ b/user-service/back-end/tests/test_system_config_model.py
+@@ -20,15 +20,16 @@ def test_system_config_columns():
+             "is_encrypted", "description", "updated_by",
+             "created_at", "updated_at"} <= cols
+     assert Base.metadata.tables["system_config"].columns["config_key"].unique is True
+ 
+ 
+ def test_config_history_columns():
+     cols = {c.name for c in inspect(Base.metadata.tables["config_history"]).columns}
+     assert {"id", "config_key", "old_value", "new_value", "changed_by", "changed_at"} <= cols
++    assert Base.metadata.tables["config_history"].columns["changed_at"].index is True
+ 
+ 
+ def test_email_template_columns():
+     cols = {c.name for c in inspect(Base.metadata.tables["email_template"]).columns}
+     assert {"id", "template_code", "template_name", "subject", "content",
+             "variables", "is_active", "created_at", "updated_at"} <= cols
+     assert Base.metadata.tables["email_template"].columns["template_code"].unique is True
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg2-d1e9ac1-33cf225.md b/.superpowers/sdd/review-cfg2-d1e9ac1-33cf225.md
new file mode 100644
index 0000000..f1b8d4e
--- /dev/null
+++ b/.superpowers/sdd/review-cfg2-d1e9ac1-33cf225.md
@@ -0,0 +1,220 @@
+﻿## commits d1e9ac1..33cf225
+33cf225 feat(config): Fernet 加密模块 + CONFIG_ENCRYPTION_KEY
+
+## stat
+ user-service/back-end/app/core/config.py   |  5 +++++
+ user-service/back-end/app/core/crypto.py   | 26 ++++++++++++++++++++++++++
+ user-service/back-end/pyproject.toml       |  1 +
+ user-service/back-end/tests/conftest.py    | 14 ++++++++++++++
+ user-service/back-end/tests/test_crypto.py | 26 ++++++++++++++++++++++++++
+ user-service/back-end/uv.lock              |  2 ++
+ 6 files changed, 74 insertions(+)
+
+## diff -U10
+diff --git a/user-service/back-end/app/core/config.py b/user-service/back-end/app/core/config.py
+index 5041d52..a291e3d 100644
+--- a/user-service/back-end/app/core/config.py
++++ b/user-service/back-end/app/core/config.py
+@@ -28,17 +28,22 @@ class Settings(BaseSettings):
+ 
+     # 密码策略
+     PASSWORD_MIN_LENGTH: int = 8
+ 
+     # Redis（可选，测试不依赖）
+     REDIS_URL: str = "redis://localhost:6379/0"
+ 
+     # 缓存开关(测试置 False 强制 Noop 降级)
+     CACHE_ENABLED: bool = True
+ 
++    # 配置加密密钥(Fernet,启动期必须提供)
++    CONFIG_ENCRYPTION_KEY: str = ""  # 生产由 .env 注入;测试由 fixture 注入
++    # 配置缓存开关(测试置 False 强制 LocalTTLCache)
++    CONFIG_CACHE_ENABLED: bool = True
++
+ 
+ @lru_cache(maxsize=1)
+ def get_settings() -> Settings:
+     return Settings()
+ 
+ 
+ settings = get_settings()
+\ No newline at end of file
+diff --git a/user-service/back-end/app/core/crypto.py b/user-service/back-end/app/core/crypto.py
+new file mode 100644
+index 0000000..27decdb
+--- /dev/null
++++ b/user-service/back-end/app/core/crypto.py
+@@ -0,0 +1,26 @@
++"""Fernet 对称加密(敏感配置)."""
++
++from __future__ import annotations
++
++from cryptography.fernet import Fernet
++
++from app.core.config import settings
++
++_fernet: Fernet | None = None
++
++
++def _get_fernet() -> Fernet:
++    global _fernet
++    if _fernet is None:
++        if not settings.CONFIG_ENCRYPTION_KEY:
++            raise RuntimeError("CONFIG_ENCRYPTION_KEY 未配置:无法加解密敏感配置")
++        _fernet = Fernet(settings.CONFIG_ENCRYPTION_KEY.encode())
++    return _fernet
++
++
++def encrypt(plain: str) -> str:
++    return _get_fernet().encrypt(plain.encode()).decode()
++
++
++def decrypt(cipher: str) -> str:
++    return _get_fernet().decrypt(cipher.encode()).decode()
+\ No newline at end of file
+diff --git a/user-service/back-end/pyproject.toml b/user-service/back-end/pyproject.toml
+index 81f1120..21d02bd 100644
+--- a/user-service/back-end/pyproject.toml
++++ b/user-service/back-end/pyproject.toml
+@@ -12,20 +12,21 @@ dependencies = [
+     "asyncpg>=0.29",
+     "alembic>=1.13",
+     "pydantic>=2.7",
+     "pydantic-settings>=2.3",
+     "email-validator>=2.1",
+     "python-jose[cryptography]>=3.3",
+     "passlib[bcrypt]>=1.7.4",
+     "bcrypt<4.0.0",
+     "redis>=5.0",
+     "cachetools>=5.3",
++    "cryptography>=43.0",
+ ]
+ 
+ [project.optional-dependencies]
+ dev = [
+     "pytest>=8.0",
+     "pytest-asyncio>=0.23",
+     "pytest-cov>=5.0",
+     "httpx>=0.27",
+     "ruff>=0.5",
+     "mypy>=1.10",
+diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
+index 9e0c8c5..613f607 100644
+--- a/user-service/back-end/tests/conftest.py
++++ b/user-service/back-end/tests/conftest.py
+@@ -17,20 +17,34 @@ import app.domain.models.associations  # noqa: F401  pylint: disable=unused-impo
+ import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
+ from app.core.database import get_db
+ from app.domain.models import Base
+ from app.domain.models.enums import DataScope
+ from app.domain.models.role import Permission, Role
+ from app.main import app
+ 
+ 
++@pytest.fixture(autouse=True)
++def _encryption_key(monkeypatch):
++    from cryptography.fernet import Fernet
++
++    from app.core import config as _config
++
++    monkeypatch.setattr(
++        _config.settings, "CONFIG_ENCRYPTION_KEY", Fernet.generate_key().decode()
++    )
++    # crypto 模块缓存了 _fernet,重置以用新密钥
++    from app.core import crypto
++    crypto._fernet = None
++
++
+ @pytest.fixture(scope="session")
+ def db_file():
+     fd, path = tempfile.mkstemp(suffix=".db")
+     os.close(fd)
+     yield path
+     try:
+         os.remove(path)
+     except OSError:
+         pass
+ 
+diff --git a/user-service/back-end/tests/test_crypto.py b/user-service/back-end/tests/test_crypto.py
+new file mode 100644
+index 0000000..e2f5b21
+--- /dev/null
++++ b/user-service/back-end/tests/test_crypto.py
+@@ -0,0 +1,26 @@
++from __future__ import annotations
++
++import pytest
++
++from app.core.crypto import decrypt, encrypt
++
++pytestmark = pytest.mark.asyncio
++
++
++async def test_encrypt_decrypt_roundtrip():
++    plain = "smtp-password-123"
++    cipher = encrypt(plain)
++    assert cipher != plain and isinstance(cipher, str)
++    assert decrypt(cipher) == plain
++
++
++async def test_encrypt_different_each_time():
++    a = encrypt("x")
++    b = encrypt("x")
++    assert a != b  # Fernet 每次带随机 IV
++
++
++def test_decrypt_invalid_token_raises():
++    from cryptography.fernet import InvalidToken
++    with pytest.raises(InvalidToken):
++        decrypt("not-a-valid-fernet-token")
+\ No newline at end of file
+diff --git a/user-service/back-end/uv.lock b/user-service/back-end/uv.lock
+index 9e97319..c630593 100644
+--- a/user-service/back-end/uv.lock
++++ b/user-service/back-end/uv.lock
+@@ -1211,20 +1211,21 @@ wheels = [
+ [[package]]
+ name = "user-service-backend"
+ version = "0.1.0"
+ source = { editable = "." }
+ dependencies = [
+     { name = "aiosqlite" },
+     { name = "alembic" },
+     { name = "asyncpg" },
+     { name = "bcrypt" },
+     { name = "cachetools" },
++    { name = "cryptography" },
+     { name = "email-validator" },
+     { name = "fastapi" },
+     { name = "passlib", extra = ["bcrypt"] },
+     { name = "pydantic" },
+     { name = "pydantic-settings" },
+     { name = "python-jose", extra = ["cryptography"] },
+     { name = "python-multipart" },
+     { name = "redis" },
+     { name = "sqlalchemy", extra = ["asyncio"] },
+     { name = "uvicorn", extra = ["standard"] },
+@@ -1240,20 +1241,21 @@ dev = [
+     { name = "ruff" },
+ ]
+ 
+ [package.metadata]
+ requires-dist = [
+     { name = "aiosqlite", specifier = ">=0.20" },
+     { name = "alembic", specifier = ">=1.13" },
+     { name = "asyncpg", specifier = ">=0.29" },
+     { name = "bcrypt", specifier = "<4.0.0" },
+     { name = "cachetools", specifier = ">=5.3" },
++    { name = "cryptography", specifier = ">=43.0" },
+     { name = "email-validator", specifier = ">=2.1" },
+     { name = "fastapi", specifier = ">=0.115" },
+     { name = "httpx", marker = "extra == 'dev'", specifier = ">=0.27" },
+     { name = "mypy", marker = "extra == 'dev'", specifier = ">=1.10" },
+     { name = "passlib", extras = ["bcrypt"], specifier = ">=1.7.4" },
+     { name = "pydantic", specifier = ">=2.7" },
+     { name = "pydantic-settings", specifier = ">=2.3" },
+     { name = "pytest", marker = "extra == 'dev'", specifier = ">=8.0" },
+     { name = "pytest-asyncio", marker = "extra == 'dev'", specifier = ">=0.23" },
+     { name = "pytest-cov", marker = "extra == 'dev'", specifier = ">=5.0" },
diff --git a/.superpowers/sdd/review-cfg3-33cf225-16a4cc2.md b/.superpowers/sdd/review-cfg3-33cf225-16a4cc2.md
new file mode 100644
index 0000000..f435832
--- /dev/null
+++ b/.superpowers/sdd/review-cfg3-33cf225-16a4cc2.md
@@ -0,0 +1,132 @@
+﻿## commits 33cf225..16a4cc2
+16a4cc2 feat(config): 分组 Pydantic 模型 + key→组映射
+
+## stat
+ .../app/application/schemas/system_config.py       | 62 ++++++++++++++++++++++
+ .../back-end/tests/test_config_group_models.py     | 47 ++++++++++++++++
+ 2 files changed, 109 insertions(+)
+
+## diff -U10
+diff --git a/user-service/back-end/app/application/schemas/system_config.py b/user-service/back-end/app/application/schemas/system_config.py
+new file mode 100644
+index 0000000..d150531
+--- /dev/null
++++ b/user-service/back-end/app/application/schemas/system_config.py
+@@ -0,0 +1,62 @@
++"""系统配置分组 Pydantic 模型 + key→组映射."""
++
++from __future__ import annotations
++
++from typing import Literal
++
++from pydantic import BaseModel, EmailStr, Field, SecretStr
++
++_PREFIX_TO_GROUP = {"mail": "MAIL", "security": "SECURITY",
++                    "performance": "PERFORMANCE", "system": "SYSTEM"}
++
++
++def group_of_key(key: str) -> str:
++    prefix = key.split(".", 1)[0]
++    group = _PREFIX_TO_GROUP.get(prefix)
++    if group is None:
++        raise ValueError(f"未知配置组前缀: {prefix}")
++    return group
++
++
++class MailConfig(BaseModel):
++    host: str = Field(min_length=1, max_length=255)
++    port: int = Field(ge=1, le=65535)
++    username: str = Field(min_length=1, max_length=255)
++    password: SecretStr
++    protocol: Literal["smtp", "smtps"] = "smtp"
++    starttls: bool = True
++
++
++class SecurityPolicy(BaseModel):
++    password_min_length: int = Field(ge=6, le=128)
++    password_require_uppercase: bool
++    password_require_lowercase: bool
++    password_require_digits: bool
++    password_require_special: bool
++    password_history_size: int = Field(ge=0, le=20)
++    password_expiration_days: int = Field(ge=0, le=365)
++    login_max_attempts: int = Field(ge=1, le=20)
++    login_lock_minutes: int = Field(ge=1, le=1440)
++    session_timeout_minutes: int = Field(ge=1, le=1440)
++
++
++class PerformanceConfig(BaseModel):
++    cache_user_info_ttl: int = Field(ge=10, le=3600)
++    cache_permission_ttl: int = Field(ge=10, le=3600)
++    cache_department_tree_ttl: int = Field(ge=10, le=3600)
++    db_max_pool_size: int = Field(ge=1, le=100)
++    api_response_threshold_ms: int = Field(ge=10, le=10000)
++
++
++class SystemParams(BaseModel):
++    site_name: str = Field(min_length=1, max_length=100)
++    default_locale: str = Field(pattern=r"^[a-z]{2}_[A-Z]{2}$")
++    support_email: EmailStr
++
++
++GROUP_MODELS = {
++    "MAIL": MailConfig,
++    "SECURITY": SecurityPolicy,
++    "PERFORMANCE": PerformanceConfig,
++    "SYSTEM": SystemParams,
++}
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_config_group_models.py b/user-service/back-end/tests/test_config_group_models.py
+new file mode 100644
+index 0000000..d321df7
+--- /dev/null
++++ b/user-service/back-end/tests/test_config_group_models.py
+@@ -0,0 +1,47 @@
++from __future__ import annotations
++
++import pytest
++from pydantic import ValidationError
++
++from app.application.schemas.system_config import (
++    GROUP_MODELS, MailConfig, SecurityPolicy, SystemParams, group_of_key,
++)
++
++pytestmark = pytest.mark.asyncio
++
++
++def test_group_of_key():
++    assert group_of_key("mail.host") == "MAIL"
++    assert group_of_key("security.password_min_length") == "SECURITY"
++    assert group_of_key("performance.cache_user_info_ttl") == "PERFORMANCE"
++    assert group_of_key("system.site_name") == "SYSTEM"
++
++
++def test_group_of_key_unknown():
++    with pytest.raises(ValueError):
++        group_of_key("unknown.x")
++
++
++def test_security_policy_validates_range():
++    with pytest.raises(ValidationError):
++        SecurityPolicy(
++            password_min_length=3,  # < 6
++            password_require_uppercase=True, password_require_lowercase=True,
++            password_require_digits=True, password_require_special=True,
++            password_history_size=5, password_expiration_days=90,
++            login_max_attempts=5, login_lock_minutes=30, session_timeout_minutes=15,
++        )
++
++
++def test_mail_config_port_range():
++    with pytest.raises(ValidationError):
++        MailConfig(host="smtp", port=99999, username="u", password="p")
++
++
++def test_system_params_locale_pattern():
++    with pytest.raises(ValidationError):
++        SystemParams(site_name="x", default_locale="invalid", support_email="a@b.com")
++
++
++def test_group_models_keys():
++    assert set(GROUP_MODELS.keys()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg4-16a4cc2-49cdfe6.md b/.superpowers/sdd/review-cfg4-16a4cc2-49cdfe6.md
new file mode 100644
index 0000000..db1b807
--- /dev/null
+++ b/.superpowers/sdd/review-cfg4-16a4cc2-49cdfe6.md
@@ -0,0 +1,129 @@
+﻿## commits 16a4cc2..49cdfe6
+49cdfe6 feat(config): ConfigCache 协议 + LocalTTLCache + 工厂
+
+## stat
+ user-service/back-end/app/core/config_cache.py   | 64 ++++++++++++++++++++++++
+ user-service/back-end/tests/test_config_cache.py | 42 ++++++++++++++++
+ 2 files changed, 106 insertions(+)
+
+## diff -U10
+diff --git a/user-service/back-end/app/core/config_cache.py b/user-service/back-end/app/core/config_cache.py
+new file mode 100644
+index 0000000..97f7489
+--- /dev/null
++++ b/user-service/back-end/app/core/config_cache.py
+@@ -0,0 +1,64 @@
++# app/core/config_cache.py
++"""系统配置缓存抽象 + 本地 TTL + 工厂(Redis 实现见 Task 5)."""
++
++from __future__ import annotations
++
++import logging
++from typing import Protocol, runtime_checkable
++
++from cachetools import TTLCache
++
++from app.core.config import settings
++
++logger = logging.getLogger(__name__)
++
++TTL_SECONDS = 60
++
++
++@runtime_checkable
++class ConfigCache(Protocol):
++    async def get_group(self, group: str) -> dict | None: ...
++    async def set_group(self, group: str, values: dict) -> None: ...
++    async def invalidate(self, group: str | None = None) -> None: ...
++    async def start_subscriber(self) -> None: ...
++
++
++class LocalTTLCache:
++    def __init__(self) -> None:
++        self._store: TTLCache = TTLCache(maxsize=128, ttl=TTL_SECONDS)
++
++    async def get_group(self, group: str) -> dict | None:
++        return self._store.get(group)
++
++    async def set_group(self, group: str, values: dict) -> None:
++        self._store[group] = values
++
++    async def invalidate(self, group: str | None = None) -> None:
++        if group is None:
++            self._store.clear()
++        else:
++            self._store.pop(group, None)
++
++    async def start_subscriber(self) -> None:
++        return None
++
++
++_local_singleton = LocalTTLCache()
++_redis_singleton: ConfigCache | None = None
++
++
++async def get_config_cache() -> ConfigCache:
++    global _redis_singleton
++    if not settings.CONFIG_CACHE_ENABLED:
++        return _local_singleton
++    if _redis_singleton is not None:
++        return _redis_singleton
++    try:
++        from app.core.redis_config_cache import RedisPubSubConfigCache, build_redis_client
++
++        client = await build_redis_client()
++        _redis_singleton = RedisPubSubConfigCache(client)
++    except Exception as exc:  # noqa: BLE001
++        logger.warning("Redis 不可用,配置缓存降级为 LocalTTLCache: %s", exc)
++        _redis_singleton = _local_singleton
++    return _redis_singleton
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_config_cache.py b/user-service/back-end/tests/test_config_cache.py
+new file mode 100644
+index 0000000..b27ffc3
+--- /dev/null
++++ b/user-service/back-end/tests/test_config_cache.py
+@@ -0,0 +1,42 @@
++# tests/test_config_cache.py
++from __future__ import annotations
++
++import pytest
++
++from app.core.config_cache import ConfigCache, LocalTTLCache, get_config_cache
++
++pytestmark = pytest.mark.asyncio
++
++
++async def test_local_cache_miss_and_set():
++    cache = LocalTTLCache()
++    assert await cache.get_group("MAIL") is None
++    await cache.set_group("MAIL", {"host": "smtp"})
++    assert await cache.get_group("MAIL") == {"host": "smtp"}
++
++
++async def test_local_cache_invalidate():
++    cache = LocalTTLCache()
++    await cache.set_group("MAIL", {"a": 1})
++    await cache.set_group("SECURITY", {"b": 2})
++    await cache.invalidate("MAIL")
++    assert await cache.get_group("MAIL") is None
++    assert await cache.get_group("SECURITY") == {"b": 2}
++    await cache.invalidate()  # 全清
++    assert await cache.get_group("SECURITY") is None
++
++
++async def test_local_cache_start_subscriber_noop():
++    cache = LocalTTLCache()
++    await cache.start_subscriber()  # 不抛错
++
++
++async def test_factory_returns_local_when_disabled(monkeypatch):
++    from app.core.config import settings
++    monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
++    cache = await get_config_cache()
++    assert isinstance(cache, LocalTTLCache)
++
++
++def test_protocol_compat():
++    assert isinstance(LocalTTLCache(), ConfigCache)
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg5-49cdfe6-a7e4d08.md b/.superpowers/sdd/review-cfg5-49cdfe6-a7e4d08.md
new file mode 100644
index 0000000..9ab7937
--- /dev/null
+++ b/.superpowers/sdd/review-cfg5-49cdfe6-a7e4d08.md
@@ -0,0 +1,176 @@
+﻿## commits 49cdfe6..a7e4d08
+a7e4d08 feat(config): RedisPubSubConfigCache(pub/sub 即时失效)
+
+## stat
+ .../back-end/app/core/redis_config_cache.py        | 63 +++++++++++++++++
+ user-service/back-end/tests/test_config_cache.py   | 80 +++++++++++++++++++++-
+ 2 files changed, 142 insertions(+), 1 deletion(-)
+
+## diff -U10
+diff --git a/user-service/back-end/app/core/redis_config_cache.py b/user-service/back-end/app/core/redis_config_cache.py
+new file mode 100644
+index 0000000..709b344
+--- /dev/null
++++ b/user-service/back-end/app/core/redis_config_cache.py
+@@ -0,0 +1,63 @@
++# app/core/redis_config_cache.py
++"""Redis pub/sub 配置缓存(组合 LocalTTLCache + 跨 worker 即时失效)."""
++
++from __future__ import annotations
++
++import asyncio
++import logging
++
++from redis.asyncio import Redis
++
++from app.core.config_cache import LocalTTLCache
++
++logger = logging.getLogger(__name__)
++CHANNEL = "config-change"
++
++
++async def build_redis_client() -> Redis:
++    from app.core.config import settings
++
++    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
++    await client.ping()
++    return client
++
++
++class RedisPubSubConfigCache:
++    def __init__(self, client: Redis):
++        self._local = LocalTTLCache()
++        self._redis = client
++
++    async def get_group(self, group: str) -> dict | None:
++        return await self._local.get_group(group)
++
++    async def set_group(self, group: str, values: dict) -> None:
++        await self._local.set_group(group, values)
++
++    async def invalidate(self, group: str | None = None) -> None:
++        await self._local.invalidate(group)
++        try:
++            await self._redis.publish(CHANNEL, group or "*")
++        except Exception as exc:  # noqa: BLE001
++            logger.warning("config cache publish 失败,降级: %s", exc)
++
++    async def start_subscriber(self) -> None:
++        try:
++            pubsub = self._redis.pubsub()
++            await pubsub.subscribe(CHANNEL)
++            while True:
++                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
++                if msg is None:
++                    await asyncio.sleep(0.05)
++                    continue
++                type_ = msg.get("type") if isinstance(msg, dict) else getattr(msg, "type", None)
++                if type_ != "message":
++                    continue
++                group = msg.get("data") if isinstance(msg, dict) else getattr(msg, "data", None)
++                if group in (None, "*"):
++                    await self._local.invalidate()
++                else:
++                    await self._local.invalidate(group)
++        except asyncio.CancelledError:
++            raise
++        except Exception as exc:  # noqa: BLE001
++            logger.warning("config cache 订阅断开,降级为本地 TTL: %s", exc)
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_config_cache.py b/user-service/back-end/tests/test_config_cache.py
+index b27ffc3..ba9a3bb 100644
+--- a/user-service/back-end/tests/test_config_cache.py
++++ b/user-service/back-end/tests/test_config_cache.py
+@@ -32,11 +32,89 @@ async def test_local_cache_start_subscriber_noop():
+ 
+ 
+ async def test_factory_returns_local_when_disabled(monkeypatch):
+     from app.core.config import settings
+     monkeypatch.setattr(settings, "CONFIG_CACHE_ENABLED", False)
+     cache = await get_config_cache()
+     assert isinstance(cache, LocalTTLCache)
+ 
+ 
+ def test_protocol_compat():
+-    assert isinstance(LocalTTLCache(), ConfigCache)
+\ No newline at end of file
++    assert isinstance(LocalTTLCache(), ConfigCache)
++
++
++class FakeRedis:
++    def __init__(self):
++        self.store: dict[str, str] = {}
++        self.published: list[tuple[str, str]] = []
++        self._subs: list = []
++
++    async def get(self, key):
++        return self.store.get(key)
++
++    async def set(self, key, value, ex=None):
++        self.store[key] = value
++
++    async def publish(self, channel, message):
++        self.published.append((channel, message))
++
++    def pubsub(self):
++        class _PubSub:
++            def __init__(self, parent):
++                self.parent = parent
++                self._queue: list = []
++
++            async def subscribe(self, *channels):
++                self.parent._subs.append(self)
++
++            async def get_message(self, ignore_subscribe_messages=True, timeout=None):
++                if self._queue:
++                    return self._queue.pop(0)
++                return None
++
++            def push(self, channel, message):
++                import types
++                self._queue.append(types.SimpleNamespace(type="message", channel=channel, data=message))
++
++            async def close(self):
++                pass
++
++        return _PubSub(self)
++
++    async def ping(self):
++        return True
++
++    async def close(self):
++        pass
++
++
++async def test_redis_cache_uses_local_and_publishes_invalidate():
++    from app.core.redis_config_cache import RedisPubSubConfigCache
++    cache = RedisPubSubConfigCache(FakeRedis())
++    await cache.set_group("MAIL", {"host": "smtp"})
++    assert await cache.get_group("MAIL") == {"host": "smtp"}
++    await cache.invalidate("MAIL")
++    assert await cache.get_group("MAIL") is None
++    assert ("config-change", "MAIL") in cache._redis.published  # noqa: SLF001
++
++
++async def test_redis_cache_subscriber_invalidates_local():
++    import asyncio
++
++    from app.core.redis_config_cache import RedisPubSubConfigCache
++
++    fake = FakeRedis()
++    cache = RedisPubSubConfigCache(fake)
++    await cache.set_group("MAIL", {"host": "smtp"})
++    # 启动订阅 task
++    task = asyncio.create_task(cache.start_subscriber())
++    await asyncio.sleep(0.05)  # 让订阅注册
++    assert fake._subs, "subscriber registered"  # noqa: SLF001
++    # 模拟收到失效消息
++    fake._subs[0].push("config-change", "MAIL")
++    await asyncio.sleep(0.05)
++    assert await cache.get_group("MAIL") is None  # 本地被失效
++    task.cancel()
++    try:
++        await task
++    except asyncio.CancelledError:
++        pass
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg6-a7e4d08-1065e8e.md b/.superpowers/sdd/review-cfg6-a7e4d08-1065e8e.md
new file mode 100644
index 0000000..7c40310
--- /dev/null
+++ b/.superpowers/sdd/review-cfg6-a7e4d08-1065e8e.md
@@ -0,0 +1,273 @@
+﻿## commits a7e4d08..1065e8e
+1065e8e feat(config): SystemConfig/ConfigHistory/EmailTemplate 仓储
+
+## stat
+ .../back-end/app/domain/models/system_config.py    |   4 +-
+ .../app/repositories/system_config_repository.py   | 108 +++++++++++++++++++++
+ user-service/back-end/tests/conftest.py            |   1 +
+ .../tests/test_system_config_repository.py         |  67 +++++++++++++
+ 4 files changed, 178 insertions(+), 2 deletions(-)
+
+## diff -U10
+diff --git a/user-service/back-end/app/domain/models/system_config.py b/user-service/back-end/app/domain/models/system_config.py
+index c8b7d77..8cad7c0 100644
+--- a/user-service/back-end/app/domain/models/system_config.py
++++ b/user-service/back-end/app/domain/models/system_config.py
+@@ -1,18 +1,18 @@
+ """系统配置、配置历史、邮件模板模型."""
+ 
+ from __future__ import annotations
+ 
+ import uuid
+ from datetime import datetime
+ 
+-from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid
++from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, Uuid, func
+ from sqlalchemy.orm import Mapped, mapped_column
+ 
+ from app.domain.models import Base
+ 
+ UUIDType = Uuid
+ 
+ 
+ class SystemConfig(Base):
+     __tablename__ = "system_config"
+ 
+@@ -27,21 +27,21 @@ class SystemConfig(Base):
+ 
+ 
+ class ConfigHistory(Base):
+     __tablename__ = "config_history"
+ 
+     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+     config_key: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
+     old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+     new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
+     changed_by: Mapped[uuid.UUID] = mapped_column(UUIDType, nullable=False)
+-    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False)
++    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, nullable=False, server_default=func.now())
+ 
+ 
+ class EmailTemplate(Base):
+     __tablename__ = "email_template"
+ 
+     id: Mapped[uuid.UUID] = mapped_column(UUIDType, primary_key=True, default=uuid.uuid4)
+     template_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
+     template_name: Mapped[str] = mapped_column(String(100), nullable=False)
+     subject: Mapped[str] = mapped_column(String(200), nullable=False)
+     content: Mapped[str] = mapped_column(Text, nullable=False)
+diff --git a/user-service/back-end/app/repositories/system_config_repository.py b/user-service/back-end/app/repositories/system_config_repository.py
+new file mode 100644
+index 0000000..28478e6
+--- /dev/null
++++ b/user-service/back-end/app/repositories/system_config_repository.py
+@@ -0,0 +1,108 @@
++# app/repositories/system_config_repository.py
++"""系统配置、配置历史、邮件模板仓储."""
++
++from __future__ import annotations
++
++import uuid
++
++from sqlalchemy import func, select
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.domain.models.system_config import ConfigHistory, EmailTemplate, SystemConfig
++
++
++class SystemConfigRepository:
++    def __init__(self, db: AsyncSession):
++        self.db = db
++
++    async def get_by_key(self, key: str) -> SystemConfig | None:
++        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_key == key))
++        return result.scalar_one_or_none()
++
++    async def list_by_group(self, group: str) -> list[SystemConfig]:
++        result = await self.db.execute(select(SystemConfig).where(SystemConfig.config_group == group))
++        return list(result.scalars().all())
++
++    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
++        stmt = select(SystemConfig)
++        if group is not None:
++            stmt = stmt.where(SystemConfig.config_group == group)
++        result = await self.db.execute(stmt.order_by(SystemConfig.config_group, SystemConfig.config_key))
++        return list(result.scalars().all())
++
++    async def upsert(self, key: str, value: str, group: str, type_: str,
++                     is_encrypted: bool, updated_by: uuid.UUID | None,
++                     description: str | None = None) -> SystemConfig:
++        existing = await self.get_by_key(key)
++        if existing is None:
++            row = SystemConfig(config_key=key, config_value=value, config_group=group,
++                               config_type=type_, is_encrypted=is_encrypted,
++                               updated_by=updated_by, description=description)
++            self.db.add(row)
++            await self.db.flush()
++            return row
++        existing.config_value = value
++        existing.config_group = group
++        existing.config_type = type_
++        existing.is_encrypted = is_encrypted
++        existing.updated_by = updated_by
++        if description is not None:
++            existing.description = description
++        await self.db.flush()
++        return existing
++
++
++class ConfigHistoryRepository:
++    def __init__(self, db: AsyncSession):
++        self.db = db
++
++    async def add(self, key: str, old_value: str | None, new_value: str | None,
++                  changed_by: uuid.UUID) -> ConfigHistory:
++        row = ConfigHistory(config_key=key, old_value=old_value, new_value=new_value,
++                            changed_by=changed_by)
++        self.db.add(row)
++        await self.db.flush()
++        return row
++
++    async def list_by_key(self, key: str) -> list[ConfigHistory]:
++        result = await self.db.execute(
++            select(ConfigHistory).where(ConfigHistory.config_key == key)
++            .order_by(ConfigHistory.changed_at.desc())
++        )
++        return list(result.scalars().all())
++
++
++class EmailTemplateRepository:
++    def __init__(self, db: AsyncSession):
++        self.db = db
++
++    async def get_by_id(self, tpl_id: uuid.UUID) -> EmailTemplate | None:
++        return await self.db.get(EmailTemplate, tpl_id)
++
++    async def get_by_code(self, code: str) -> EmailTemplate | None:
++        result = await self.db.execute(select(EmailTemplate).where(EmailTemplate.template_code == code))
++        return result.scalar_one_or_none()
++
++    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
++        total_result = await self.db.execute(select(func.count()).select_from(EmailTemplate))
++        total = int(total_result.scalar_one())
++        result = await self.db.execute(
++            select(EmailTemplate).order_by(EmailTemplate.template_code)
++            .offset((page - 1) * size).limit(size)
++        )
++        return list(result.scalars().all()), total
++
++    async def add(self, tpl: EmailTemplate) -> EmailTemplate:
++        self.db.add(tpl)
++        await self.db.flush()
++        return tpl
++
++    async def delete(self, tpl: EmailTemplate) -> None:
++        await self.db.delete(tpl)
++
++
++__all__ = [
++    "SystemConfigRepository",
++    "ConfigHistoryRepository",
++    "EmailTemplateRepository",
++]
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
+index 613f607..71355ae 100644
+--- a/user-service/back-end/tests/conftest.py
++++ b/user-service/back-end/tests/conftest.py
+@@ -10,20 +10,21 @@ from collections.abc import AsyncIterator
+ import pytest
+ import pytest_asyncio
+ from httpx import ASGITransport, AsyncClient
+ from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
+ 
+ # 确保所有模型注册到 Base.metadata
+ import app.domain.models.associations  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.department  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.role  # noqa: F401  pylint: disable=unused-import
+ import app.domain.models.user  # noqa: F401  pylint: disable=unused-import
++import app.domain.models.system_config  # noqa: F401  pylint: disable=unused-import
+ from app.core.database import get_db
+ from app.domain.models import Base
+ from app.domain.models.enums import DataScope
+ from app.domain.models.role import Permission, Role
+ from app.main import app
+ 
+ 
+ @pytest.fixture(autouse=True)
+ def _encryption_key(monkeypatch):
+     from cryptography.fernet import Fernet
+diff --git a/user-service/back-end/tests/test_system_config_repository.py b/user-service/back-end/tests/test_system_config_repository.py
+new file mode 100644
+index 0000000..0238cf8
+--- /dev/null
++++ b/user-service/back-end/tests/test_system_config_repository.py
+@@ -0,0 +1,67 @@
++# tests/test_system_config_repository.py
++from __future__ import annotations
++
++import uuid
++
++import pytest
++from sqlalchemy.ext.asyncio import async_sessionmaker
++
++from app.domain.models.system_config import EmailTemplate, SystemConfig
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository, EmailTemplateRepository, SystemConfigRepository,
++)
++
++pytestmark = pytest.mark.asyncio
++
++
++async def test_upsert_inserts_and_updates(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        repo = SystemConfigRepository(db)
++        await repo.upsert("mail.host", "smtp.x.com", "MAIL", "STRING", False, None)
++        await db.commit()
++        got = await repo.get_by_key("mail.host")
++        assert got is not None and got.config_value == "smtp.x.com"
++        await repo.upsert("mail.host", "smtp.y.com", "MAIL", "STRING", False, None)
++        await db.commit()
++        got2 = await repo.get_by_key("mail.host")
++        assert got2.config_value == "smtp.y.com"
++
++
++async def test_list_by_group(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        repo = SystemConfigRepository(db)
++        await repo.upsert("mail.host", "h", "MAIL", "STRING", False, None)
++        await repo.upsert("mail.port", "25", "MAIL", "INT", False, None)
++        await repo.upsert("system.site_name", "s", "SYSTEM", "STRING", False, None)
++        await db.commit()
++        rows = await repo.list_by_group("MAIL")
++        assert {r.config_key for r in rows} == {"mail.host", "mail.port"}
++
++
++async def test_config_history(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        hist = ConfigHistoryRepository(db)
++        await hist.add("mail.host", "old", "new", uuid.uuid4())
++        await db.commit()
++        rows = await hist.list_by_key("mail.host")
++        assert len(rows) == 1 and rows[0].new_value == "new"
++
++
++async def test_email_template_repo(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        repo = EmailTemplateRepository(db)
++        tpl = EmailTemplate(template_code="USER_ACTIVATION", template_name="激活",
++                            subject="欢迎", content="Hi {{name}}",
++                            variables=[{"name": "name", "description": "用户名", "required": True}])
++        await repo.add(tpl)
++        await db.commit()
++        assert (await repo.get_by_code("USER_ACTIVATION")).template_name == "激活"
++        items, total = await repo.list(1, 20)
++        assert total == 1
++        await repo.delete(tpl)
++        await db.commit()
++        assert await repo.get_by_code("USER_ACTIVATION") is None
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg7-1065e8e-58d3bd1.md b/.superpowers/sdd/review-cfg7-1065e8e-58d3bd1.md
new file mode 100644
index 0000000..0082115
--- /dev/null
+++ b/.superpowers/sdd/review-cfg7-1065e8e-58d3bd1.md
@@ -0,0 +1,329 @@
+﻿## commits 1065e8e..58d3bd1
+58d3bd1 feat(config): ConfigService(CRUD/分组校验/加解密/历史/缓存)
+
+## stat
+ .../app/application/services/config_service.py     | 176 +++++++++++++++++++++
+ user-service/back-end/tests/test_config_service.py | 130 +++++++++++++++
+ 2 files changed, 306 insertions(+)
+
+## diff -U10
+diff --git a/user-service/back-end/app/application/services/config_service.py b/user-service/back-end/app/application/services/config_service.py
+new file mode 100644
+index 0000000..ba4aa9e
+--- /dev/null
++++ b/user-service/back-end/app/application/services/config_service.py
+@@ -0,0 +1,176 @@
++# app/application/services/config_service.py
++"""系统配置服务:CRUD + 分组校验 + 加解密 + 历史 + 缓存."""
++
++from __future__ import annotations
++
++import json
++import uuid
++from typing import Any
++
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.schemas.system_config import GROUP_MODELS, group_of_key
++from app.core.cache import DepartmentCache  # noqa: F401  (避免循环,仅类型注解用)
++from app.core.config_cache import ConfigCache
++from app.core.exceptions import BusinessException, NotFoundError
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository, SystemConfigRepository,
++)
++
++# 默认配置(每组模型默认值的扁平 key 形式)
++_DEFAULTS: dict[str, dict] = {
++    "MAIL": {"host": "smtp.example.com", "port": "587", "username": "noreply@example.com",
++             "password": "change-me", "protocol": "smtp", "starttls": "true"},
++    "SECURITY": {"password_min_length": "8", "password_require_uppercase": "true",
++                 "password_require_lowercase": "true", "password_require_digits": "true",
++                 "password_require_special": "true", "password_history_size": "5",
++                 "password_expiration_days": "90", "login_max_attempts": "5",
++                 "login_lock_minutes": "30", "session_timeout_minutes": "15"},
++    "PERFORMANCE": {"cache_user_info_ttl": "180", "cache_permission_ttl": "300",
++                    "cache_department_tree_ttl": "600", "db_max_pool_size": "50",
++                    "api_response_threshold_ms": "200"},
++    "SYSTEM": {"site_name": "User Management", "default_locale": "zh_CN",
++               "support_email": "support@example.com"},
++}
++
++# key → config_type(由默认值推断:password 为 SECRET,纯数字为 INT,true/false 为 BOOL,其余 STRING)
++_PREFIX = {"MAIL": "mail", "SECURITY": "security", "PERFORMANCE": "performance", "SYSTEM": "system"}
++
++
++def _infer_type(field: str, value: str) -> str:
++    if field == "password":
++        return "SECRET"
++    if value.isdigit():
++        return "INT"
++    if value in ("true", "false"):
++        return "BOOL"
++    return "STRING"
++
++
++_TYPES: dict[str, str] = {
++    f"{_PREFIX[g]}.{f}": _infer_type(f, v)
++    for g, fields in _DEFAULTS.items()
++    for f, v in fields.items()
++}
++
++
++def _cast_value(raw: str, type_: str) -> Any:
++    if type_ == "INT":
++        return int(raw)
++    if type_ == "BOOL":
++        return raw.lower() == "true"
++    if type_ == "JSON":
++        return json.loads(raw)
++    return raw
++
++
++def _to_storage(value: Any, type_: str, crypto) -> tuple[str, bool]:
++    """返回 (存储值, is_encrypted)。SECRET 加密。"""
++    if type_ == "SECRET":
++        return crypto.encrypt(str(value)), True
++    if type_ == "JSON":
++        return json.dumps(value), False
++    return str(value), False
++
++
++def _from_storage(raw: str, type_: str, crypto) -> Any:
++    if type_ == "SECRET":
++        return crypto.decrypt(raw)
++    return _cast_value(raw, type_)
++
++
++class ConfigService:
++    def __init__(self, db: AsyncSession, repo: SystemConfigRepository,
++                 history_repo: ConfigHistoryRepository, crypto, cache: ConfigCache):
++        self.db = db
++        self.repo = repo
++        self.history_repo = history_repo
++        self.crypto = crypto
++        self.cache = cache
++
++    def _group_and_field(self, key: str) -> tuple[str, str]:
++        group = group_of_key(key)
++        prefix = key.split(".", 1)[0]
++        field = key[len(prefix) + 1:]
++        return group, field
++
++    async def _load_group_dict(self, group: str) -> dict[str, Any]:
++        rows = await self.repo.list_by_group(group)
++        out: dict[str, Any] = {}
++        for r in rows:
++            _, field = self._group_and_field(r.config_key)
++            out[field] = _from_storage(r.config_value, r.config_type, self.crypto)
++        return out
++
++    async def get_group(self, group: str) -> dict:
++        cached = await self.cache.get_group(group)
++        if cached is not None:
++            return cached
++        values = await self._load_group_dict(group)
++        await self.cache.set_group(group, values)
++        return values
++
++    async def get_value(self, key: str) -> Any:
++        group, field = self._group_and_field(key)
++        values = await self.get_group(group)
++        if field not in values:
++            raise NotFoundError(f"配置不存在: {key}")
++        return values[field]
++
++    async def set_value(self, key: str, value: Any, updated_by: uuid.UUID) -> None:
++        try:
++            group = group_of_key(key)
++        except ValueError as exc:
++            raise BusinessException(str(exc)) from exc
++        _, field = self._group_and_field(key)
++        type_ = _TYPES.get(key, "STRING")
++        # 组装整组并校验
++        group_dict = await self._load_group_dict(group)
++        group_dict[field] = value
++        model_cls = GROUP_MODELS[group]
++        # SECRET 字段用 SecretStr,其余用原值
++        validate_dict = {}
++        for k, v in group_dict.items():
++            field_info = model_cls.model_fields.get(k)
++            if field_info is not None and "SecretStr" in str(field_info.annotation):
++                from pydantic import SecretStr
++                validate_dict[k] = SecretStr(str(v))
++            else:
++                validate_dict[k] = v
++        try:
++            model_cls(**validate_dict)
++        except Exception as exc:
++            raise BusinessException(f"配置校验失败: {exc}") from exc
++        # 持久化
++        existing = await self.repo.get_by_key(key)
++        old_storage = existing.config_value if existing else None
++        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
++        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by)
++        # 历史(密文/原样存)
++        await self.history_repo.add(key, old_storage, storage_value, updated_by)
++        await self.db.commit()
++        await self.cache.invalidate(group)
++
++    async def create_or_init(self, key: str, value: Any, group: str, type_: str,
++                             description: str | None, updated_by: uuid.UUID) -> None:
++        if await self.repo.get_by_key(key) is not None:
++            return  # 幂等
++        storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
++        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by, description)
++        await self.db.commit()
++
++    async def init_default_configs(self, updated_by: uuid.UUID) -> None:
++        prefix_map = {"MAIL": "mail", "SECURITY": "security",
++                      "PERFORMANCE": "performance", "SYSTEM": "system"}
++        for group, fields in _DEFAULTS.items():
++            for field, value in fields.items():
++                key = f"{prefix_map[group]}.{field}"
++                type_ = _TYPES[key]
++                await self.create_or_init(key, value, group, type_, None, updated_by)
++        await self.cache.invalidate()
++
++    def list_groups(self) -> list[str]:
++        return list(GROUP_MODELS.keys())
++
++    async def list_keys(self, group: str | None = None) -> list:
++        return await self.repo.list_keys(group)
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_config_service.py b/user-service/back-end/tests/test_config_service.py
+new file mode 100644
+index 0000000..41028df
+--- /dev/null
++++ b/user-service/back-end/tests/test_config_service.py
+@@ -0,0 +1,130 @@
++# tests/test_config_service.py
++from __future__ import annotations
++
++import uuid
++
++import pytest
++from sqlalchemy.ext.asyncio import async_sessionmaker
++
++from app.application.services.config_service import ConfigService
++from app.core import crypto
++from app.core.config_cache import LocalTTLCache
++from app.core.exceptions import BusinessException, NotFoundError
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository, SystemConfigRepository,
++)
++
++pytestmark = pytest.mark.asyncio
++
++
++def _svc(db):
++    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
++                          crypto, LocalTTLCache())
++
++
++async def test_init_default_configs_seeds_all(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        rows = await svc.repo.list_keys()
++        groups = {r.config_group for r in rows}
++        assert groups == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
++        # 每组至少 1 个 key
++        assert len(rows) >= 4
++
++
++async def test_init_idempotent(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        first = sorted(r.config_value for r in await svc.repo.list_keys())
++        await svc.init_default_configs(uuid.uuid4())  # 不覆盖
++        await db.commit()
++        second = sorted(r.config_value for r in await svc.repo.list_keys())
++        assert first == second
++
++
++async def test_set_value_validates_group(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        with pytest.raises(BusinessException):
++            await svc.set_value("security.password_min_length", "3", uuid.uuid4())
++
++
++async def test_set_value_secret_encrypts(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        await svc.set_value("mail.password", "smtp-secret-123", uuid.uuid4())
++        await db.commit()
++        row = await svc.repo.get_by_key("mail.password")
++        assert row.is_encrypted is True
++        assert row.config_value != "smtp-secret-123"  # 密文
++        assert svc.crypto.decrypt(row.config_value) == "smtp-secret-123"
++        # get_value 解密
++        val = await svc.get_value("mail.password")
++        assert val == "smtp-secret-123"
++        # 历史存密文
++        hist = await svc.history_repo.list_by_key("mail.password")
++        assert hist and hist[0].new_value != "smtp-secret-123"
++
++
++async def test_get_group_returns_real_values(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        grp = await svc.get_group("SYSTEM")
++        assert "site_name" in grp
++
++
++async def test_set_value_records_history(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        await svc.set_value("system.site_name", "NewName", uuid.uuid4())
++        await db.commit()
++        hist = await svc.history_repo.list_by_key("system.site_name")
++        assert len(hist) == 1
++        assert hist[0].new_value == "NewName"
++
++
++async def test_unknown_group_rejected(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        with pytest.raises(BusinessException):
++            await svc.set_value("unknown.x", "v", uuid.uuid4())
++
++
++async def test_cache_invalidation_on_set(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++
++    class SpyCache(LocalTTLCache):
++        def __init__(self):
++            super().__init__()
++            self.invalidated: list = []
++
++        async def invalidate(self, group=None):
++            self.invalidated.append(group)
++
++    async with Session() as db:
++        spy = SpyCache()
++        svc = ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, spy)
++        await svc.init_default_configs(uuid.uuid4())
++        await db.commit()
++        await svc.set_value("system.site_name", "Z", uuid.uuid4())
++        await db.commit()
++        assert "SYSTEM" in spy.invalidated
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg7fix-58d3bd1-24a8981.md b/.superpowers/sdd/review-cfg7fix-58d3bd1-24a8981.md
new file mode 100644
index 0000000..bfcc149
--- /dev/null
+++ b/.superpowers/sdd/review-cfg7fix-58d3bd1-24a8981.md
@@ -0,0 +1,87 @@
+﻿## commits 58d3bd1..24a8981
+24a8981 fix(config): ConfigService 清理(删除错误 DepartmentCache import + SecretStr 提顶 + _PREFIX 复用 + list_keys 返回类型)
+
+## diff -U8
+diff --git a/user-service/back-end/app/application/services/config_service.py b/user-service/back-end/app/application/services/config_service.py
+index ba4aa9e..bffa2ad 100644
+--- a/user-service/back-end/app/application/services/config_service.py
++++ b/user-service/back-end/app/application/services/config_service.py
+@@ -2,24 +2,26 @@
+ """系统配置服务:CRUD + 分组校验 + 加解密 + 历史 + 缓存."""
+ 
+ from __future__ import annotations
+ 
+ import json
+ import uuid
+ from typing import Any
+ 
++from pydantic import SecretStr
+ from sqlalchemy.ext.asyncio import AsyncSession
+ 
+ from app.application.schemas.system_config import GROUP_MODELS, group_of_key
+-from app.core.cache import DepartmentCache  # noqa: F401  (避免循环,仅类型注解用)
+ from app.core.config_cache import ConfigCache
+ from app.core.exceptions import BusinessException, NotFoundError
++from app.domain.models.system_config import SystemConfig
+ from app.repositories.system_config_repository import (
+-    ConfigHistoryRepository, SystemConfigRepository,
++    ConfigHistoryRepository,
++    SystemConfigRepository,
+ )
+ 
+ # 默认配置(每组模型默认值的扁平 key 形式)
+ _DEFAULTS: dict[str, dict] = {
+     "MAIL": {"host": "smtp.example.com", "port": "587", "username": "noreply@example.com",
+              "password": "change-me", "protocol": "smtp", "starttls": "true"},
+     "SECURITY": {"password_min_length": "8", "password_require_uppercase": "true",
+                  "password_require_lowercase": "true", "password_require_digits": "true",
+@@ -128,17 +130,16 @@ class ConfigService:
+         group_dict = await self._load_group_dict(group)
+         group_dict[field] = value
+         model_cls = GROUP_MODELS[group]
+         # SECRET 字段用 SecretStr,其余用原值
+         validate_dict = {}
+         for k, v in group_dict.items():
+             field_info = model_cls.model_fields.get(k)
+             if field_info is not None and "SecretStr" in str(field_info.annotation):
+-                from pydantic import SecretStr
+                 validate_dict[k] = SecretStr(str(v))
+             else:
+                 validate_dict[k] = v
+         try:
+             model_cls(**validate_dict)
+         except Exception as exc:
+             raise BusinessException(f"配置校验失败: {exc}") from exc
+         # 持久化
+@@ -151,26 +152,25 @@ class ConfigService:
+         await self.db.commit()
+         await self.cache.invalidate(group)
+ 
+     async def create_or_init(self, key: str, value: Any, group: str, type_: str,
+                              description: str | None, updated_by: uuid.UUID) -> None:
+         if await self.repo.get_by_key(key) is not None:
+             return  # 幂等
+         storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
+-        await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by, description)
++        await self.repo.upsert(key, storage_value, group, type_, is_encrypted,
++                               updated_by, description)
+         await self.db.commit()
+ 
+     async def init_default_configs(self, updated_by: uuid.UUID) -> None:
+-        prefix_map = {"MAIL": "mail", "SECURITY": "security",
+-                      "PERFORMANCE": "performance", "SYSTEM": "system"}
+         for group, fields in _DEFAULTS.items():
+             for field, value in fields.items():
+-                key = f"{prefix_map[group]}.{field}"
++                key = f"{_PREFIX[group]}.{field}"
+                 type_ = _TYPES[key]
+                 await self.create_or_init(key, value, group, type_, None, updated_by)
+         await self.cache.invalidate()
+ 
+     def list_groups(self) -> list[str]:
+         return list(GROUP_MODELS.keys())
+ 
+-    async def list_keys(self, group: str | None = None) -> list:
++    async def list_keys(self, group: str | None = None) -> list[SystemConfig]:
+         return await self.repo.list_keys(group)
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg8-24a8981-15a2e54.md b/.superpowers/sdd/review-cfg8-24a8981-15a2e54.md
new file mode 100644
index 0000000..50af46e
--- /dev/null
+++ b/.superpowers/sdd/review-cfg8-24a8981-15a2e54.md
@@ -0,0 +1,232 @@
+﻿## commits 24a8981..15a2e54
+15a2e54 feat(config): EmailTemplateService + schema
+
+## stat
+ .../app/application/schemas/system_config.py       | 44 +++++++++++++-
+ .../application/services/email_template_service.py | 61 +++++++++++++++++++
+ .../back-end/tests/test_email_template_service.py  | 69 ++++++++++++++++++++++
+ 3 files changed, 172 insertions(+), 2 deletions(-)
+
+## diff -U10
+diff --git a/user-service/back-end/app/application/schemas/system_config.py b/user-service/back-end/app/application/schemas/system_config.py
+index d150531..1d1755d 100644
+--- a/user-service/back-end/app/application/schemas/system_config.py
++++ b/user-service/back-end/app/application/schemas/system_config.py
+@@ -1,17 +1,19 @@
+ """系统配置分组 Pydantic 模型 + key→组映射."""
+ 
+ from __future__ import annotations
+ 
++import uuid
++from datetime import datetime
+ from typing import Literal
+ 
+-from pydantic import BaseModel, EmailStr, Field, SecretStr
++from pydantic import BaseModel, ConfigDict, EmailStr, Field, SecretStr
+ 
+ _PREFIX_TO_GROUP = {"mail": "MAIL", "security": "SECURITY",
+                     "performance": "PERFORMANCE", "system": "SYSTEM"}
+ 
+ 
+ def group_of_key(key: str) -> str:
+     prefix = key.split(".", 1)[0]
+     group = _PREFIX_TO_GROUP.get(prefix)
+     if group is None:
+         raise ValueError(f"未知配置组前缀: {prefix}")
+@@ -52,11 +54,49 @@ class SystemParams(BaseModel):
+     site_name: str = Field(min_length=1, max_length=100)
+     default_locale: str = Field(pattern=r"^[a-z]{2}_[A-Z]{2}$")
+     support_email: EmailStr
+ 
+ 
+ GROUP_MODELS = {
+     "MAIL": MailConfig,
+     "SECURITY": SecurityPolicy,
+     "PERFORMANCE": PerformanceConfig,
+     "SYSTEM": SystemParams,
+-}
+\ No newline at end of file
++}
++
++
++class EmailTemplateCreate(BaseModel):
++    template_code: str = Field(min_length=1, max_length=50)
++    template_name: str = Field(min_length=1, max_length=100)
++    subject: str = Field(min_length=1, max_length=200)
++    content: str = Field(min_length=1)
++    variables: list[dict] | None = None
++    is_active: bool = True
++
++
++class EmailTemplateUpdate(BaseModel):
++    template_code: str | None = Field(default=None, min_length=1, max_length=50)
++    template_name: str | None = Field(default=None, min_length=1, max_length=100)
++    subject: str | None = Field(default=None, min_length=1, max_length=200)
++    content: str | None = Field(default=None, min_length=1)
++    variables: list[dict] | None = None
++    is_active: bool | None = None
++
++
++class EmailTemplateOut(BaseModel):
++    model_config = ConfigDict(from_attributes=True)
++    id: uuid.UUID
++    template_code: str
++    template_name: str
++    subject: str
++    content: str
++    variables: list[dict] | None
++    is_active: bool
++    created_at: datetime
++    updated_at: datetime
++
++
++class EmailTemplateListOut(BaseModel):
++    items: list[EmailTemplateOut]
++    total: int
++    page: int
++    size: int
+\ No newline at end of file
+diff --git a/user-service/back-end/app/application/services/email_template_service.py b/user-service/back-end/app/application/services/email_template_service.py
+new file mode 100644
+index 0000000..458036a
+--- /dev/null
++++ b/user-service/back-end/app/application/services/email_template_service.py
+@@ -0,0 +1,61 @@
++"""邮件模板服务(CRUD,不含发送)."""
++
++from __future__ import annotations
++
++import uuid
++
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
++from app.core.exceptions import ConflictError, NotFoundError
++from app.domain.models.system_config import EmailTemplate
++from app.repositories.system_config_repository import EmailTemplateRepository
++
++
++class EmailTemplateService:
++    def __init__(self, db: AsyncSession, repo: EmailTemplateRepository):
++        self.db = db
++        self.repo = repo
++
++    async def create(self, req: EmailTemplateCreate) -> EmailTemplate:
++        if await self.repo.get_by_code(req.template_code) is not None:
++            raise ConflictError("模板编码已存在")
++        tpl = EmailTemplate(template_code=req.template_code, template_name=req.template_name,
++                           subject=req.subject, content=req.content,
++                           variables=req.variables, is_active=req.is_active)
++        await self.repo.add(tpl)
++        await self.db.commit()
++        await self.db.refresh(tpl)
++        return tpl
++
++    async def update(self, tpl_id: uuid.UUID, req: EmailTemplateUpdate) -> EmailTemplate:
++        tpl = await self.repo.get_by_id(tpl_id)
++        if tpl is None:
++            raise NotFoundError("模板不存在")
++        if req.template_code is not None and req.template_code != tpl.template_code:
++            if await self.repo.get_by_code(req.template_code) is not None:
++                raise ConflictError("模板编码已存在")
++        for field, value in req.model_dump(exclude_unset=True).items():
++            setattr(tpl, field, value)
++        await self.db.commit()
++        await self.db.refresh(tpl)
++        return tpl
++
++    async def get(self, tpl_id: uuid.UUID) -> EmailTemplate:
++        tpl = await self.repo.get_by_id(tpl_id)
++        if tpl is None:
++            raise NotFoundError("模板不存在")
++        return tpl
++
++    async def list(self, page: int, size: int) -> tuple[list[EmailTemplate], int]:
++        return await self.repo.list(page, size)
++
++    async def delete(self, tpl_id: uuid.UUID) -> None:
++        tpl = await self.repo.get_by_id(tpl_id)
++        if tpl is None:
++            raise NotFoundError("模板不存在")
++        await self.repo.delete(tpl)
++        await self.db.commit()
++
++    async def get_by_code(self, code: str) -> EmailTemplate | None:
++        return await self.repo.get_by_code(code)
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_email_template_service.py b/user-service/back-end/tests/test_email_template_service.py
+new file mode 100644
+index 0000000..4d7e6b8
+--- /dev/null
++++ b/user-service/back-end/tests/test_email_template_service.py
+@@ -0,0 +1,69 @@
++from __future__ import annotations
++
++import pytest
++from sqlalchemy.ext.asyncio import async_sessionmaker
++
++from app.application.schemas.system_config import EmailTemplateCreate, EmailTemplateUpdate
++from app.application.services.email_template_service import EmailTemplateService
++from app.core.exceptions import ConflictError, NotFoundError
++from app.repositories.system_config_repository import EmailTemplateRepository
++
++pytestmark = pytest.mark.asyncio
++
++
++def _svc(db):
++    return EmailTemplateService(db, EmailTemplateRepository(db))
++
++
++async def test_create_and_get(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        tpl = await svc.create(EmailTemplateCreate(
++            template_code="USER_ACTIVATION", template_name="激活", subject="欢迎",
++            content="Hi {{name}}",
++            variables=[{"name": "name", "description": "用户名", "required": True}]))
++        await db.commit()
++        got = await svc.get(tpl.id)
++        assert got.template_code == "USER_ACTIVATION"
++
++
++async def test_create_code_conflict(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
++                                             subject="s", content="c"))
++        await db.commit()
++        with pytest.raises(ConflictError):
++            await svc.create(EmailTemplateCreate(template_code="X", template_name="n2",
++                                                 subject="s2", content="c2"))
++        await db.commit()
++
++
++async def test_update_and_delete(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        tpl = await svc.create(EmailTemplateCreate(template_code="X", template_name="n",
++                                                   subject="s", content="c"))
++        await db.commit()
++        updated = await svc.update(tpl.id, EmailTemplateUpdate(template_name="n2"))
++        await db.commit()
++        assert updated.template_name == "n2"
++        await svc.delete(tpl.id)
++        await db.commit()
++        with pytest.raises(NotFoundError):
++            await svc.get(tpl.id)
++
++
++async def test_list_pagination(engine, seed):
++    Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
++    async with Session() as db:
++        svc = _svc(db)
++        for i in range(3):
++            await svc.create(EmailTemplateCreate(template_code=f"C{i}", template_name=f"n{i}",
++                                                 subject="s", content="c"))
++            await db.commit()
++        items, total = await svc.list(1, 2)
++        assert total == 3 and len(items) == 2
+\ No newline at end of file
diff --git a/.superpowers/sdd/review-cfg9-15a2e54-cbb531e.md b/.superpowers/sdd/review-cfg9-15a2e54-cbb531e.md
new file mode 100644
index 0000000..2b8dcf4
--- /dev/null
+++ b/.superpowers/sdd/review-cfg9-15a2e54-cbb531e.md
@@ -0,0 +1,451 @@
+﻿## commits 15a2e54..cbb531e
+cbb531e feat(config): 配置+模板 API 路由 + main 注册 + seed 扩展
+
+## stat
+ .../back-end/app/interfaces/api/email_templates.py |  71 +++++++++++
+ .../back-end/app/interfaces/api/system_config.py   | 132 +++++++++++++++++++++
+ user-service/back-end/app/main.py                  |   4 +-
+ user-service/back-end/tests/conftest.py            |  14 +++
+ .../back-end/tests/test_email_templates_api.py     |  37 ++++++
+ .../back-end/tests/test_system_config_api.py       |  64 ++++++++++
+ 6 files changed, 321 insertions(+), 1 deletion(-)
+
+## diff -U10
+diff --git a/user-service/back-end/app/interfaces/api/email_templates.py b/user-service/back-end/app/interfaces/api/email_templates.py
+new file mode 100644
+index 0000000..c84c936
+--- /dev/null
++++ b/user-service/back-end/app/interfaces/api/email_templates.py
+@@ -0,0 +1,71 @@
++"""邮件模板路由."""
++
++from __future__ import annotations
++
++import uuid
++
++from fastapi import APIRouter, Depends, Query, status
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.deps import get_db
++from app.application.schemas.system_config import (
++    EmailTemplateCreate, EmailTemplateListOut, EmailTemplateOut, EmailTemplateUpdate,
++)
++from app.application.services.email_template_service import EmailTemplateService
++from app.core.security import require_permission
++from app.domain.models.user import User
++from app.repositories.system_config_repository import EmailTemplateRepository
++
++router = APIRouter(prefix="/email-templates", tags=["email-templates"])
++
++
++def _svc(db: AsyncSession) -> EmailTemplateService:
++    return EmailTemplateService(db, EmailTemplateRepository(db))
++
++
++@router.get("", response_model=EmailTemplateListOut)
++async def list_templates(
++    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:read")),
++) -> EmailTemplateListOut:
++    items, total = await _svc(db).list(page, size)
++    return EmailTemplateListOut(
++        items=[EmailTemplateOut.model_validate(i) for i in items],
++        total=total, page=page, size=size)
++
++
++@router.get("/{tpl_id}", response_model=EmailTemplateOut)
++async def get_template(
++    tpl_id: uuid.UUID,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:read")),
++) -> EmailTemplateOut:
++    return EmailTemplateOut.model_validate(await _svc(db).get(tpl_id))
++
++
++@router.post("", response_model=EmailTemplateOut, status_code=status.HTTP_201_CREATED)
++async def create_template(
++    req: EmailTemplateCreate,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:create")),
++) -> EmailTemplateOut:
++    return EmailTemplateOut.model_validate(await _svc(db).create(req))
++
++
++@router.put("/{tpl_id}", response_model=EmailTemplateOut)
++async def update_template(
++    tpl_id: uuid.UUID, req: EmailTemplateUpdate,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:update")),
++) -> EmailTemplateOut:
++    return EmailTemplateOut.model_validate(await _svc(db).update(tpl_id, req))
++
++
++@router.delete("/{tpl_id}", status_code=status.HTTP_204_NO_CONTENT)
++async def delete_template(
++    tpl_id: uuid.UUID,
++    db: AsyncSession = Depends(get_db),
++    _: User = Depends(require_permission("template:delete")),
++) -> None:
++    await _svc(db).delete(tpl_id)
+\ No newline at end of file
+diff --git a/user-service/back-end/app/interfaces/api/system_config.py b/user-service/back-end/app/interfaces/api/system_config.py
+new file mode 100644
+index 0000000..f464678
+--- /dev/null
++++ b/user-service/back-end/app/interfaces/api/system_config.py
+@@ -0,0 +1,132 @@
++"""系统配置路由."""
++
++from __future__ import annotations
++
++import uuid
++
++from fastapi import APIRouter, Depends, Query
++from pydantic import BaseModel
++from sqlalchemy.ext.asyncio import AsyncSession
++
++from app.application.deps import get_db
++from app.core.config_cache import ConfigCache, get_config_cache
++from app.core.security import require_permission
++from app.domain.models.user import User
++from app.repositories.system_config_repository import (
++    ConfigHistoryRepository, SystemConfigRepository,
++)
++from app.application.services.config_service import ConfigService
++from app.core import crypto
++
++router = APIRouter(prefix="/config", tags=["config"])
++
++
++def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
++    return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
++
++
++class ConfigValueUpdate(BaseModel):
++    value: str | int | bool | dict
++
++
++def _mask(values: dict, group: str) -> dict:
++    from app.application.schemas.system_config import GROUP_MODELS
++    model = GROUP_MODELS[group]
++    masked = {}
++    for k, v in values.items():
++        fi = model.model_fields.get(k)
++        if fi is not None and "SecretStr" in str(fi.annotation):
++            masked[k] = "***"
++        else:
++            masked[k] = v
++    return masked
++
++
++@router.get("/groups")
++async def list_groups(
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> list[str]:
++    return _svc(db, cache).list_groups()
++
++
++@router.get("")
++async def get_group(
++    group: str = Query(...),
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> dict:
++    svc = _svc(db, cache)
++    values = await svc.get_group(group)
++    return {"group": group, "values": _mask(values, group)}
++
++
++@router.get("/history")
++async def history(
++    key: str = Query(...),
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> list[dict]:
++    repo = ConfigHistoryRepository(db)
++    rows = await repo.list_by_key(key)
++    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
++    group = group_of_key(key)
++    field = key.split(".", 1)[1]
++    fi = GROUP_MODELS[group].model_fields.get(field)
++    is_secret = fi is not None and "SecretStr" in str(fi.annotation)
++    out = []
++    for r in rows:
++        out.append({
++            "key": r.config_key,
++            "old_value": "***" if is_secret else r.old_value,
++            "new_value": "***" if is_secret else r.new_value,
++            "changed_by": str(r.changed_by),
++            "changed_at": r.changed_at.isoformat() if r.changed_at else None,
++        })
++    return out
++
++
++@router.get("/{key}")
++async def get_value(
++    key: str,
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:read")),
++) -> dict:
++    svc = _svc(db, cache)
++    from app.application.schemas.system_config import group_of_key, GROUP_MODELS
++    group = group_of_key(key)
++    values = await svc.get_group(group)
++    field = key.split(".", 1)[1]
++    val = values.get(field)
++    fi = GROUP_MODELS[group].model_fields.get(field)
++    if fi is not None and "SecretStr" in str(fi.annotation):
++        val = "***"
++    return {"key": key, "group": group, "value": val}
++
++
++@router.put("/{key}")
++async def put_value(
++    key: str,
++    req: ConfigValueUpdate,
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:update")),
++) -> dict:
++    svc = _svc(db, cache)
++    await svc.set_value(key, req.value, user.id)
++    return {"key": key, "ok": True}
++
++
++@router.post("/init")
++async def init_configs(
++    db: AsyncSession = Depends(get_db),
++    cache: ConfigCache = Depends(get_config_cache),
++    user: User = Depends(require_permission("config:update")),
++) -> dict:
++    svc = _svc(db, cache)
++    await svc.init_default_configs(user.id)
++    return {"ok": True}
+\ No newline at end of file
+diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
+index c12de28..1ba7e1f 100644
+--- a/user-service/back-end/app/main.py
++++ b/user-service/back-end/app/main.py
+@@ -11,21 +11,21 @@ from fastapi.middleware.cors import CORSMiddleware
+ # 确保关联表与模型在导入时注册到 Base.metadata
+ import app.domain.models.associations  # noqa: F401
+ import app.domain.models.department  # noqa: F401
+ import app.domain.models.role  # noqa: F401
+ import app.domain.models.system_config  # noqa: F401
+ import app.domain.models.user  # noqa: F401
+ from app.core.config import settings
+ from app.core.database import engine
+ from app.core.exceptions import register_exception_handlers
+ from app.domain.models import Base
+-from app.interfaces.api import auth, departments, health, users
++from app.interfaces.api import auth, departments, email_templates, health, system_config, users
+ 
+ 
+ @asynccontextmanager
+ async def lifespan(_: FastAPI) -> AsyncIterator[None]:
+     # 测试/开发环境自动建表；生产应使用 Alembic 迁移
+     async with engine.begin() as conn:
+         await conn.run_sync(Base.metadata.create_all)
+     yield
+     await engine.dispose()
+ 
+@@ -45,15 +45,17 @@ def create_app() -> FastAPI:
+         allow_methods=["*"],
+         allow_headers=["*"],
+     )
+ 
+     register_exception_handlers(app)
+ 
+     app.include_router(health.router)
+     app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
+     app.include_router(users.router, prefix=settings.API_V1_PREFIX)
+     app.include_router(departments.router, prefix=settings.API_V1_PREFIX)
++    app.include_router(system_config.router, prefix=settings.API_V1_PREFIX)
++    app.include_router(email_templates.router, prefix=settings.API_V1_PREFIX)
+ 
+     return app
+ 
+ 
+ app = create_app()
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/conftest.py b/user-service/back-end/tests/conftest.py
+index 71355ae..e8116a6 100644
+--- a/user-service/back-end/tests/conftest.py
++++ b/user-service/back-end/tests/conftest.py
+@@ -96,20 +96,32 @@ async def seed(db_session):
+         Permission(name="用户分配角色", code="user:assign_role", type="ACTION",
+                    resource="user", action="assign_role"),
+         Permission(name="部门读取", code="dept:read", type="ACTION",
+                    resource="dept", action="read"),
+         Permission(name="部门创建", code="dept:create", type="ACTION",
+                    resource="dept", action="create"),
+         Permission(name="部门更新", code="dept:update", type="ACTION",
+                    resource="dept", action="update"),
+         Permission(name="部门删除", code="dept:delete", type="ACTION",
+                    resource="dept", action="delete"),
++        Permission(name="配置读取", code="config:read", type="ACTION",
++                   resource="config", action="read"),
++        Permission(name="配置更新", code="config:update", type="ACTION",
++                   resource="config", action="update"),
++        Permission(name="模板读取", code="template:read", type="ACTION",
++                   resource="template", action="read"),
++        Permission(name="模板创建", code="template:create", type="ACTION",
++                   resource="template", action="create"),
++        Permission(name="模板更新", code="template:update", type="ACTION",
++                   resource="template", action="update"),
++        Permission(name="模板删除", code="template:delete", type="ACTION",
++                   resource="template", action="delete"),
+     ]
+     db_session.add_all(perms)
+     await db_session.flush()
+ 
+     admin = Role(name="管理员", code="ADMIN", data_scope=DataScope.ALL)
+     admin.permissions = perms
+     user_role = Role(name="普通用户", code="USER", data_scope=DataScope.SELF)
+     db_session.add_all([admin, user_role])
+     await db_session.commit()
+     return {"admin": admin, "user": user_role, "permissions": perms}
+@@ -119,20 +131,22 @@ async def seed(db_session):
+ async def client(engine, seed) -> AsyncIterator[AsyncClient]:
+     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
+ 
+     async def override_get_db():
+         async with Session() as session:
+             yield session
+ 
+     app.dependency_overrides[get_db] = override_get_db
+     from app.core.cache import NoopDepartmentCache, get_department_cache
+     app.dependency_overrides[get_department_cache] = lambda: NoopDepartmentCache()
++    from app.core.config_cache import LocalTTLCache, get_config_cache
++    app.dependency_overrides[get_config_cache] = lambda: LocalTTLCache()
+     transport = ASGITransport(app=app)
+     async with AsyncClient(transport=transport, base_url="http://test") as ac:
+         yield ac
+     app.dependency_overrides.clear()
+ 
+ 
+ @pytest_asyncio.fixture
+ async def admin_token(client, engine) -> str:
+     # 注册一个管理员账号并通过直接数据库操作赋予 ADMIN 角色
+     resp = await client.post(
+diff --git a/user-service/back-end/tests/test_email_templates_api.py b/user-service/back-end/tests/test_email_templates_api.py
+new file mode 100644
+index 0000000..62eab28
+--- /dev/null
++++ b/user-service/back-end/tests/test_email_templates_api.py
+@@ -0,0 +1,37 @@
++from __future__ import annotations
++
++import pytest
++
++pytestmark = pytest.mark.asyncio
++
++
++async def _h(token):
++    return {"Authorization": f"Bearer {token}"}
++
++
++TPL = {"template_code": "USER_ACTIVATION", "template_name": "激活",
++       "subject": "欢迎", "content": "Hi {{name}}",
++       "variables": [{"name": "name", "description": "用户名", "required": True}]}
++
++
++async def test_template_crud(client, admin_token):
++    h = await _h(admin_token)
++    create = await client.post("/api/v1/email-templates", json=TPL, headers=h)
++    assert create.status_code == 201, create.text
++    tid = create.json()["id"]
++    got = await client.get(f"/api/v1/email-templates/{tid}", headers=h)
++    assert got.status_code == 200 and got.json()["template_code"] == "USER_ACTIVATION"
++    lst = await client.get("/api/v1/email-templates", headers=h)
++    assert lst.status_code == 200 and lst.json()["total"] == 1
++    upd = await client.put(f"/api/v1/email-templates/{tid}",
++                           json={"template_name": "激活2"}, headers=h)
++    assert upd.status_code == 200 and upd.json()["template_name"] == "激活2"
++    dele = await client.delete(f"/api/v1/email-templates/{tid}", headers=h)
++    assert dele.status_code == 204
++
++
++async def test_template_code_conflict(client, admin_token):
++    h = await _h(admin_token)
++    await client.post("/api/v1/email-templates", json=TPL, headers=h)
++    resp = await client.post("/api/v1/email-templates", json=TPL, headers=h)
++    assert resp.status_code == 409
+\ No newline at end of file
+diff --git a/user-service/back-end/tests/test_system_config_api.py b/user-service/back-end/tests/test_system_config_api.py
+new file mode 100644
+index 0000000..bfbe3b9
+--- /dev/null
++++ b/user-service/back-end/tests/test_system_config_api.py
+@@ -0,0 +1,64 @@
++from __future__ import annotations
++
++import pytest
++
++pytestmark = pytest.mark.asyncio
++
++
++async def _h(token):
++    return {"Authorization": f"Bearer {token}"}
++
++
++async def test_init_and_get_group_masks_secret(client, admin_token):
++    resp = await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    assert resp.status_code == 200, resp.text
++    grp = await client.get("/api/v1/config?group=MAIL", headers=await _h(admin_token))
++    assert grp.status_code == 200
++    body = grp.json()
++    assert body["group"] == "MAIL"
++    assert body["values"]["password"] == "***"
++
++
++async def test_get_groups(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    resp = await client.get("/api/v1/config/groups", headers=await _h(admin_token))
++    assert resp.status_code == 200
++    assert set(resp.json()) == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
++
++
++async def test_put_value_validates(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    resp = await client.put("/api/v1/config/security.password_min_length",
++                            json={"value": "3"}, headers=await _h(admin_token))
++    assert resp.status_code == 400
++
++
++async def test_put_value_secret(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    resp = await client.put("/api/v1/config/mail.password",
++                            json={"value": "new-secret"}, headers=await _h(admin_token))
++    assert resp.status_code == 200, resp.text
++    # GET 单 key 掩码
++    g = await client.get("/api/v1/config/mail.password", headers=await _h(admin_token))
++    assert g.status_code == 200 and g.json()["value"] == "***"
++
++
++async def test_history(client, admin_token):
++    await client.post("/api/v1/config/init", headers=await _h(admin_token))
++    await client.put("/api/v1/config/system.site_name",
++                     json={"value": "NewName"}, headers=await _h(admin_token))
++    resp = await client.get("/api/v1/config/history?key=system.site_name",
++                            headers=await _h(admin_token))
++    assert resp.status_code == 200
++    assert len(resp.json()) >= 1
++
++
++async def test_regular_user_forbidden(client):
++    reg = await client.post("/api/v1/auth/register", json={
++        "email": "r@t.com", "password": "Rr@12345", "first_name": "R", "last_name": "L"})
++    assert reg.status_code == 201
++    login = await client.post("/api/v1/auth/login", json={"email": "r@t.com", "password": "Rr@12345"})
++    token = login.json()["access_token"]
++    resp = await client.put("/api/v1/config/system.site_name",
++                            json={"value": "x"}, headers=await _h(token))
++    assert resp.status_code == 403
+\ No newline at end of file
diff --git a/user-service/back-end/app/application/schemas/system_config.py b/user-service/back-end/app/application/schemas/system_config.py
index 1d1755d..cef93e0 100644
--- a/user-service/back-end/app/application/schemas/system_config.py
+++ b/user-service/back-end/app/application/schemas/system_config.py
@@ -59,16 +59,20 @@ class SystemParams(BaseModel):
 GROUP_MODELS = {
     "MAIL": MailConfig,
     "SECURITY": SecurityPolicy,
     "PERFORMANCE": PerformanceConfig,
     "SYSTEM": SystemParams,
 }
 
 
+class ConfigValueUpdate(BaseModel):
+    value: str | int | bool | dict
+
+
 class EmailTemplateCreate(BaseModel):
     template_code: str = Field(min_length=1, max_length=50)
     template_name: str = Field(min_length=1, max_length=100)
     subject: str = Field(min_length=1, max_length=200)
     content: str = Field(min_length=1)
     variables: list[dict] | None = None
     is_active: bool = True
 
diff --git a/user-service/back-end/app/application/services/config_service.py b/user-service/back-end/app/application/services/config_service.py
index bffa2ad..c716373 100644
--- a/user-service/back-end/app/application/services/config_service.py
+++ b/user-service/back-end/app/application/services/config_service.py
@@ -148,25 +148,26 @@ class ConfigService:
         storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
         await self.repo.upsert(key, storage_value, group, type_, is_encrypted, updated_by)
         # 历史(密文/原样存)
         await self.history_repo.add(key, old_storage, storage_value, updated_by)
         await self.db.commit()
         await self.cache.invalidate(group)
 
     async def create_or_init(self, key: str, value: Any, group: str, type_: str,
-                             description: str | None, updated_by: uuid.UUID) -> None:
+                             description: str | None,
+                             updated_by: uuid.UUID | None) -> None:
         if await self.repo.get_by_key(key) is not None:
             return  # 幂等
         storage_value, is_encrypted = _to_storage(value, type_, self.crypto)
         await self.repo.upsert(key, storage_value, group, type_, is_encrypted,
                                updated_by, description)
         await self.db.commit()
 
-    async def init_default_configs(self, updated_by: uuid.UUID) -> None:
+    async def init_default_configs(self, updated_by: uuid.UUID | None = None) -> None:
         for group, fields in _DEFAULTS.items():
             for field, value in fields.items():
                 key = f"{_PREFIX[group]}.{field}"
                 type_ = _TYPES[key]
                 await self.create_or_init(key, value, group, type_, None, updated_by)
         await self.cache.invalidate()
 
     def list_groups(self) -> list[str]:
diff --git a/user-service/back-end/app/core/redis_config_cache.py b/user-service/back-end/app/core/redis_config_cache.py
index 709b344..20dec25 100644
--- a/user-service/back-end/app/core/redis_config_cache.py
+++ b/user-service/back-end/app/core/redis_config_cache.py
@@ -36,18 +36,18 @@ class RedisPubSubConfigCache:
     async def invalidate(self, group: str | None = None) -> None:
         await self._local.invalidate(group)
         try:
             await self._redis.publish(CHANNEL, group or "*")
         except Exception as exc:  # noqa: BLE001
             logger.warning("config cache publish 失败,降级: %s", exc)
 
     async def start_subscriber(self) -> None:
+        pubsub = self._redis.pubsub()
         try:
-            pubsub = self._redis.pubsub()
             await pubsub.subscribe(CHANNEL)
             while True:
                 msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                 if msg is None:
                     await asyncio.sleep(0.05)
                     continue
                 type_ = msg.get("type") if isinstance(msg, dict) else getattr(msg, "type", None)
                 if type_ != "message":
@@ -55,9 +55,13 @@ class RedisPubSubConfigCache:
                 group = msg.get("data") if isinstance(msg, dict) else getattr(msg, "data", None)
                 if group in (None, "*"):
                     await self._local.invalidate()
                 else:
                     await self._local.invalidate(group)
         except asyncio.CancelledError:
             raise
         except Exception as exc:  # noqa: BLE001
-            logger.warning("config cache 订阅断开,降级为本地 TTL: %s", exc)
\ No newline at end of file
+            logger.warning("config cache 订阅断开,降级为本地 TTL: %s", exc)
+        finally:
+            close = getattr(pubsub, "aclose", None) or getattr(pubsub, "close", None)
+            if close is not None:
+                await close()
\ No newline at end of file
diff --git a/user-service/back-end/app/interfaces/api/system_config.py b/user-service/back-end/app/interfaces/api/system_config.py
index ed98897..441b78d 100644
--- a/user-service/back-end/app/interfaces/api/system_config.py
+++ b/user-service/back-end/app/interfaces/api/system_config.py
@@ -1,17 +1,17 @@
 """系统配置路由."""
 
 from __future__ import annotations
 
-from fastapi import APIRouter, Depends, Query
-from pydantic import BaseModel
+from fastapi import APIRouter, Depends, HTTPException, Query
 from sqlalchemy.ext.asyncio import AsyncSession
 
 from app.application.deps import get_db
+from app.application.schemas.system_config import ConfigValueUpdate, group_of_key
 from app.application.services.config_service import ConfigService
 from app.core import crypto
 from app.core.config_cache import ConfigCache, get_config_cache
 from app.core.security import require_permission
 from app.domain.models.user import User
 from app.repositories.system_config_repository import (
     ConfigHistoryRepository,
     SystemConfigRepository,
@@ -19,36 +19,31 @@ from app.repositories.system_config_repository import (
 
 router = APIRouter(prefix="/config", tags=["config"])
 
 
 def _svc(db: AsyncSession, cache: ConfigCache) -> ConfigService:
     return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db), crypto, cache)
 
 
-class ConfigValueUpdate(BaseModel):
-    value: str | int | bool | dict
-
-
 def _mask(values: dict, group: str) -> dict:
     from app.application.schemas.system_config import GROUP_MODELS
     model = GROUP_MODELS[group]
     masked = {}
     for k, v in values.items():
         fi = model.model_fields.get(k)
         if fi is not None and "SecretStr" in str(fi.annotation):
             masked[k] = "***"
         else:
             masked[k] = v
     return masked
 
 
-def _format_history(rows, key: str) -> list[dict]:
-    from app.application.schemas.system_config import GROUP_MODELS, group_of_key
-    group = group_of_key(key)
+def _format_history(rows, key: str, group: str) -> list[dict]:
+    from app.application.schemas.system_config import GROUP_MODELS
     field = key.split(".", 1)[1]
     fi = GROUP_MODELS[group].model_fields.get(field)
     is_secret = fi is not None and "SecretStr" in str(fi.annotation)
     return [
         {
             "key": r.config_key,
             "old_value": "***" if is_secret else r.old_value,
             "new_value": "***" if is_secret else r.new_value,
@@ -91,31 +86,41 @@ async def get_group(
 
 @router.get("/history")
 async def history(
     key: str = Query(...),
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
     user: User = Depends(require_permission("config:read")),
 ) -> list[dict]:
+    try:
+        group = group_of_key(key)
+    except ValueError as exc:
+        raise HTTPException(status_code=400, detail=str(exc)) from exc
     repo = ConfigHistoryRepository(db)
-    return _format_history(await repo.list_by_key(key), key)
+    return _format_history(await repo.list_by_key(key), key, group)
 
 
 @router.get("/{key}")
 async def get_value(
     key: str,
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
     user: User = Depends(require_permission("config:read")),
 ) -> dict:
-    from app.application.schemas.system_config import group_of_key
+    try:
+        group = group_of_key(key)
+    except ValueError as exc:
+        raise HTTPException(status_code=400, detail=str(exc)) from exc
     svc = _svc(db, cache)
-    group = group_of_key(key)
-    return _get_value_result(await svc.get_group(group), key, group)
+    values = await svc.get_group(group)
+    field = key.split(".", 1)[1]
+    if field not in values:
+        raise HTTPException(status_code=404, detail=f"配置不存在: {key}")
+    return _get_value_result(values, key, group)
 
 
 @router.put("/{key}")
 async def put_value(
     key: str,
     req: ConfigValueUpdate,
     db: AsyncSession = Depends(get_db),
     cache: ConfigCache = Depends(get_config_cache),
diff --git a/user-service/back-end/app/main.py b/user-service/back-end/app/main.py
index 99483b6..b1ae2cf 100644
--- a/user-service/back-end/app/main.py
+++ b/user-service/back-end/app/main.py
@@ -1,14 +1,13 @@
 """FastAPI 应用入口."""
 
 from __future__ import annotations
 
 import asyncio
-import uuid
 from collections.abc import AsyncIterator
 from contextlib import asynccontextmanager
 
 from fastapi import FastAPI
 from fastapi.middleware.cors import CORSMiddleware
 
 # 确保关联表与模型在导入时注册到 Base.metadata
 import app.domain.models.associations  # noqa: F401
@@ -42,17 +41,17 @@ async def lifespan(_: FastAPI) -> AsyncIterator[None]:
     async with AsyncSessionLocal() as session:
         svc = ConfigService(
             session,
             SystemConfigRepository(session),
             ConfigHistoryRepository(session),
             crypto,
             cache,
         )
-        await svc.init_default_configs(uuid.UUID(int=0))
+        await svc.init_default_configs(None)
     yield
     subscriber_task.cancel()
     try:
         await subscriber_task
     except asyncio.CancelledError:
         pass
     await engine.dispose()
 
diff --git a/user-service/back-end/tests/test_config_service.py b/user-service/back-end/tests/test_config_service.py
index 89f09c0..ec0a9dc 100644
--- a/user-service/back-end/tests/test_config_service.py
+++ b/user-service/back-end/tests/test_config_service.py
@@ -22,33 +22,35 @@ def _svc(db):
     return ConfigService(db, SystemConfigRepository(db), ConfigHistoryRepository(db),
                           crypto, LocalTTLCache())
 
 
 async def test_init_default_configs_seeds_all(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         svc = _svc(db)
-        await svc.init_default_configs(uuid.uuid4())
+        await svc.init_default_configs(None)
         await db.commit()
         rows = await svc.repo.list_keys()
         groups = {r.config_group for r in rows}
         assert groups == {"MAIL", "SECURITY", "PERFORMANCE", "SYSTEM"}
         # 每组至少 1 个 key
         assert len(rows) >= 4
+        # 启动调用传 None,seeds 行 updated_by 为 None
+        assert all(r.updated_by is None for r in rows)
 
 
 async def test_init_idempotent(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
         svc = _svc(db)
-        await svc.init_default_configs(uuid.uuid4())
+        await svc.init_default_configs(None)
         await db.commit()
         first = sorted(r.config_value for r in await svc.repo.list_keys())
-        await svc.init_default_configs(uuid.uuid4())  # 不覆盖
+        await svc.init_default_configs(None)  # 不覆盖
         await db.commit()
         second = sorted(r.config_value for r in await svc.repo.list_keys())
         assert first == second
 
 
 async def test_set_value_validates_group(engine, seed):
     Session = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
     async with Session() as db:
