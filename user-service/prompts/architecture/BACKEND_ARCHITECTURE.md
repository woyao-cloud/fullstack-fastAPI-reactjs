# 后端架构设计文档

**文档版本**: 1.0
**最后更新**: 2026-07-04
**编写人**: 系统架构师
**依据**: SYSTEM_ARCHITECTURE.md v1.1、ADR-001 (FastAPI 技术栈)

---

## 1. 概述

后端采用 **FastAPI (0.115+)** + **Python 3.12**，基于异步 IO 架构，提供用户、角色、权限、部门、审计日志、系统配置等模块的 REST API。本文档聚焦后端项目结构、分层职责、依赖注入、异步会话与迁移机制；整体架构、模块职责与数据流详见 [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)。

## 2. 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 语言 | Python | 3.12 | 运行时 |
| Web 框架 | FastAPI | 0.115+ | 路由、依赖注入、OpenAPI |
| ASGI 服务器 | Uvicorn / Gunicorn + UvicornWorker | - | 异步服务进程 |
| 事件循环 | uvloop | - | 高性能事件循环 |
| ORM | SQLAlchemy 2.x (async) | 2.x | 数据访问 |
| DB 驱动 | asyncpg | - | PostgreSQL 异步驱动 |
| 迁移 | Alembic | 1.x | 数据库版本管理 |
| 缓存 | redis-py (async) | - | 分布式缓存/会话 |
| 本地缓存 | cachetools | - | L1 热点缓存 |
| 消息队列 | aiokafka | - | 审计日志异步化 |
| 安全 | python-jose + passlib[bcrypt] | - | OAuth2/JWT、密码哈希 |
| 配置 | pydantic-settings | - | 环境配置加载 |
| 校验 | Pydantic | 2.x | 请求/响应模型校验 |
| 测试 | pytest + pytest-asyncio + httpx | - | 单元/集成测试 |
| 构建 | uv / pip + pyproject.toml | - | 依赖管理 |

## 3. 分层架构

```
┌─────────────────────────────────┐
│      Interfaces (API 层)        │  ← FastAPI Routers + Pydantic Schemas
│         (Adapters In)           │
├─────────────────────────────────┤
│      Application (服务层)       │  ← 业务用例、事务编排
│         (Use Cases)             │
├─────────────────────────────────┤
│        Domain (领域层)          │  ← SQLAlchemy Models、枚举、领域规则
│         (Business Logic)        │
├─────────────────────────────────┤
│     Infrastructure (设施层)     │  ← Repositories、Redis、Kafka、配置
│         (Adapters Out)          │
└─────────────────────────────────┘
```

依赖规则：外层依赖内层，内层不依赖外层；跨层通过协议/抽象解耦，便于测试替换。

## 4. 项目结构

```
back-end/
├── app/
│   ├── main.py                # FastAPI 应用入口、路由注册、中间件
│   ├── core/                  # 基础设施
│   │   ├── config.py          # pydantic-settings 配置
│   │   ├── database.py        # async engine / session factory
│   │   ├── redis.py           # redis-py async 连接池
│   │   ├── security.py        # JWT、密码哈希、权限依赖
│   │   ├── kafka.py           # aiokafka producer/consumer
│   │   ├── cache.py           # cachetools + Redis 多级缓存
│   │   └── exceptions.py       # 统一异常与处理
│   ├── domain/               # 领域层
│   │   ├── models/           # SQLAlchemy 模型 (User/Role/Permission/Department...)
│   │   ├── enums.py          # DataScope、UserStatus 等枚举
│   │   └── events.py         # 领域事件定义
│   ├── application/          # 应用层
│   │   ├── services/        # 业务服务 (UserService, RoleService, ...)
│   │   ├── schemas/         # Pydantic 请求/响应模型
│   │   └── deps.py           # 依赖注入工厂 (get_db、get_current_user)
│   ├── repositories/         # 设施层
│   │   └── *.py             # 数据访问对象
│   ├── interfaces/           # 接口层
│   │   └── api/             # FastAPI 路由 (v1/users, v1/auth, ...)
│   └── middleware/          # 中间件 (审计、限流、CORS)
├── alembic/                  # 迁移
│   ├── versions/            # 迁移脚本
│   ├── env.py
│   └── alembic.ini
├── tests/                    # pytest 测试
├── pyproject.toml            # 依赖与工具配置 (ruff/black/mypy/pytest)
├── uv.lock
└── Dockerfile
```

## 5. 依赖注入

FastAPI 原生依赖注入贯穿各层，避免全局状态：

```python
# 数据库会话
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

# 当前用户
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"])
    user = await user_repo.get_by_id(db, payload["sub"])
    if user is None or await is_blacklisted(payload["jti"]):
        raise UnauthorizedException()
    return user

# 权限校验
def require_permission(code: str):
    async def _checker(user: User = Depends(get_current_user)) -> User:
        if not await user.has_permission(code):
            raise ForbiddenException(f"缺少权限: {code}")
        return user
    return _checker
```

## 6. 异步会话与事务

```python
async def create_user(req: CreateUserRequest, db: AsyncSession = Depends(get_db)) -> UserDTO:
    async with db.begin():                       # 自动事务
        user = User(email=req.email, password_hash=pwd_context.hash(req.password))
        db.add(user)
        await db.flush()
        await audit.emit("USER_CREATE", user.id)  # 异步审计 (aiokafka)
    return UserDTO.model_validate(user)
```

要点：
- 全链路 `async/await`，禁止在请求路径调用同步阻塞 IO；
- CPU 密集任务移至 `asyncio.to_thread` / 进程池，避免阻塞事件循环；
- 多 worker（gunicorn + uvicorn worker）水平扩展，无状态、会话存 Redis。

## 7. 数据库迁移 (Alembic)

- `alembic revision --autogenerate -m "desc"`：根据模型变更生成脚本；
- `alembic upgrade head` / `alembic downgrade -1`：升降级；
- 自动生成脚本须人工审查（索引、枚举、约束）；
- CI/CD 在部署前自动执行 `alembic upgrade head`。

## 8. Pydantic Schema 与 OpenAPI

- 请求/响应统一用 Pydantic v2 模型，类型即文档；
- FastAPI 自动生成 `/docs`（Swagger）与 `/openapi.json`；
- 输出模型与领域模型解耦，经 `model_validate` 转换，避免泄露内部字段。

## 9. 中间件与异常处理

- **CORS**：受控白名单；
- **请求 ID / 链路追踪**：注入 `X-Request-Id`，对接 Jaeger；
- **限流**：Redis 计数限流中间件；
- **审计**：操作前后通过中间件/装饰器采集，异步发往 Kafka；
- **异常**：统一异常基类 + 全局 exception handler，返回标准错误码结构（见 SYSTEM_ARCHITECTURE §6.1）。

## 10. 测试策略

| 层级 | 工具 | 范围 |
|------|------|------|
| 单元 | pytest + pytest-asyncio + pytest-mock | 服务、工具、领域逻辑 |
| 集成 | pytest + httpx AsyncClient + Testcontainers | API + PostgreSQL/Redis |
| E2E | Playwright | 完整用户流程 |
| 覆盖率 | pytest-cov | ≥ 85% |

## 11. 配置管理

- `pydantic-settings.BaseSettings` 从 `.env` 加载，按环境区分；
- 敏感配置加密存储（SystemConfig 表），运行时解密；
- 动态配置通过 Redis 订阅热重载，缓存键失效后重建。

## 12. 相关文档

- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) — 系统整体架构、模块设计
- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) — 认证授权、安全防护
- [DATA_FLOW_AND_API.md](./DATA_FLOW_AND_API.md) — 数据流与 API 契约
- [adr/ADR-001-技术栈选择.md](./adr/ADR-001-技术栈选择.md) — 技术栈决策
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — 实施计划

## 13. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| 1.0 | 2026-07-04 | 系统架构师 | 初始版本，基于 FastAPI 的后端架构设计 |