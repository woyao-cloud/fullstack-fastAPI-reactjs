# 多环境部署架构文档

> 本文档基于规划文件: `.claude/plans/partitioned-enchanting-coral.md`

## 概述

本项目采用 **5环境部署架构**，支持从本地开发到生产环境的完整软件交付流程。

```
本地开发 → Team开发 → SIT测试 → UAT预发布 → 生产环境
```

---

## 环境详情

### 1. 本地开发环境 (Local Dev)

| 属性 | 配置 |
|------|------|
| **用途** | 开发者本地编码调试、单元测试 |
| **部署方式** | Docker Compose |
| **PostgreSQL** | Docker容器 (端口5432) |
| **Redis** | Docker容器 (端口6379) |
| **数据** | 独立测试数据集 |
| **访问** | localhost |

**启动命令**:
```bash
docker-compose -f docker-compose.local.yml up -d
```

---

### 2. Team开发环境 (Team Dev)

| 属性 | 配置 |
|------|------|
| **用途** | 团队共享开发、前后端联调 |
| **部署方式** | Docker Compose |
| **PostgreSQL** | Docker容器，命名卷持久化 |
| **Redis** | Docker容器，会话共享 |
| **数据** | 共享测试数据集 |
| **访问** | 内部网络 |

**启动命令**:
```bash
docker-compose -f docker-compose.team.yml up -d
```

---

### 3. SIT测试环境 (System Integration Test)

| 属性 | 配置 |
|------|------|
| **用途** | 系统集成测试、性能测试 |
| **部署方式** | Kubernetes |
| **PostgreSQL** | 云RDS实例 |
| **Redis** | 云缓存服务 |
| **数据** | 预发布测试数据 |
| **访问** | 受限内网 |

**部署流程**:
```bash
kubectl apply -f k8s/sit/
```

---

### 4. UAT预发布环境 (User Acceptance Test)

| 属性 | 配置 |
|------|------|
| **用途** | 用户验收测试、业务方验证 |
| **部署方式** | Kubernetes |
| **PostgreSQL** | 云RDS实例 (接近生产规格) |
| **Redis** | Redis集群 (小规格) |
| **数据** | 生产脱敏数据 |
| **访问** | 受限访问 (业务方可访问) |

**与SIT的区别**:
- 数据规模更大（接近生产）
- 使用生产脱敏数据
- 业务方可访问验证
- 配置规格接近生产

**部署流程**:
```bash
kubectl apply -f k8s/uat/
```

---

### 5. 生产环境 (Production)

| 属性 | 配置 |
|------|------|
| **用途** | 正式业务运行 |
| **部署方式** | Kubernetes |
| **PostgreSQL** | 云RDS主从集群 |
| **Redis** | Redis Cluster/Sentinel |
| **数据** | 真实业务数据 |
| **访问** | 公网/专线 |
| **备份** | 自动备份 + 异地灾备 |

**部署流程**:
```bash
# 需要审批流程
kubectl apply -f k8s/prod/
```

---

## 数据库管理

### Alembic迁移

所有环境使用 **Alembic** 统一管理数据库迁移。

| 脚本类型 | 命名规则 | 示例 |
|----------|----------|------|
| 版本化迁移 | `{序号}_{描述}.py` | `0001_initial_schema.py` |
| 自动生成 | `alembic revision --autogenerate` | 生成 upgrade/downgrade |

### 数据种子策略

```
backend/alembic/
├── versions/            # 迁移脚本（所有环境）
├── data/
│   ├── local/          # 本地开发数据
│   ├── team/           # Team开发数据
│   └── common/         # 通用基础数据（所有环境）
└── test/               # 测试专用数据
```

---

## 配置管理

### 多环境配置



### 敏感信息管理

| 环境 | 管理方式 |
|------|----------|
| 本地/Team | `.env` 文件（不提交Git） |
| SIT/UAT | CI/CD Secrets |
| 生产 | Kubernetes Secrets / 云密钥管理服务 |

---

## 数据流向

```
生产环境
    ↓ (脱敏导出)
UAT预发布
    ↓ (脱敏导出)
SIT测试

Team开发 ──→ 本地开发 (SQL导出，协作调试)
```

**禁止**的数据流向:
- UAT → SIT
- 本地/Team → 上游环境

---

## 部署流程

### 完整发布流程

```
1. 本地开发验证
   └── 开发者本地测试通过
       ↓
2. Team开发联调
   └── 前后端联调通过
       ↓
3. SIT系统集成测试
   └── 自动化测试 + 性能测试通过
       ↓
4. UAT用户验收测试
   └── 业务方验收通过
       ↓
5. 生产环境发布
   └── 审批后部署上线
```

---

## 环境资源对比

| 资源 | 本地 | Team | SIT | UAT | 生产 |
|------|------|------|-----|-----|------|
| **PostgreSQL** | 单容器 | 单容器 | 云RDS | 云RDS | 高可用集群 |
| **Redis** | 单容器 | 单容器 | 云缓存 | 集群 | 高可用集群 |
| **应用副本** | 1 | 1 | 2 | 2-3 | 3+ |
| **监控级别** | 日志 | 日志 | 监控 | 监控+告警 | 监控+告警+SLA |
| **备份策略** | 无 | 每周 | 每日 | 每日 | 实时+异地 |

---

## 故障排查

### 常见问题

**Q: 本地开发数据库连接失败**
```bash
# 检查容器状态
docker-compose -f docker-compose.local.yml ps

# 查看日志
docker-compose -f docker-compose.local.yml logs postgres
```

**Q: Alembic迁移失败**
```bash
# 检查迁移状态
alembic current
alembic history

# 修复后重新执行
alembic downgrade -1
alembic upgrade head
```

**Q: 环境数据不一致**
- 使用统一的数据种子脚本
- 定期同步Team环境数据到本地
- 禁止手动修改数据库结构

---

## 相关文档

- [部署指南](./DEPLOYMENT_GUIDE.md) - 详细部署步骤
- [数据库设计](./DATABASE_SCHEMA.md) - 表结构设计
- [后端架构](./BACKEND_ARCHITECTURE.md) - 应用架构
- [测试策略](./TESTING_STRATEGY.md) - 测试流程
