# 架构决策记录 (Architecture Decision Records)

本目录记录项目中的关键架构决策及其理由。

---

## ADR-001: 后端框架选择 - FastAPI

### 状态
Accepted


### 决策
使用 **FastAPI** 作为后端框架，基于 **Python 3.12**。

### 理由

#### 选择 FastAPI 的原因:
1. **异步高性能**
   - 原生 asyncio + uvloop，IO 密集场景吞吐高
   - 单进程高并发，多 worker 水平扩展
   - 启动快，资源占用低

2. **类型与文档**
   - Pydantic 类型提示贯穿请求/响应模型
   - 自动生成 OpenAPI 文档 (/docs, /openapi.json)
   - 静态类型检查 (mypy) 友好

3. **安全集成**
   - OAuth2 Password + JWT 由 python-jose / passlib 实现
   - 依赖注入式权限控制，灵活可测

4. **数据访问**
   - SQLAlchemy 2.x async + asyncpg 简化数据访问层
   - 与 Alembic 良好集成，迁移可版本化


### 后果
- **正面**: 启动快、内存占用低、开发效率高、自动文档
- **负面**: GIL 限制 CPU 密集任务需多进程、动态类型需靠 mypy/Pydantic 把关

### 相关决策
- ADR-002: 使用 Python 3.12
- ADR-003: 使用 SQLAlchemy 而非原生 SQL

---

## ADR-002: Python 版本选择 - Python 3.12

### 状态
Accepted

### 背景
FastAPI 依赖现代 Python 特性。需要决定在 3.11、3.12 或更新版本中选择。

### 决策
使用 **Python 3.12**。

### 理由

1. **性能改进**
   - 解释器持续优化，CPython 3.11+ 性能显著提升
   - 更快的启动与执行

2. **类型提示增强**
   - PEP 695 泛型/类型别名语法
   - 更完善的静态类型检查体验

3. **错误信息**
   - 更精准的 traceback 与错误定位

4. **长期支持**
   - Python 3.12 维护周期长，生态兼容性好

### 后果
- **正面**: 使用最新语言特性、更好的性能、长期支持
- **负面**: 部分第三方库可能尚未完全适配、团队学习成本

---

## ADR-003: ORM 框架选择 - SQLAlchemy

### 状态
Accepted

### 背景
需要选择数据访问层技术：SQLAlchemy、Tortoise ORM、或原生 asyncpg。

### 决策
使用 **SQLAlchemy 2.x (async)** + **asyncpg** 驱动。

### 理由

#### 选择 SQLAlchemy 的原因:
1. **开发效率**
   - 声明式模型 + 类型化查询
   - 减少样板代码

2. **异步支持**
   - 原生 async session / async engine
   - 与 FastAPI 依赖注入无缝结合

3. **标准化**
   - Python 生态事实标准 ORM
   - 可切换驱动（asyncpg、psycopg）

4. **缓存支持**
   - 一级缓存（session identity map）
   - 二级缓存（cachetools + Redis）

#### 放弃 Tortoise ORM 的原因:
1. 生态不如 SQLAlchemy 成熟
2. 复杂查询能力较弱
3. 团队 SQLAlchemy 经验更丰富

### 后果
- **正面**: 开发效率高、代码简洁、生态集成好
- **负面**: 学习曲线陡峭、SQL 控制粒度较低、可能有 N+1 问题

### 缓解措施
- 使用 `selectinload` / `joinedload` 解决 N+1
- 复杂查询使用原生 SQL (`text()`)
- 定期性能测试和 SQL 分析

---

## ADR-004: 数据库迁移工具 - Alembic

### 状态
Accepted

### 背景
需要选择数据库迁移工具来管理 schema 变更。

### 决策
使用 **Alembic** 进行数据库迁移。

### 理由

#### 选择 Alembic 的原因:
1. **SQLAlchemy 原生支持**
   - 自动从模型生成迁移脚本（autogenerate）
   - 与 SQLAlchemy 元数据无缝集成

2. **简单易用**
   - Python 脚本迁移
   - 版本号控制
   - 升级/降级双向迁移

3. **生产验证**
   - 广泛使用
   - 成熟稳定

#### 放弃 Liquibase 的原因:
1. Liquibase 主要面向 JVM 生态
2. Alembic 与 SQLAlchemy 集成更紧密
3. 团队已有 Alembic 经验

### 后果
- **正面**: 简单易用、SQLAlchemy 集成好、支持回滚
- **负面**: 自动生成脚本仍需人工审查

---

## ADR-005: 认证机制 - JWT + OAuth2

### 状态
Accepted

### 背景
需要选择用户认证和授权机制。

### 决策
使用 **JWT (JSON Web Tokens)** 配合 **OAuth2 Password 流程**。

### 架构
- **访问令牌 (Access Token)**: 短期 (30分钟), JWT 格式
- **刷新令牌 (Refresh Token)**: 长期 (7天), 存储在数据库
- **签名算法**: RSA (非对称密钥)

### 理由

1. **无状态认证**
   - 服务端无需存储会话
   - 支持水平扩展
   - 适合微服务架构

2. **FastAPI 安全支持**
   - `OAuth2PasswordBearer` 依赖内置
   - python-jose 解码/签发 JWT
   - passlib 管理密码哈希

3. **安全性**
   - RSA 签名无法伪造
   - 短期令牌降低泄露风险
   - 刷新机制减少重新登录

4. **标准化**
   - OAuth2 是行业标准
   - 广泛支持

### 替代方案考虑

| 方案 | 优点 | 缺点 |
|------|------|------|
| Session + Cookie | 简单、可撤销 | 有状态、跨域复杂 |
| OAuth2 + 外部 IdP | 专业安全 | 依赖第三方、成本高 |
| mTLS | 极高安全性 | 复杂、开销大 |

### 后果
- **正面**: 无状态、可扩展、标准化
- **负面**: 令牌无法即时撤销 (需要黑名单)、令牌体积较大

---

## ADR-006: 分层架构 + 六边形架构 混合

### 状态
Accepted

### 背景
需要决定整体架构风格。

### 决策
采用 **分层架构 (Layered Architecture)** 为主，结合 **六边形架构 (Hexagonal)** 思想。

### 架构分层

```
┌─────────────────────────────────┐
│      Presentation Layer         │  ← Routers, Schemas (Pydantic)
│         (Adapters In)           │
├─────────────────────────────────┤
│      Application Layer          │  ← Services, Use Cases
│         (Use Cases)             │
├─────────────────────────────────┤
│        Domain Layer             │  ← Models, Domain Services
│         (Business Logic)        │
├─────────────────────────────────┤
│     Infrastructure Layer        │  ← Repositories, Configs
│         (Adapters Out)          │
└─────────────────────────────────┘
```

### 理由

1. **分层架构**
   - 清晰的关注点分离
   - 易于理解和维护
   - 广泛采用，团队熟悉

2. **六边形架构思想**
   - 领域层独立于框架
   - 依赖倒置 (Domain 不依赖外层)
   - 便于测试和替换实现

3. **依赖规则**
   - 外层依赖内层
   - 内层不依赖外层
   - 通过协议/接口解耦

### 包结构
```
app/
├── api/              # Presentation (Routers, Pydantic schemas)
├── services/         # Application (Application Services)
├── domain/           # Domain (Models, Value Objects)
├── repositories/      # Infrastructure (Data Access)
└── core/             # Infrastructure (配置, 依赖注入)
```

---

## ADR-007: 测试策略 - 测试金字塔

### 状态
Accepted

### 背景
需要建立全面的测试策略。

### 决策
采用 **测试金字塔** 模型:
- 70% 单元测试
- 20% 集成测试
- 10% E2E 测试

### 技术栈

| 层级 | 工具 | 范围 |
|------|------|------|
| 单元测试 | pytest + pytest-asyncio + pytest-mock | 服务层、工具类 |
| 集成测试 | pytest + httpx AsyncClient + Testcontainers | API、数据库 |
| E2E 测试 | Playwright | 完整用户流程 |

### 理由

1. **测试金字塔原则**
   - 底层测试快速、稳定
   - 上层测试全面但慢
   - 成本与价值平衡

2. **Testcontainers**
   - 真实数据库测试
   - 环境一致性
   - CI/CD 友好

3. **覆盖率目标**
   - 整体 ≥ 85%
   - 安全相关代码 100%

---

## ADR-008: API 设计风格 - RESTful

### 状态
Accepted

### 背景
需要决定 API 设计风格。

### 决策
采用 **RESTful API** 设计，遵循以下规范:

1. **资源导向**
   - `/users` 而非 `/getUsers`
   - `/users/{id}` 表示特定资源

2. **HTTP 动词语义**
   - GET: 读取
   - POST: 创建
   - PUT: 完整更新
   - PATCH: 部分更新
   - DELETE: 删除

3. **状态码**
   - 200 OK
   - 201 Created
   - 204 No Content
   - 400 Bad Request
   - 401 Unauthorized
   - 403 Forbidden
   - 404 Not Found
   - 500 Internal Server Error

4. **响应格式**
   ```json
   {
     "data": { ... },
     "meta": { "page": 1, "size": 20 }
   }
   ```

### 理由
- 标准化、广泛理解
- HTTP 协议原生支持
- 易于缓存
- 与前端框架配合良好

---

## ADR-009: 构建工具 - uv / pip + pyproject.toml

### 状态
Accepted

### 背景
需要选择 Python 依赖与构建工具。

### 决策
使用 **uv**（首选）或 **pip + venv**，统一以 **pyproject.toml** 管理依赖。

### 理由

#### 选择 uv 的原因:
1. **生态兼容**
   - 标准 pyproject.toml
   - 极快的依赖解析与安装

2. **团队熟悉**
   - 命令简洁，与 pip 接口接近
   - 学习成本低

3. **约定优于配置**
   - 标准项目结构
   - 锁文件可复现构建

#### 放弃 Poetry 的原因:
1. uv 性能更优
2. Poetry 生态略重
3. 团队更倾向 uv 的简洁

---

## ADR-010: 系统配置管理设计

### 状态
Accepted

### 背景
需要支持动态配置管理，包括邮件、安全、性能等配置。

### 决策
采用数据库存储 + 内存缓存 + 动态刷新的配置管理方案。

### 理由
- 支持运行时配置更新
- 敏感配置加密存储
- 配置版本管理和审计
- 与 FastAPI/Pydantic 生态良好集成（pydantic-settings）

### 相关文档
- [ADR-010-系统配置管理设计.md](ADR-010-系统配置管理设计.md)

---

## ADR-011: 部门树形结构设计

### 状态
Accepted

### 背景
需要支持五级部门树形结构管理。

### 决策
采用Materialized Path（物化路径）模式存储部门树。

### 理由
- 查询子树性能优秀（LIKE查询）
- 符合业务限制（最多5级）
- 实现简单，团队熟悉
- 缓存友好

### 相关文档
- [ADR-008-部门树形结构设计.md](ADR-008-部门树形结构设计.md)

---

## ADR-012: 数据权限范围实现

### 状态
Accepted

### 背景
需要支持四种数据权限范围：ALL/DEPT/SELF/CUSTOM。

### 决策
采用角色级数据范围配置 + 查询时动态过滤的方式。

### 理由
- 灵活性高，支持复杂条件
- 易于维护，代码控制
- 跨数据库兼容
- 性能可控

### 相关文档
- [ADR-009-数据权限范围实现.md](ADR-009-数据权限范围实现.md)

---

## ADR-013: 容器化 - Docker + Docker Compose

### 状态
Accepted

### 背景
需要容器化部署方案。

### 决策
使用 **Docker** 容器化，**Docker Compose** 本地编排。

### 技术细节
- 基础镜像: `python:3.12-slim`
- 多阶段构建
- gunicorn + uvicorn workers 进程管理
- 健康检查端点

### 理由
- 环境一致性
- 易于本地开发
- 云原生友好
- 与 CI/CD 集成

---

## 决策记录模板

```markdown
## ADR-XXX: 标题

### 状态
- Proposed
- Accepted
- Deprecated
- Superseded by [ADR-YYY](adr-YYY.md)

### 背景
问题的上下文和动机。

### 决策
明确的决策陈述。

### 理由
为什么做这个决策。

### 后果
正面和负面的影响。

### 替代方案
考虑过的其他方案。
```