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
| **编程语言** | Java | JDK 21 | LTS版本，虚拟线程支持高并发 |
| **应用框架** | Spring Boot | 3.5.x | 企业级标准，生态丰富 |
| **数据访问** | Spring Data JPA | 3.5.x | 简化数据库操作 |
| **数据库** | PostgreSQL | 15+ | JSONB支持，性能优秀 |
| **缓存** | Redis | 7+ | 高性能分布式缓存 |
| **消息队列** | Kafka | 3+ | 高吞吐审计日志处理 |
| **安全框架** | Spring Security | 6.x | 标准安全实现 |
| **文档生成** | SpringDoc OpenAPI | 2.x | 自动生成API文档 |
| **数据库迁移** | Flyway | 10.x | 版本化数据库管理 |
| **构建工具** | Maven | 3.9+ | 依赖管理 |

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
├── src/main/java/com/usermanagement/
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
```java
@Component
public class DataPermissionInterceptor {

    @Autowired
    private DepartmentService departmentService;

    public Specification<User> applyDataPermission(UserDetails userDetails, String dataScope) {
        CustomUserDetails user = (CustomUserDetails) userDetails;

        switch (dataScope) {
            case "ALL":
                return null; // 无过滤

            case "DEPT":
                return createDepartmentFilter(user.getDepartmentId());

            case "SELF":
                return (root, query, cb) ->
                    cb.equal(root.get("createdBy"), user.getId());

            case "CUSTOM":
                return createCustomFilter(user.getRole().getDataConditions());

            default:
                throw new IllegalArgumentException("未知的数据权限范围: " + dataScope);
        }
    }

    private Specification<User> createDepartmentFilter(UUID departmentId) {
        return (root, query, cb) -> {
            List<UUID> accessibleDeptIds = departmentService
                .getSubDepartmentIds(departmentId);
            accessibleDeptIds.add(departmentId);

            return root.get("departmentId").in(accessibleDeptIds);
        };
    }
}
```

#### 角色继承管理

**多继承支持**：
```java
@Entity
@Table(name = "role")
public class Role {

    @Id
    private UUID id;

    private String name;
    private String code;

    @Enumerated(EnumType.STRING)
    private DataScope dataScope;

    @ManyToMany
    @JoinTable(
        name = "role_permission",
        joinColumns = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private Set<Permission> permissions = new HashSet<>();

    @ManyToMany
    @JoinTable(
        name = "role_inheritance",
        joinColumns = @JoinColumn(name = "child_role_id"),
        inverseJoinColumns = @JoinColumn(name = "parent_role_id")
    )
    private Set<Role> parentRoles = new HashSet<>();

    // 获取所有权限（包括继承的）
    public Set<Permission> getAllPermissions() {
        Set<Permission> allPermissions = new HashSet<>(this.permissions);

        for (Role parent : parentRoles) {
            allPermissions.addAll(parent.getAllPermissions());
        }

        return allPermissions;
    }
}
```

**循环继承检测**：
```java
@Service
public class RoleService {

    public void addParentRole(UUID childRoleId, UUID parentRoleId) {
        // 检查是否形成循环
        if (isCircularInheritance(childRoleId, parentRoleId)) {
            throw new BusinessException("不能形成循环继承关系");
        }

        Role child = roleRepository.findById(childRoleId).orElseThrow();
        Role parent = roleRepository.findById(parentRoleId).orElseThrow();

        child.getParentRoles().add(parent);
        roleRepository.save(child);

        // 清除相关用户的权限缓存
        clearUserPermissionCache(childRoleId);
    }

    private boolean isCircularInheritance(UUID startRoleId, UUID targetRoleId) {
        if (startRoleId.equals(targetRoleId)) {
            return true;
        }

        Role targetRole = roleRepository.findById(targetRoleId).orElseThrow();
        Set<Role> visited = new HashSet<>();
        Queue<Role> queue = new LinkedList<>();
        queue.add(targetRole);

        while (!queue.isEmpty()) {
            Role current = queue.poll();
            if (visited.contains(current)) {
                continue;
            }
            visited.add(current);

            if (current.getId().equals(startRoleId)) {
                return true;
            }

            queue.addAll(current.getParentRoles());
        }

        return false;
    }
}
```

#### 权限模板机制

**权限模板实体**：
```java
@Entity
@Table(name = "permission_template")
public class PermissionTemplate {

    @Id
    private UUID id;

    private String name;
    private String code;
    private String description;

    @Enumerated(EnumType.STRING)
    private TemplateType type; // DEPARTMENT_MANAGER, END_USER, AUDITOR等

    @ManyToMany
    @JoinTable(
        name = "template_permission",
        joinColumns = @JoinColumn(name = "template_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id")
    )
    private Set<Permission> permissions = new HashSet<>();

    @Enumerated(EnumType.STRING)
    private DataScope defaultDataScope;

    private String version;
    private boolean isActive = true;
}
```

**应用模板创建角色**：
```java
@Service
public class TemplateService {

    @Transactional
    public Role createRoleFromTemplate(CreateRoleFromTemplateRequest request) {
        PermissionTemplate template = templateRepository
            .findByCodeAndActiveTrue(request.getTemplateCode())
            .orElseThrow(() -> new TemplateNotFoundException(request.getTemplateCode()));

        Role role = new Role();
        role.setName(request.getRoleName());
        role.setCode(generateRoleCode(request.getRoleName()));
        role.setDataScope(template.getDefaultDataScope());
        role.setPermissions(new HashSet<>(template.getPermissions()));

        // 可选的权限调整
        if (request.getAdditionalPermissions() != null) {
            role.getPermissions().addAll(request.getAdditionalPermissions());
        }

        if (request.getExcludedPermissions() != null) {
            role.getPermissions().removeAll(request.getExcludedPermissions());
        }

        return roleRepository.save(role);
    }
}
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
```java
@Service
public class DepartmentService {

    @Cacheable(value = "departmentSubtree", key = "#rootId")
    public List<DepartmentDTO> getSubtree(UUID rootId) {
        String path = departmentRepository.findPathById(rootId);
        return departmentRepository.findByPathStartingWith(path + "/");
    }

    public List<UUID> getSubDepartmentIds(UUID departmentId) {
        String path = departmentRepository.findPathById(departmentId);
        return departmentRepository.findIdsByPathStartingWith(path + "/");
    }
}
```

**更新部门层级**：
```java
@Transactional
public DepartmentDTO updateDepartmentParent(UUID departmentId, UUID newParentId) {
    // 1. 检查循环依赖
    if (isCircularDependency(departmentId, newParentId)) {
        throw new BusinessException("不能形成循环依赖");
    }

    // 2. 获取旧路径和新路径
    String oldPath = departmentRepository.findPathById(departmentId);
    String newParentPath = departmentRepository.findPathById(newParentId);
    String newPath = newParentPath + "/" + departmentId;

    // 3. 更新当前部门
    departmentRepository.updatePath(departmentId, newPath);

    // 4. 更新所有子部门的路径
    departmentRepository.updateSubtreePaths(oldPath, newPath);

    // 5. 清除缓存
    cacheManager.evict("departmentTree");
    cacheManager.evict("departmentSubtree:*");

    return getDepartment(departmentId);
}
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
```java
@Service
public class ConfigService {

    @Cacheable(value = "systemConfig", key = "#configKey")
    public String getConfigValue(String configKey) {
        SystemConfig config = configRepository.findByConfigKey(configKey)
            .orElseThrow(() -> new ConfigNotFoundException(configKey));

        if (config.isEncrypted()) {
            return decrypt(config.getConfigValue());
        }
        return config.getConfigValue();
    }

    @CacheEvict(value = "systemConfig", key = "#configKey")
    @Transactional
    public void updateConfig(String configKey, String value, UUID userId) {
        SystemConfig config = configRepository.findByConfigKey(configKey)
            .orElseGet(() -> new SystemConfig(configKey));

        if (config.isEncrypted()) {
            config.setConfigValue(encrypt(value));
        } else {
            config.setConfigValue(value);
        }

        config.setUpdatedBy(userId);
        configRepository.save(config);

        // 发布配置变更事件
        eventPublisher.publishEvent(new ConfigChangedEvent(configKey, value));
    }
}
```

**动态安全策略应用**：
```java
@Configuration
@ConfigurationProperties(prefix = "security.policy")
@RefreshScope
public class SecurityPolicyConfig {

    private PasswordPolicy passwordPolicy;
    private LoginPolicy loginPolicy;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(passwordPolicy.getStrength());
    }

    @Bean
    public AuthenticationManager authenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        provider.setHideUserNotFoundExceptions(false);
        return new ProviderManager(Collections.singletonList(provider));
    }
}
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
操作发生 → AOP拦截器 → 日志收集 → Kafka Topic
                                         ↓
                              Log Consumer Service
                                         ↓
                    ┌──────────┬──────────┬──────────┐
                    ↓          ↓          ↓          ↓
              PostgreSQL   Elasticsearch  告警检查   导出服务
              (audit_log)   (搜索优化)    (实时)    (异步生成)
```

#### 日志导出服务
```java
@Service
public class AuditLogExportService {

    @Async
    public ExportTask exportLogs(ExportRequest request, UUID userId) {
        // 1. 创建导出任务
        ExportTask task = createExportTask(request, userId);

        // 2. 异步查询数据
        List<AuditLog> logs = auditLogRepository.findByCriteria(request);

        // 3. 生成导出文件
        byte[] fileContent;
        switch (request.getFormat()) {
            case EXCEL:
                fileContent = generateExcel(logs);
                break;
            case PDF:
                fileContent = generatePdf(logs);
                break;
            case CSV:
                fileContent = generateCsv(logs);
                break;
            default:
                throw new UnsupportedFormatException(request.getFormat());
        }

        // 4. 保存到文件存储
        String fileUrl = fileStorageService.saveExportFile(task.getId(), fileContent);

        // 5. 更新任务状态
        task.complete(fileUrl);
        return taskRepository.save(task);
    }
}
```

#### 个人登录历史
```java
@RestController
@RequestMapping("/api/v1/users/me")
public class UserProfileController {

    @GetMapping("/login-history")
    @PreAuthorize("isAuthenticated()")
    public Page<LoginHistoryDTO> getLoginHistory(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        UUID userId = ((CustomUserDetails) userDetails).getId();
        return auditLogService.getUserLoginHistory(userId, page, size);
    }
}
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
│   (Browser) │     │  (Spring Boot)│    │  (Cache)    │
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
| **L1: Local Cache** | 热点数据 | 5分钟 | Caffeine |
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
            │注入SecurityContext
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
```java
// 权限检查注解
@PreAuthorize("hasPermission('user:create')")
public User createUser(CreateUserRequest request) {
    // ...
}

// 数据权限过滤
@PostFilter("hasDataPermission(filterObject, 'DEPT')")
public List<User> listUsers(Department dept) {
    // ...
}
```

### 7.3 安全防护

| 威胁 | 防护措施 | 实现方式 |
|------|----------|----------|
| **暴力破解** | 登录失败锁定 | Redis计数，5次失败锁定30分钟 |
| **重放攻击** | Token唯一性 | JWT jti + 黑名单检查 |
| **CSRF攻击** | CSRF Token | SameSite Cookie + Token验证 |
| **XSS攻击** | 输入过滤 | 输出编码 + Content Security Policy |
| **SQL注入** | 参数化查询 | JPA + PreparedStatement |
| **敏感数据泄露** | 加密存储 | AES-256加密敏感字段 |
| **越权访问** | 权限校验 | 方法级安全注解 |
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
| app | usermanagement/app | 8080 | 2GB | 1核 |
| nginx | nginx:alpine | 80/443 | 256MB | 0.5核 |
| postgres | postgres:15 | 5432 | 4GB | 2核 |
| redis | redis:7-alpine | 6379 | 1GB | 0.5核 |
| kafka | confluentinc/cp-kafka | 9092 | 2GB | 1核 |

#### Dockerfile 示例
```dockerfile
# 多阶段构建
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN ./mvnw clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
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
   - HikariCP: max pool size = 50, min idle = 10
   - connection timeout = 5s, idle timeout = 10min
   - validation query: SELECT 1

2. Redis优化
   - Lettuce连接池: pool size = 100
   - Pipeline批量操作: 登录计数 + 会话存储 + 权限缓存
   - 集群模式: 读写分离，主从架构
   - 本地缓存: Caffeine二级缓存热点数据

3. JWT生成优化
   - 预生成RSA密钥对 (启动时加载到内存)
   - 使用线程安全的JWT库
   - 缓存生成的Token签名

4. 审计日志异步化
   - Kafka缓冲: 高吞吐量，顺序写入
   - 批量消费: 每批1000条，减少数据库写入次数
   - 失败重试: 指数退避重试机制

5. 数据库优化
   - 用户表索引: email (唯一), status, department_id
   - 分区表: 审计日志按月分区，登录日志按日分区
   - 查询优化: EntityGraph避免N+1问题
   - 读写分离: 登录验证走主库，权限查询走从库

6. JVM优化
   - G1GC: -XX:+UseG1GC -XX:MaxGCPauseMillis=200
   - Heap: -Xms4g -Xmx4g (根据实际内存调整)
   - Metaspace: -XX:MetaspaceSize=512m -XX:MaxMetaspaceSize=1g
   - 虚拟线程: -Dspring.threads.virtual.enabled=true

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
```java
@Service
public class LoginService {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    public LoginResponse login(LoginRequest request) {
        // 使用Pipeline批量操作Redis
        List<Object> results = redisTemplate.executePipelined(
            new RedisCallback<Object>() {
                @Override
                public Object doInRedis(RedisConnection connection) {
                    // 1. 获取登录失败计数
                    connection.get(("login:failed:" + request.getEmail()).getBytes());

                    // 2. 存储会话信息
                    String sessionKey = "session:" + userId + ":" + sessionId;
                    connection.setEx(sessionKey.getBytes(), 900, jwtToken.getBytes());

                    // 3. 缓存用户权限
                    String permissionKey = "user:permissions:" + userId;
                    connection.sAdd(permissionKey.getBytes(),
                        permissions.stream().map(p -> p.getCode().getBytes()).toArray(byte[][]::new));
                    connection.expire(permissionKey.getBytes(), 300);

                    return null;
                }
            }
        );

        // 处理Pipeline结果
        Integer failedCount = (Integer) results.get(0);
        // ... 其他结果处理
    }
}
```

**异步日志处理**：
```java
@Component
public class AuditLogAspect {

    @Autowired
    private KafkaTemplate<String, AuditLogEvent> kafkaTemplate;

    @Async("auditLogExecutor")
    @EventListener
    public void handleLoginEvent(LoginSuccessEvent event) {
        AuditLogEvent logEvent = AuditLogEvent.builder()
            .userId(event.getUserId())
            .operation("LOGIN")
            .resourceType("USER")
            .resourceId(event.getUserId())
            .clientIp(event.getClientIp())
            .userAgent(event.getUserAgent())
            .success(true)
            .timestamp(Instant.now())
            .build();

        // 发送到Kafka，不阻塞主线程
        kafkaTemplate.send("audit-log", logEvent);
    }
}

@Configuration
public class AsyncConfig {

    @Bean("auditLogExecutor")
    public Executor auditLogExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(10000);
        executor.setThreadNamePrefix("audit-log-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
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
| 热点用户 | Caffeine本地缓存 | 减少Redis压力 |

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
Application ──► Micrometer ──► Prometheus ──► Grafana
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
