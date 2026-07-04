# 架构决策记录 (Architecture Decision Records)

本目录记录项目中的关键架构决策及其理由。

---

## ADR-001: 后端框架选择 - Spring Boot 3.5

### 状态
Accepted

### 背景
项目需要一个健壮的后端框架来实现用户管理系统。最初考虑使用 FastAPI (Python)，但最终决定使用 Spring Boot。

### 决策
使用 **Spring Boot 3.5** 作为后端框架，基于 **JDK 21**。

### 理由

#### 选择 Spring Boot 的原因:
1. **企业级生态系统**
   - 成熟的生态系统和社区支持
   - 全面的文档和学习资源
   - 长期支持 (LTS) 保证

2. **JDK 21 特性**
   - 虚拟线程 (Virtual Threads) 提升并发性能
   - Records 简化 DTO 定义
   - 模式匹配增强代码可读性
   - Sealed Classes 更好的领域建模

3. **Spring Security**
   - 成熟的安全框架
   - 内置 JWT、OAuth2 支持
   - 全面的权限控制机制

4. **Spring Data JPA**
   - 简化数据访问层
   - 自动实现 Repository
   - 与 Flyway 良好集成

#### 放弃 FastAPI 的原因:
1. Python 生态在大型企业级应用中工具链不如 Java 成熟
2. 类型系统相对较弱 (运行时类型检查)
3. 异步编程模型复杂度较高
4. 团队 Java 经验更丰富

### 后果
- **正面**: 更好的长期维护性、更强的类型安全、丰富的工具链
- **负面**: 启动时间较长、内存占用较大、开发效率略低

### 相关决策
- ADR-002: 使用 JDK 21 而非 JDK 17
- ADR-003: 使用 Spring Data JPA 而非 MyBatis

---

## ADR-002: Java 版本选择 - JDK 21

### 状态
Accepted

### 背景
Spring Boot 3.x 需要 JDK 17+。需要决定在 17、21 或更新版本中选择。

### 决策
使用 **JDK 21** (LTS 版本)。

### 理由

1. **虚拟线程 (Virtual Threads)**
   - 简化高并发编程
   - 降低资源消耗
   - Spring Boot 3.2+ 原生支持

2. **Records (JDK 16+)**
   - 简洁的不可变数据类
   - 完美适合 DTO 场景
   - 自动生成 equals/hashCode/toString

3. **模式匹配增强**
   - switch 表达式模式匹配
   - 更简洁的类型检查

4. **Sealed Classes**
   - 更好的领域建模
   - 控制继承层次

5. **长期支持 (LTS)**
   - JDK 21 是 LTS 版本
   - 至少 8 年支持

### 后果
- **正面**: 使用最新语言特性、更好的性能、长期支持
- **负面**: 部分第三方库可能尚未完全适配、团队学习成本

---

## ADR-003: ORM 框架选择 - Spring Data JPA

### 状态
Accepted

### 背景
需要选择数据访问层技术：JPA (Hibernate)、MyBatis、或 JDBC Template。

### 决策
使用 **Spring Data JPA** (基于 Hibernate)。

### 理由

#### 选择 JPA 的原因:
1. **开发效率**
   - Repository 接口自动生成实现
   - 方法名派生查询
   - 减少样板代码

2. **与 Spring 生态集成**
   - 声明式事务管理
   - 自动审计功能
   - 与 Flyway 无缝集成

3. **标准化**
   - JPA 是 Java 标准
   - 可切换实现 (Hibernate, EclipseLink)

4. **缓存支持**
   - 一级缓存 (EntityManager)
   - 二级缓存 (EhCache, Caffeine)

#### 放弃 MyBatis 的原因:
1. 需要编写更多 XML/注解 SQL
2. 类型安全不如 JPA (字符串字段名)
3. 与 Spring 的集成不如 JPA 紧密

### 后果
- **正面**: 开发效率高、代码简洁、生态集成好
- **负面**: 学习曲线陡峭、SQL 控制粒度较低、可能有 N+1 问题

### 缓解措施
- 使用 EntityGraph 解决 N+1
- 复杂查询使用 `@Query` 原生 SQL
- 定期性能测试和 SQL 分析

---

## ADR-004: 数据库迁移工具 - Flyway

### 状态
Accepted

### 背景
需要选择数据库迁移工具来管理 schema 变更。

### 决策
使用 **Flyway** 进行数据库迁移。

### 理由

#### 选择 Flyway 的原因:
1. **Spring Boot 原生支持**
   - 自动配置
   - 启动时自动执行
   - 与数据源无缝集成

2. **简单易用**
   - SQL 脚本迁移
   - 版本号控制
   - 校验和验证

3. **生产验证**
   - 广泛使用
   - 成熟稳定

#### 放弃 Liquibase 的原因:
1. Flyway 更轻量
2. SQL 脚本更直观
3. 团队已有 Flyway 经验

### 后果
- **正面**: 简单易用、Spring Boot 集成好
- **负面**: 功能不如 Liquibase 丰富 (如 XML/YAML 格式、回滚)

---

## ADR-005: 认证机制 - JWT + OAuth2

### 状态
Accepted

### 背景
需要选择用户认证和授权机制。

### 决策
使用 **JWT (JSON Web Tokens)** 配合 **OAuth2 Resource Server**。

### 架构
- **访问令牌 (Access Token)**: 短期 (30分钟), JWT 格式
- **刷新令牌 (Refresh Token)**: 长期 (7天), 存储在数据库
- **签名算法**: RSA (非对称密钥)

### 理由

1. **无状态认证**
   - 服务端无需存储会话
   - 支持水平扩展
   - 适合微服务架构

2. **Spring Security 支持**
   - OAuth2 Resource Server 自动配置
   - JWT 解码器内置
   - 与权限控制集成

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
│      Presentation Layer         │  ← Controllers, DTOs
│         (Adapters In)           │
├─────────────────────────────────┤
│      Application Layer          │  ← Services, Use Cases
│         (Use Cases)             │
├─────────────────────────────────┤
│        Domain Layer             │  ← Entities, Domain Services
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
   - 通过接口解耦

### 包结构
```
com.usermanagement
├── web/              # Presentation (Controllers, DTOs)
├── service/          # Application (Application Services)
├── domain/           # Domain (Entities, Value Objects)
├── repository/       # Infrastructure (Data Access)
└── config/           # Infrastructure (Configuration)
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
| 单元测试 | JUnit 5 + Mockito | 服务层、工具类 |
| 集成测试 | Spring Boot Test + Testcontainers | API、数据库 |
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

## ADR-009: 构建工具 - Maven

### 状态
Accepted

### 背景
需要选择 Java 构建工具。

### 决策
使用 **Maven** 作为构建工具。

### 理由

#### 选择 Maven 的原因:
1. **生态兼容**
   - Spring Boot 原生支持
   - 插件丰富

2. **团队熟悉**
   - 已有经验
   - 无需学习成本

3. **约定优于配置**
   - 标准目录结构
   - 生命周期清晰

#### 放弃 Gradle 的原因:
1. 团队 Maven 经验更多
2. 项目复杂度不需要 Gradle 的灵活性
3. Maven 配置更简单直观

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
- 与Spring生态良好集成

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
- 基础镜像: `eclipse-temurin:21-jre-alpine`
- 多阶段构建
- JVM 内存优化
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
