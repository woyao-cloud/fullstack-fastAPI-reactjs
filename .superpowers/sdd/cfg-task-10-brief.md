## Task 10: lifespan 集成(订阅 task + init_default_configs)+ 全量回归 + 覆盖率 + ruff

**Files:**
- Modify: `app/main.py`(lifespan 启动期开订阅 task + init seed)
- Test: `tests/test_system_config_api.py` 已覆盖功能;本任务主要验证集成

**Interfaces:**
- Produces:lifespan 启动期 `asyncio.create_task(cache.start_subscriber())`(Redis 实现时)+ `init_default_configs(system user)` 幂等 seed;关闭期取消订阅 task。

- [ ] **Step 1: 修改 main.py lifespan**

```python
# app/main.py —— lifespan 内,在 create_all 后、yield 前追加
import asyncio
import uuid

from app.core.config_cache import get_config_cache
from app.application.services.config_service import ConfigService
from app.repositories.system_config_repository import (
    ConfigHistoryRepository, SystemConfigRepository,
)
from app.core.database import AsyncSessionLocal
from app.core import crypto

    # 配置缓存订阅(Redis 实现时;本地 no-op)
    cache = await get_config_cache()
    subscriber_task = asyncio.create_task(cache.start_subscriber())
    # 幂等初始化默认配置(用一个全零 UUID 作为系统操作人)
    async with AsyncSessionLocal() as session:
        svc = ConfigService(session, SystemConfigRepository(session),
                            ConfigHistoryRepository(session), crypto, cache)
        await svc.init_default_configs(uuid.UUID(int=0))
    yield
    subscriber_task.cancel()
    try:
        await subscriber_task
    except asyncio.CancelledError:
        pass
    await engine.dispose()
```
> 注意:保留原 `async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)` 在最前。`yield` 后的 `engine.dispose()` 原已有则不重复。

- [ ] **Step 2: 运行全量测试**

Run: `uv run pytest`
Expected: 全部 PASS(含原有部门/用户模块 + 新配置模块)。

- [ ] **Step 3: 覆盖率**

Run: `uv run pytest --cov=app --cov-report=term-missing`
Expected: TOTAL ≥85%;配置模块文件(`app.application.services.config_service`、`app.application.services.email_template_service`、`app.interfaces.api.system_config`、`app.interfaces.api.email_templates`、`app.core.crypto`、`app.core.config_cache`)≥85%。

- [ ] **Step 4: ruff**

Run: `uv run ruff check app tests`
Expected: 0 errors(沿用 `ignore=["B008"]`);若有未用 import 等,清理。

- [ ] **Step 5: 修复后再次运行至全绿**

- [ ] **Step 6: 提交**

```bash
git add app/main.py
git commit -m "feat(config): lifespan 集成订阅 task + 默认配置 seed;全量回归通过"
```

---

## Self-Review 结论

**Spec coverage**:
- §3 模块边界 → 各任务文件结构 ✓
- §4 数据模型 → Task 1 ✓
- §5 加密与分组校验 → Task 2、3、7 ✓
- §6 缓存与热重载 → Task 4、5、10 ✓
- §7 业务层(ConfigService/EmailTemplateService)→ Task 7、8 ✓
- §8 API → Task 9 ✓
- §9 错误处理 → 各 service 任务内异常 + Task 9 路由 ✓
- §10 测试矩阵 → Task 7/8/9 测试覆盖各用例 ✓
- §11 实施顺序 → Task 1-10 对应 ✓

**Placeholder scan**:无 TBD/TODO;每步含完整代码与命令。Task 8 中 `EmailTemplateOut` 的占位已标注修正为正确版本。

**Type consistency**:`ConfigService(db, repo, history_repo, crypto, cache)` 签名跨 Task 7/9/10 一致;`ConfigCache` 方法名(get_group/set_group/invalidate/start_subscriber)跨 Task 4/5/7 一致;`group_of_key`/`GROUP_MODELS` 跨 Task 3/7/9 一致;EmailTemplate schema 类名跨 Task 8/9 一致。
