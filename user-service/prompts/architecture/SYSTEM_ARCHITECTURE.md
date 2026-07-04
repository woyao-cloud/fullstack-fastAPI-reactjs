# 系统架构设计文档
# 用户角色权限管理系统

**文档版本**: 1.1
**最后更新**: 2026-03-27
**编写人**: 系统架构师
**依据**: PRD v1.0、FRD v1.2、NFRD v1.0、CONTEXT.md v1.0

---

## 1. 架构概述

### 1.1 系统定位

用户角色权限管理系统是一个企业级身份与访问管理（IAM）平台，基于 RBAC（Role-Based Access Control）模型，支持1000万+注册用户规模，提供高并发（10000 TPS）的认证授权服务。

### 1.2 设计原则

| 原则 | 说明 | 实现方式 |
|------|------|----------|
| **无状态服务** | 服务实例不保存会话状态 | JWT + Redis 分布式会话 |
| **水平扩展** | 支持按需增加服务实例 | Docker + Kubernetes HPA |
| **防御性编程** | 假设输入不可信，默认拒绝 | 多层次校验、异常处理 |
| **最小权限** | 仅授予必要的权限 | 四级权限模型 |
| **安全优先** | 安全设计贯穿始终 | 加密、审计、防护 |

### 1.3 架构目标

| 目标 | 指标 | 实现策略 |
|------|------|----------|
| 高性能 | 登录 < 100ms，TPS > 10,000 | Redis缓存 + 异步日志 + 连接池优化 |
| 高可用 | 99.9% 可用性 | 多实例部署 + 自动故障转移 |
| 可扩展 | 支持1000万用户 | 水平扩展 + 数据库分片预留 |
| 安全性 | 等保2.0三级 | 多层认证 + 审计日志 + 加密传输 |

---

## 2. 技术栈选型

### 2.1 后端技术栈

| 类别 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **编程语言** | Python | 3.12 | 性能改进，asyncio 原生异步，类型提示成熟 |
| **应用框架** | FastAPI | 0.115+ | 基于 Starlette/Pydantic，异步高性能 |
| **数据访问** | SQLAlchemy 2.x (async) + asyncpg | 2.x | 异步 ORM，简化数据库操作 |
| **数据库** | PostgreSQL | 15+ | JSONB支持，性能优秀 |
| **缓存** | Redis | 7+ | 高性能分布式缓存 |
| **消息队列** | Kafka (aiokafka) | 3+ | 高吞吐审计日志处理 |
| **安全框架** | FastAPI security + python-jose + passlib | - | OAuth2/JWT 标准安全实现 |
| **文档生成** | FastAPI 内置 OpenAPI | - | 自动生成 API 文档（/docs、/openapi.json） |
| **数据库迁移** | Alembic | 1.x | 版本化数据库管理 |
| **构建工具** | uv / pip + pyproject.toml | - | 依赖管理 |

### 2.2 前端技术栈

| 类别 | 技术 | 版本 | 选型理由 |
|------|------|------|----------|
| **框架** | Next.js | 16.x | SSR/SSG支持，App Router |
| **语言** | TypeScript | 5+ | 类型安全 |
| **样式** | Tailwind CSS | 3.x | 原子化CSS，开发高效 |
| **UI组件** | shadcn/ui | - | 现代化UI组件库 |
| **状态管理** | Zustand | 4.x | 轻量级状态管理 |
| **HTTP客户端** | axios | 1.x | REST API调用 |
| **表单处理** | React Hook Form | 7.x | 高性能表单验证 |
| **验证库** | Zod | 3.x | Schema验证 |

### 2.3 基础设施

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **容器化** | Docker | 24+ | 应用打包 |
| **编排** | Kubernetes | 1.28+ | 容器编排 |
| **负载均衡** | Nginx / Ingress | 1.25+ | 流量分发 |
| **监控** | Prometheus + Grafana | - | 指标监控 |
| **日志** | ELK Stack / Loki | - | 日志聚合 |
| **链路追踪** | Jaeger / Zipkin | - | 分布式追踪 |

---

## 3. 高层架构设计

### 3.1 系统整体架构

系统采用分层架构设计，从上到下分为：

```
┌─────────────────────────────────────────────────────────────┐
│                    接入层 (Ingress)                          │
│              Nginx / ALB / CDN (HTTPS/HTTP2)                │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    网关层 (Gateway)                          │
│         路由 / 限流 / 认证 / 负载均衡 / SSL终止               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    应用层 (Application)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ 用户管理     │  │ 角色权限     │  │ 审计日志     │         │
│  │   Module    │  │   Module    │  │   Module    │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐                          │
│  │ 认证授权     │  │ 系统配置     │                          │
│  │   Module    │  │   Module    │                          │
│  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    服务层 (Service)                          │
│              业务逻辑 / 事务管理 / 权限校验                   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    数据层 (Data)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │PostgreSQL│  │  Redis   │  │  Kafka   │  │  MinIO   │    │
│  │ (主数据)  │  │ (缓存)   │  │(消息队列)│  │ (文件)   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 部署拓扑

```
                    ┌─────────────────┐
                    │   CDN / WAF     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │   Nginx/Ingress  │
                    │  (负载均衡+SSL)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
   │   App   │          │   App   │          │   App   │
   │ Pod 1   │◄────────►│ Pod 2   │◄────────►│ Pod N   │
   └────┬────┘          └────┬────┘          └────┬────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
   ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
   │ PostgreSQL│         │  Redis  │          │  Kafka  │
   │ 主从集群  │         │ Cluster │          │ Cluster │
   └─────────┘          └─────────┘          └─────────┘
```

### 3.3 通信架构

| 通信类型 | 协议 | 用途 | 安全 |
|----------|------|------|------|
| 客户端-服务端 | HTTPS/HTTP2 | REST API | TLS 1.3 |
| 服务端-Redis | RESP 3 | 缓存/会话 | SSL/TLS |
| 服务端-PostgreSQL | PostgreSQL Wire | 数据存储 | SSL/TLS |
| 服务端-Kafka | Kafka Protocol | 异步消息 | SASL_SSL |
| 内部服务调用 | HTTP | 服务间调用 | mTLS |

---

## 4. 模块架构设计

### 4.1 模块划分

```
usermanagement-backend/
├── app/
│   ├── domain/              # 领域层
│   │   ├── user/            # 用户领域
│   │   ├── department/      # 部门领域（增强：树形结构）
│   │   ├── role/            # 角色领域（增强：继承、数据权限）
│   │   ├── permission/      # 权限领域（增强：模板）
│   │   ├── audit/           # 审计领域
│   │   ├── config/          # 配置领域（新增）
│   │   └── template/        # 模板领域（新增）
│   ├── application/         # 应用层
│   │   ├── service/         # 应用服务
│   │   │   ├── UserService
│   │   │   ├── DepartmentService（增强）
│   │   │   ├── RoleService（增强）
│   │   │   ├── PermissionService（增强）
│   │   │   ├── AuditService
│   │   │   ├── ConfigService（新增）
│   │   │   ├── TemplateService（新增）
│   │   │   ├── SessionService（新增）
│   │   │   └── ExportService（新增）
│   │   ├── dto/             # 数据传输对象
│   │   └── event/           # 领域事件
│   ├── infrastructure/      # 基础设施层
│   │   ├── config/          # 配置（增强）
│   │   ├── persistence/     # 持久化
│   │   ├── security/        # 安全配置（增强）
│   │   ├── cache/           # 缓存配置
│   │   ├── messaging/       # 消息配置
│   │   ├── web/             # Web配置
│   │   ├── file/            # 文件存储（新增）
│   │   └── email/           # 邮件服务（新增）
│   └── interfaces/          # 接口层
│       ├── rest/            # REST控制器
│       └── websocket/       # WebSocket
```

### 4.2 用户管理模块

#### 职责
- 用户CRUD操作
- 用户状态管理（激活/禁用/锁定）
- 批量导入导出
- 用户自助注册

#### 核心类设计
```
UserAggregate (聚合根)
├── UserEntity (用户实体)
├── UserRole (用户角色关联)
└── UserProfile (用户资料)

UserService (领域服务)
├── createUser()
├── updateUser()
├── activateUser()
├── lockUser()
└── importUsers()

UserRepository (仓储接口)
├── findByEmail()
├── findByDepartmentId()
└── existsByEmail()
```

#### 数据流
```
1. 用户注册/创建
   Request → Controller → Service → Repository → PostgreSQL
                                   ↓
                              Redis Cache (用户信息)
                                   ↓
                              Kafka (审计日志)

2. 用户查询
   Request → Controller → Service → Redis Cache (命中)
                              ↓
                         PostgreSQL (未命中)
```

### 4.3 角色权限模块

#### 职责
- 角色CRUD
- 四级权限管理（菜单/操作/字段/数据）
- 用户角色分配
- 权限缓存管理

#### RBAC四级模型（增强）

```
┌─────────────────────────────────────────────────────────────┐
│                      RBAC 四级权限模型                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Level 1: 菜单权限 (Menu Permission)                        │
│   ├─ 控制导航菜单的可见性                                     │
│   ├─ 示例: user:menu:view                                    │
│   ├─ 存储: permission.type = 'MENU'                          │
│   └─ 前端控制: 动态菜单渲染                                   │
│                                                             │
│   Level 2: 操作权限 (Action Permission)                      │
│   ├─ 控制按钮/功能的可操作性                                  │
│   ├─ 示例: user:create, user:update, user:delete             │
│   ├─ 存储: permission.type = 'ACTION'                        │
│   └─ 前端控制: 按钮显示/禁用                                  │
│                                                             │
│   Level 3: 字段权限 (Field Permission)                       │
│   ├─ 控制字段的可见/可编辑                                    │
│   ├─ 示例: user.field.phone:read, user.field.phone:write     │
│   ├─ 存储: permission.type = 'FIELD'                         │
│   └─ 前端控制: 表单字段控制                                   │
│                                                             │
│   Level 4: 数据权限 (Data Permission)                        │
│   ├─ 控制可见数据范围                                        │
│   ├─ 范围: ALL / DEPT / SELF / CUSTOM                        │
│   ├─ 存储: role.data_scope + role.data_conditions            │
│   └─ 实现: 数据过滤拦截器                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 数据权限范围实现

**四种数据范围类型**：

| 范围类型 | 代码 | 描述 | SQL过滤条件 |
|----------|------|------|-------------|
| **全部** | ALL | 查看所有数据 | 无过滤 |
| **本部门** | DEPT | 查看本部门及子部门数据 | `department_id IN (部门子树ID列表)` |
| **本人** | SELF | 仅查看自己创建的数据 | `created_by = current_user_id` |
| **自定义** | CUSTOM | 按条件自定义 | 动态条件生成 |

**数据权限实现**：
```python
class DataPermissionFilter:

    def __init__(self, department_service: DepartmentService):
        self.department_service = department_service

    async def apply_data_permission(
        self, stmt: select, user: CurrentUser, data_scope: str
    ) -> select:
        if data_scope == "ALL":
            return stmt  # 无过滤

        if data_scope == "DEPT":
            return await self._create_department_filter(stmt, user.department_id)

        if data_scope == "SELF":
            return stmt.where(User.created_by == user.id)

        if data_scope == "CUSTOM":
            return await self._create_custom_filter(stmt, user.role.data_conditions)

        raise ValueError(f"未知的数据权限范围: {data_scope}")

    async def _create_department_filter(self, stmt: select, department_id: UUID) -> select:
        accessible_dept_ids = await self.department_service.get_sub_department_ids(department_id)
        accessible_dept_ids.append(department_id)
        return stmt.where(User.department_id.in_(accessible_dept_ids))
```

#### 角色继承管理

**多继承支持**：
```python
class Role(Base):
    __tablename__ = "role"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(unique=True)
    code: Mapped[str] = mapped_column(unique=True)
    data_scope: Mapped[DataScope] = mapped_column(default=DataScope.SELF)

    permissions: Mapped[set[Permission]] = relationship(
        secondary="role_permission", collection_class=set
    )
    parent_roles: Mapped[set["Role"]] = relationship(
        secondary="role_inheritance",
        primaryjoin="Role.id == role_inheritance.c.child_role_id",
        secondaryjoin="Role.id == role_inheritance.c.parent_role_id",
        collection_class=set,
    )

    def get_all_permissions(self) -> set[Permission]:
        all_permissions: set[Permission] = set(self.permissions)
        for parent in self.parent_roles:
            all_permissions |= parent.get_all_permissions()
        return all_permissions
```

**循环继承检测**：
```python
class RoleService:
    def __init__(self, role_repo: RoleRepository, cache: PermissionCache):
        self.role_repo = role_repo
        self.cache = cache

    async def add_parent_role(self, child_role_id: UUID, parent_role_id: UUID) -> None:
        # 检查是否形成循环
        if await self._is_circular_inheritance(child_role_id, parent_role_id):
            raise BusinessException("不能形成循环继承关系")

        child = await self.role_repo.get_or_404(child_role_id)
        parent = await self.role_repo.get_or_404(parent_role_id)
        child.parent_roles.add(parent)
        await self.role_repo.save(child)

        # 清除相关用户的权限缓存
        await self.cache.clear_user_permission(child_role_id)

    async def _is_circular_inheritance(self, start_role_id: UUID, target_role_id: UUID) -> bool:
        if start_role_id == target_role_id:
            return True

        visited: set[UUID] = set()
        queue: deque[UUID] = deque([target_role_id])

        while queue:
            current_id = queue.popleft()
            if current_id in visited:
                continue
            visited.add(current_id)

            if current_id == start_role_id:
                return True

            current = await self.role_repo.get_or_404(current_id)
            queue.extend(p.id for p in current.parent_roles)

        return False
```

#### 权限模板机制

**权限模板实体**：
```python
class PermissionTemplate(Base):
    __tablename__ = "permission_template"

    id: Mapped[UUID] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column()
    code: Mapped[str] = mapped_column()
    description: Mapped[str | None] = mapped_column()
    type: Mapped[TemplateType] = mapped_column()  # DEPARTMENT_MANAGER, END_USER, AUDITOR 等
    permissions: Mapped[set[Permission]] = relationship(
        secondary="template_permission", collection_class=set
    )
    default_data_scope: Mapped[DataScope] = mapped_column()
    version: Mapped[str] = mapped_column()
    is_active: Mapped[bool] = mapped_column(default=True)
```

**应用模板创建角色**：
```python
class TemplateService:
    def __init__(self, template_repo: TemplateRepository, role_repo: RoleRepository):
        self.template_repo = template_repo
        self.role_repo = role_repo

    async def create_role_from_template(self, request: CreateRoleFromTemplateRequest) -> Role:
        template = await self.template_repo.find_by_code_and_active(request.template_code)
        if template is None:
            raise TemplateNotFoundException(request.template_code)

        permissions: set[Permission] = set(template.permissions)
        if request.additional_permissions:
            permissions |= set(request.additional_permissions)
        if request.excluded_permissions:
            permissions -= set(request.excluded_permissions)

        role = Role(
            name=request.role_name,
            code=self._generate_role_code(request.role_name),
            data_scope=template.default_data_scope,
            permissions=permissions,
        )
        return await self.role_repo.save(role)
```

#### 权限检查流程
```
用户请求 → JWT认证 → 获取用户角色 → 查询权限缓存(Redis)
                                         ↓
                              权限检查 (RBAC匹配)
                                         ↓
                              数据权限过滤 (行级)
                                         ↓
                              字段权限过滤 (列级)
                                         ↓
                              执行业务逻辑
```

### 4.4 部门管理模块（增强）

#### 职责
- 部门CRUD操作
- 五级树形结构管理（公司→一级部门→二级部门→三级部门→四级部门）
- 层级路径维护（Materialized Path模式）
- 部门人员管理
- 部门排序与拖拽调整
- 部门树缓存管理

#### 部门树形结构设计

**数据模型**：
```sql
-- 使用 Materialized Path 模式，支持高效子树查询
CREATE TABLE department (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,  -- 格式: DEPT-001
    parent_id UUID REFERENCES department(id),
    level INT NOT NULL CHECK (level BETWEEN 1 AND 5),
    path VARCHAR(500) NOT NULL,        -- 格式: /1/2/5/10
    sort_order INT DEFAULT 0,
    manager_id UUID REFERENCES user(id),
    description VARCHAR(500),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,               -- 软删除
    CONSTRAINT fk_department_parent FOREIGN KEY (parent_id) REFERENCES department(id)
);

-- 索引设计
CREATE INDEX idx_department_path ON department(path);
CREATE INDEX idx_department_parent ON department(parent_id);
CREATE INDEX idx_department_level ON department(level);
CREATE INDEX idx_department_status ON department(status);
```

#### 核心操作实现

**查询子树**：
```python
class DepartmentService:

    @cached("departmentSubtree", key=lambda self, root_id: root_id)
    async def get_subtree(self, root_id: UUID) -> list[DepartmentDTO]:
        path = await self.department_repo.find_path_by_id(root_id)
        return await self.department_repo.find_by_path_starting_with(path + "/")

    async def get_sub_department_ids(self, department_id: UUID) -> list[UUID]:
        path = await self.department_repo.find_path_by_id(department_id)
        return await self.department_repo.find_ids_by_path_starting_with(path + "/")
```

**更新部门层级**：
```python
    async def update_department_parent(self, department_id: UUID, new_parent_id: UUID) -> DepartmentDTO:
        async with self.session.begin():
            # 1. 检查循环依赖
            if await self._is_circular_dependency(department_id, new_parent_id):
                raise BusinessException("不能形成循环依赖")

            # 2. 获取旧路径和新路径
            old_path = await self.department_repo.find_path_by_id(department_id)
            new_parent_path = await self.department_repo.find_path_by_id(new_parent_id)
            new_path = f"{new_parent_path}/{department_id}"

            # 3. 更新当前部门
            await self.department_repo.update_path(department_id, new_path)

            # 4. 更新所有子部门的路径
            await self.department_repo.update_subtree_paths(old_path, new_path)

        # 5. 清除缓存
        await self.cache.evict("departmentTree")
        await self.cache.evict_pattern("departmentSubtree:*")

        return await self.get_department(department_id)
```

#### 部门层级规则
- **最多5级**：公司(1) → 一级部门(2) → 二级部门(3) → 三级部门(4) → 四级部门(5)
- **路径格式**：`/根部门ID/父部门ID/当前部门ID`
- **层级计算**：`level = path.split('/').length - 1`
- **删除约束**：存在子部门或用户时不可删除
- **缓存策略**：Redis缓存完整部门树，TTL=10分钟

#### 数据权限集成
部门作为数据权限的基础单位：
- **本部门范围**：可查看用户所属部门及其所有子部门的数据
- **部门负责人**：可管理本部门用户和配置
- **部门调整影响**：用户调部门时，数据权限自动更新

### 4.5 系统配置模块（新增）

#### 职责
- 邮件服务配置（SMTP服务器、端口、认证）
- 安全策略配置（密码策略、登录策略、会话策略）
- 性能配置管理（缓存TTL、连接池、接口阈值）
- 系统参数配置（公司信息、默认设置）
- 配置版本管理与审计

#### 配置分类与存储

**数据模型**：
```sql
-- 系统配置表
CREATE TABLE system_config (
    id UUID PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    config_type VARCHAR(50) NOT NULL,  -- EMAIL/SECURITY/PERFORMANCE/SYSTEM
    description VARCHAR(500),
    is_encrypted BOOLEAN DEFAULT FALSE,
    is_sensitive BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES user(id)
);

-- 邮件模板表
CREATE TABLE email_template (
    id UUID PRIMARY KEY,
    template_code VARCHAR(50) UNIQUE NOT NULL,  -- USER_ACTIVATION, PASSWORD_RESET
    template_name VARCHAR(100) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB,  -- 模板变量定义
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 配置类型详解

**1. 邮件配置**：
```yaml
mail:
  host: smtp.example.com
  port: 587
  username: noreply@example.com
  password: ENCRYPTED_VALUE
  protocol: smtp
  properties:
    mail.smtp.auth: true
    mail.smtp.starttls.enable: true
```

**2. 安全策略配置**：
```yaml
security:
  password:
    minLength: 8
    requireUppercase: true
    requireLowercase: true
    requireDigits: true
    requireSpecialChars: true
    historySize: 5
    expirationDays: 90
    minChangeIntervalHours: 24
  login:
    maxAttempts: 5
    lockDurationMinutes: 30
    sessionTimeoutMinutes: 15
    maxSessionsPerUser: 5
    rememberMeDays: 30
```

**3. 性能配置**：
```yaml
performance:
  cache:
    userInfoTtl: 180
    permissionTtl: 300
    departmentTreeTtl: 600
  database:
    maxPoolSize: 50
    minIdle: 5
    connectionTimeout: 30000
  api:
    responseThreshold: 200
    loginThreshold: 100
    slowQueryThreshold: 5000
```

#### 配置管理实现

**配置服务**：
```python
class ConfigService:

    @cached("systemConfig", key=lambda self, config_key: config_key)
    async def get_config_value(self, config_key: str) -> str:
        config = await self.config_repo.find_by_config_key(config_key)
        if config is None:
            raise ConfigNotFoundException(config_key)

        if config.is_encrypted:
            return self.crypto.decrypt(config.config_value)
        return config.config_value

    async def update_config(self, config_key: str, value: str, user_id: UUID) -> None:
        async with self.session.begin():
            config = await self.config_repo.find_by_config_key(config_key)
            if config is None:
                config = SystemConfig(config_key=config_key)

            if config.is_encrypted:
                config.config_value = self.crypto.encrypt(value)
            else:
                config.config_value = value

            config.updated_by = user_id
            await self.config_repo.save(config)

        # 发布配置变更事件
        await self.event_bus.publish(ConfigChangedEvent(config_key, value))
        # 清除缓存
        await self.cache.evict("systemConfig", config_key)
```

**动态安全策略应用**：
```python
# 通过 pydantic-settings 加载，运行时由 Redis 配置订阅热重载
class SecurityPolicySettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="security_policy_")
    password: PasswordPolicy = PasswordPolicy()
    login: LoginPolicy = LoginPolicy()

@lru_cache(maxsize=1)
def security_policy() -> SecurityPolicySettings:
    return SecurityPolicySettings()

@lru_cache(maxsize=1)
def pwd_context() -> CryptContext:
    # passlib BCrypt，强度由动态配置驱动，配置变更时清除缓存重建
    policy = security_policy().password
    return CryptContext(schemes=["bcrypt"], bcrypt__rounds=policy.strength)
```

### 4.6 审计日志模块（增强）

#### 职责
- 敏感操作记录
- 登录登出记录
- 日志查询与导出（支持Excel/PDF/CSV）
- 日志分析与告警
- 个人登录历史查看

#### 日志架构增强
```
操作发生 → FastAPI 中间件/装饰器 → 日志收集 → Kafka Topic
                                         ↓
                              Log Consumer Service
                                         ↓
                    ┌──────────┬──────────┬──────────┐
                    ↓          ↓          ↓          ↓
              PostgreSQL   Elasticsearch  告警检查   导出服务
              (audit_log)   (搜索优化)    (实时)    (异步生成)
```

#### 日志导出服务
```python
class AuditLogExportService:

    async def export_logs(self, request: ExportRequest, user_id: UUID) -> ExportTask:
        # 1. 创建导出任务
        task = await self._create_export_task(request, user_id)

        # 后台任务异步执行（FastAPI BackgroundTasks / asyncio.Task）
        asyncio.create_task(self._run_export(task, request))
        return task

    async def _run_export(self, task: ExportTask, request: ExportRequest) -> None:
        # 2. 异步查询数据
        logs = await self.audit_log_repo.find_by_criteria(request)

        # 3. 生成导出文件
        match request.format:
            case ExportFormat.EXCEL:
                file_content = self._generate_excel(logs)
            case ExportFormat.PDF:
                file_content = self._generate_pdf(logs)
            case ExportFormat.CSV:
                file_content = self._generate_csv(logs)
            case _:
                raise UnsupportedFormatException(request.format)

        # 4. 保存到文件存储
        file_url = await self.file_storage.save_export_file(task.id, file_content)

        # 5. 更新任务状态
        task.complete(file_url)
        await self.task_repo.save(task)
```

#### 个人登录历史
```python
@router.get("/api/v1/users/me/login-history")
async def get_login_history(
    user: CurrentUser = Depends(get_current_user),
    page: int = Query(0, ge=0),
    size: int = Query(20, le=100),
    audit_log_service: AuditLogService = Depends(),
) -> Page[LoginHistoryDTO]:
    return await audit_log_service.get_user_login_history(user.id, page, size)
```

---

## 5. 数据架构

### 5.1 数据模型总览

```
┌─────────────────────────────────────────────────────────────┐
│                        数据模型关系                          │
└─────────────────────────────────────────────────────────────┘

User (用户) ──────── UserRole ──────── Role (角色)
    │                                    │
    │                                    RolePermission
    │                                    │
    │                               Permission (权限)
    │
    └──────── Department (部门) ────────┘
              (parent_id自关联)

AuditLog (审计日志)
    └── 记录所有用户操作

SystemConfig (系统配置)
    └── 密码策略、安全参数等
```

### 5.2 数据流架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────►│  API Server │────►│   Redis     │
│   (Browser) │     │  (FastAPI)     │    │  (Cache)    │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────┴─────┐    ┌────┴────┐     ┌─────┴─────┐
    │PostgreSQL │    │  Kafka  │     │  MinIO   │
    │(主数据)    │    │(消息队列)│     │ (文件)   │
    └───────────┘    └─────────┘     └───────────┘
          │
    ┌─────┴─────┐
    │ Read Replica│
    │ (读副本)    │
    └───────────┘
```

### 5.3 缓存策略

#### 缓存层级

| 缓存级别 | 存储内容 | TTL | 更新策略 |
|----------|----------|-----|----------|
| **L1: Local Cache** | 热点数据 | 5分钟 | cachetools |
| **L2: Redis** | 用户权限、会话 | 15分钟-7天 | 主动更新 |
| **L3: Database** | 持久化数据 | 永久 | - |

#### 缓存设计

```
Redis Key 设计:

# 用户会话
session:{userId}:{sessionId} → JWT Token

# 用户权限缓存
user:permissions:{userId} → Set<PermissionCode>
user:roles:{userId} → Set<RoleId>

# 登录失败计数
login:failed:{email} → count (TTL: 30min)

# JWT 黑名单
jwt:blacklist:{tokenId} → expired_time

# 部门树缓存
department:tree → JSON
department:{id}:children → List<DeptId>

# 限流计数
rate:limit:{ip}:{path} → count (TTL: 1min)
```

#### 缓存一致性策略

| 场景 | 策略 |
|------|------|
| 读操作 | Cache Aside - 先查缓存，未命中查库并写入缓存 |
| 写操作 | Write Through - 先更新数据库，再删除缓存 |
| 批量更新 | 定时任务 + 消息通知更新缓存 |

### 5.4 数据库设计原则

#### 分表策略
- **用户表**: 按用户ID范围分片（预留，初期单表）
- **审计日志表**: 按时间分区（每月一张表）
- **其他表**: 单表（数据量可控）

#### 读写分离
```
写操作 ──► PostgreSQL Master
              │
              └──► PostgreSQL Replica 1 ──► 读操作
              └──► PostgreSQL Replica 2 ──► 读操作
```

---

## 6. 接口设计规范

### 6.1 REST API 标准

#### URL 命名规范
```
GET    /api/v1/users              # 查询用户列表
GET    /api/v1/users/{id}         # 查询单个用户
POST   /api/v1/users              # 创建用户
PUT    /api/v1/users/{id}         # 更新用户
DELETE /api/v1/users/{id}         # 删除用户
PATCH  /api/v1/users/{id}/status  # 更新状态

GET    /api/v1/departments        # 查询部门树
GET    /api/v1/departments/{id}/users  # 查询部门用户

POST   /api/v1/auth/login         # 登录
POST   /api/v1/auth/logout        # 登出
POST   /api/v1/auth/refresh       # 刷新Token
```

#### 响应格式
```json
{
  "success": true,
  "code": 200,
  "message": "操作成功",
  "data": {
    "id": "uuid",
    "name": "张三"
  },
  "meta": {
    "page": 1,
    "size": 20,
    "total": 100
  },
  "timestamp": "2026-03-24T10:30:00Z"
}
```

#### 错误码定义

| 状态码 | 错误码 | 说明 |
|--------|--------|------|
| 400 | E400001 | 参数校验失败 |
| 401 | E401001 | 未认证/Token过期 |
| 401 | E401002 | 认证失败 |
| 403 | E403001 | 无权限访问 |
| 404 | E404001 | 资源不存在 |
| 409 | E409001 | 资源冲突（如邮箱已存在） |
| 429 | E429001 | 请求频率超限 |
| 500 | E500001 | 服务器内部错误 |

### 6.2 分页规范

```json
// 请求
GET /api/v1/users?page=1&size=20&sort=createdAt,desc

// 响应
{
  "success": true,
  "data": [
    {"id": "...", "name": "..."}
  ],
  "meta": {
    "page": 1,
    "size": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### 6.3 API 版本控制

- URL 版本: `/api/v1/`, `/api/v2/`
- 向后兼容: v1 保持兼容，新功能在 v2
- 弃用策略: 提前3个月通知

---

## 7. 安全架构

### 7.1 认证架构

```
┌─────────────────────────────────────────────────────────────┐
│                        认证流程                              │
└─────────────────────────────────────────────────────────────┘

1. 用户登录
   Client ──► POST /api/v1/auth/login
                   {email, password, rememberMe}
                    │
                    ▼
            ┌───────────────┐
            │ 验证邮箱密码    │
            │ BCrypt比对      │
            └───────┬───────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌────────┐  ┌────────┐  ┌────────┐
   │检查锁定 │  │检查状态 │  │登录计数 │
   │(Redis) │  │(DB)    │  │(Redis) │
   └────────┘  └────────┘  └────────┘
        │           │           │
        └───────────┴───────────┘
                    │
                    ▼
            ┌───────────────┐
            │生成JWT Token   │
            │• Access (15min)│
            │• Refresh (7d)  │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │存储会话(Redis) │
            │异步审计(Kafka) │
            └───────┬───────┘
                    │
        Response ◄──┘
        {accessToken, refreshToken, expiresIn}

2. Token 验证
   Client ──► Request with Authorization: Bearer {token}
                    │
                    ▼
            ┌───────────────┐
            │验证Token签名   │
            │(RSA256)        │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │检查黑名单      │
            │(Redis)         │
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │提取用户信息    │
            │注入请求上下文
            └───────┬───────┘
                    │
                    ▼
            ┌───────────────┐
            │权限检查        │
            │(RBAC)          │
            └───────┬───────┘
                    │
                    ▼
              执行业务逻辑
```

### 7.2 授权架构

#### RBAC 实现
```python
# 权限检查依赖：通过 FastAPI 依赖注入校验权限
async def require_permission(code: str, user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not await user.has_permission(code):
        raise ForbiddenException(f"缺少权限: {code}")
    return user

@router.post("/users", response_model=UserDTO)
async def create_user(
    request: CreateUserRequest,
    user: CurrentUser = Depends(require_permission("user:create")),
    user_service: UserService = Depends(),
) -> UserDTO:
    return await user_service.create_user(request)

# 数据权限过滤：在 Service 层对 select 语句叠加过滤条件
async def list_users(dept: Department, user: CurrentUser, dept_filter: DataPermissionFilter = Depends()):
    stmt = select(User)
    stmt = await dept_filter.apply_data_permission(stmt, user, DataScope.DEPT)
    return await user_repo.execute(stmt)
```

### 7.3 安全防护

| 威胁 | 防护措施 | 实现方式 |
|------|----------|----------|
| **暴力破解** | 登录失败锁定 | Redis计数，5次失败锁定30分钟 |
| **重放攻击** | Token唯一性 | JWT jti + 黑名单检查 |
| **CSRF攻击** | CSRF Token | SameSite Cookie + Token验证 |
| **XSS攻击** | 输入过滤 | 输出编码 + Content Security Policy |
| **SQL注入** | 参数化查询 | SQLAlchemy 参数化查询 |
| **敏感数据泄露** | 加密存储 | AES-256加密敏感字段 |
| **越权访问** | 权限校验 | 路由级依赖注入校验 |
| **会话劫持** | 会话绑定 | IP + UserAgent绑定检查 |

### 7.4 加密策略

```
数据传输:
┌─────────┐           TLS 1.3           ┌─────────┐
│ Client  │◄───────────────────────────►│ Server  │
└─────────┘    (证书: RSA 2048+)        └─────────┘

数据存储:
┌─────────────┐
│ 密码        │ → BCrypt (strength=12)
├─────────────┤
│ 敏感字段    │ → AES-256-GCM
├─────────────┤
│ JWT签名     │ → RSA-256 (私钥签名)
├─────────────┤
│ 数据库连接  │ → SSL/TLS
└─────────────┘
```

---

## 8. 部署架构

### 8.1 Docker 容器化

#### 容器规划

| 服务 | 镜像 | 端口 | 内存限制 | CPU限制 |
|------|------|------|----------|---------|
| app | usermanagement/app | 8000 | 1GB | 1核 |
| nginx | nginx:alpine | 80/443 | 256MB | 0.5核 |
| postgres | postgres:15 | 5432 | 4GB | 2核 |
| redis | redis:7-alpine | 6379 | 1GB | 0.5核 |
| kafka | confluentinc/cp-kafka | 9092 | 2GB | 1核 |

#### Dockerfile 示例
```dockerfile
# 多阶段构建
FROM python:3.12-slim AS builder
WORKDIR /app
ENV UV_SYSTEM_PYTHON=1
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --frozen --no-install-project
COPY app ./app

FROM python:3.12-slim
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
WORKDIR /app
COPY --from=builder /app /app
ENV PATH="/app/.venv/bin:$PATH"
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/health')"
ENTRYPOINT ["gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000"]
```

### 8.2 Kubernetes 部署

#### 命名空间划分
```
usermanagement-dev      # 开发环境
usermanagement-test     # 测试环境
usermanagement-sit      # 集成测试
usermanagement-uat      # 用户验收
usermanagement-prod     # 生产环境
```

#### 资源配额
```yaml
# production namespace
apiVersion: v1
kind: ResourceQuota
metadata:
  name: usermanagement-quota
  namespace: usermanagement-prod
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "20"
```

#### HPA 配置
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: usermanagement-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: usermanagement-app
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 8.3 环境配置

| 环境 | 目的 | 数据库 | Redis | 副本数 |
|------|------|--------|-------|--------|
| Local | 本地开发 | H2 | 嵌入式 | 1 |
| Dev | 团队开发 | PostgreSQL | 单节点 | 1 |
| SIT | 集成测试 | PostgreSQL | 集群 | 2 |
| UAT | 用户验收 | PostgreSQL 主从 | 集群 | 3 |
| Prod | 生产 | PostgreSQL 主从+只读 | 集群 | 5+ |

---

## 9. 性能优化策略

### 9.1 高并发登录优化（增强）

#### 目标: 10000 TPS < 100ms

```
┌─────────────────────────────────────────────────────────────┐
│                    登录性能优化策略                          │
└─────────────────────────────────────────────────────────────┘

1. 连接池优化
   - SQLAlchemy async + asyncpg: pool size = 50, max overflow = 10
   - pool timeout = 5s, pool recycle = 10min
   - pool_pre_ping: 保持连接活性

2. Redis优化
   - redis-py async 连接池: max connections = 100
   - Pipeline批量操作: 登录计数 + 会话存储 + 权限缓存
   - 集群模式: 读写分离，主从架构
   - 本地缓存: cachetools 二级缓存热点数据

3. JWT生成优化
   - 预生成RSA密钥对 (启动时加载到内存)
   - 复用 python-jose 编码器
   - 缓存生成的Token签名

4. 审计日志异步化
   - aiokafka缓冲: 高吞吐量，顺序写入
   - 批量消费: 每批1000条，减少数据库写入次数
   - 失败重试: 指数退避重试机制

5. 数据库优化
   - 用户表索引: email (唯一), status, department_id
   - 分区表: 审计日志按月分区，登录日志按日分区
   - 查询优化: selectinload/joinedload避免N+1问题
   - 读写分离: 登录验证走主库，权限查询走从库

6. 进程与事件循环优化
   - uvloop: 替换默认 asyncio 事件循环，降低 IO 延迟
   - gunicorn 多 worker: 每核 1-2 个 worker 进程水平扩展
   - worker 内存上限 + --max-requests 重启防内存增长
   - CPU 密集任务移至进程池，避免阻塞事件循环

7. 网络优化
   - HTTP/2: 减少连接建立开销
   - 连接复用: Keep-Alive
   - 压缩: Gzip响应压缩
```

#### 登录流程性能优化

**优化前流程**：
```
1. 验证邮箱密码 (DB查询 + BCrypt比对)
2. 检查账户状态 (DB查询)
3. 检查登录失败计数 (Redis查询)
4. 生成JWT Token (RSA签名)
5. 存储会话 (Redis写入)
6. 记录审计日志 (Kafka写入)
7. 返回响应
```

**优化后流程**：
```
并行执行:
┌─────────────────────────────────────────────────────────────┐
│ 主线程:                                                    │
│ 1. 验证邮箱密码 (DB查询 + BCrypt比对)                       │
│ 2. 检查账户状态 (DB查询)                                    │
│ 3. Pipeline操作Redis:                                      │
│    - 获取登录失败计数                                        │
│    - 存储会话信息                                           │
│    - 缓存用户权限                                           │
│ 4. 生成JWT Token (使用缓存的密钥)                           │
│ 5. 返回响应                                                │
│                                                            │
│ 异步线程:                                                  │
│ 1. 发送审计日志到Kafka                                      │
│ 2. 更新最后登录时间 (异步DB更新)                            │
└─────────────────────────────────────────────────────────────┘
```

#### 具体优化实现

**Redis Pipeline优化**：
```python
class LoginService:

    def __init__(self, redis: Redis, user_repo: UserRepository, jwt: JWTService):
        self.redis = redis
        self.user_repo = user_repo
        self.jwt = jwt

    async def login(self, request: LoginRequest) -> LoginResponse:
        # 使用 Pipeline 批量操作 Redis
        async with self.redis.pipeline(transaction=False) as pipe:
            # 1. 获取登录失败计数
            pipe.get(f"login:failed:{request.email}")
            # 2. 存储会话信息
            pipe.setex(f"session:{user_id}:{session_id}", 900, jwt_token)
            # 3. 缓存用户权限 + 设置过期
            pipe.sadd(f"user:permissions:{user_id}", *[p.code for p in permissions])
            pipe.expire(f"user:permissions:{user_id}", 300)
            results = await pipe.execute()

        failed_count = int(results[0] or 0)
        # ... 其他结果处理
```

**异步日志处理**：
```python
class AuditLogHandler:

    def __init__(self, producer: aiokafka.AIOKafkaProducer, executor: ThreadPoolExecutor):
        self.producer = producer
        self.executor = executor

    async def handle_login_event(self, event: LoginSuccessEvent) -> None:
        log_event = AuditLogEvent(
            user_id=event.user_id,
            operation="LOGIN",
            resource_type="USER",
            resource_id=event.user_id,
            client_ip=event.client_ip,
            user_agent=event.user_agent,
            success=True,
            timestamp=datetime.utcnow(),
        )
        # 发送到 Kafka，不阻塞主线程
        await self.producer.send_and_wait("audit-log", log_event.model_dump_json())


# 线程池配置（用于 CPU 密集型或阻塞型后台任务）
def build_audit_executor() -> ThreadPoolExecutor:
    return ThreadPoolExecutor(
        max_workers=20,
        thread_name_prefix="audit-log-",
    )
```

#### 性能监控与调优

**关键监控指标**：
```yaml
metrics:
  login:
    response_time: histogram
    tps: meter
    error_rate: gauge
  redis:
    command_latency: histogram
    memory_usage: gauge
    hit_rate: gauge
  database:
    query_time: histogram
    connection_pool: gauge
    slow_queries: counter
```

**压力测试策略**：
1. **基准测试**：单用户，测量基础响应时间
2. **负载测试**：逐步增加并发用户，找到性能拐点
3. **压力测试**：超过设计容量的压力，测试系统极限
4. **稳定性测试**：长时间运行，检测内存泄漏
5. **恢复测试**：故障后恢复能力测试

### 9.2 缓存优化

| 场景 | 优化策略 | 预期提升 |
|------|----------|----------|
| 用户权限查询 | Redis缓存 + 本地缓存 | 从DB 50ms → 本地5ms |
| 部门树查询 | Redis缓存 + 预加载 | 从递归查询100ms → 缓存1ms |
| 登录会话 | Redis + Session共享 | 支持水平扩展 |
| 热点用户 | cachetools 本地缓存 | 减少Redis压力 |

### 9.3 数据库优化

#### 索引策略
```sql
-- 用户表索引
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_user_department ON user(department_id);
CREATE INDEX idx_user_status ON user(status);
CREATE INDEX idx_user_created ON user(created_at);

-- 审计日志索引
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_time ON audit_log(created_at);
CREATE INDEX idx_audit_operation ON audit_log(operation_type);

-- 部门表索引
CREATE INDEX idx_dept_path ON department(path);
CREATE INDEX idx_dept_parent ON department(parent_id);
```

### 9.4 监控与告警

#### 关键指标

| 指标类别 | 指标名 | 告警阈值 |
|----------|--------|----------|
| **性能** | API响应时间 P95 | > 200ms |
| **性能** | 登录响应时间 | > 100ms |
| **可用性** | 错误率 | > 1% |
| **资源** | CPU使用率 | > 80% |
| **资源** | 内存使用率 | > 85% |
| **资源** | 磁盘使用率 | > 80% |
| **业务** | 登录失败率 | > 10% |
| **安全** | 暴力破解尝试 | > 100次/分钟 |

#### 监控架构
```
Application ──► prometheus_client ──► Prometheus ──► Grafana
                     │
                     ▼
               AlertManager ──► 邮件/短信/钉钉
```

---

## 10. 附录

### 10.1 参考文档

- [ADR-001-技术栈选择](./adr/ADR-001-技术栈选择.md)
- [ADR-002-认证方案](./adr/ADR-002-认证方案.md)
- [ADR-003-高并发架构](./adr/ADR-003-高并发架构.md)
- [ADR-004-数据库设计](./adr/ADR-004-数据库设计.md)
- [ADR-005-缓存策略](./adr/ADR-005-缓存策略.md)
- [ADR-006-消息队列选择](./adr/ADR-006-消息队列选择.md)
- [ADR-007-部门树形结构设计](./adr/ADR-007-部门树形结构设计.md)

### 10.2 架构图目录

- [系统上下文图](./DIAGRAMS/system-context.md)
- [容器图](./DIAGRAMS/container-diagram.md)
- [组件图](./DIAGRAMS/component-diagram.md)
- [部署图](./DIAGRAMS/deployment-diagram.md)

### 10.3 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| 1.1 | 2026-03-27 | 系统架构师 | 根据FRD v1.2更新：增强部门管理、系统配置、数据权限、性能优化等模块设计 |
| 1.0 | 2026-03-24 | 系统架构师 | 初始版本，完整系统架构设计 |
