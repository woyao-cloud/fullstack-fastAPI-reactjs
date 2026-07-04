# Docker Compose 部署文件清单

## 概述

本文档列出了为本地开发环境和 Team 环境创建的所有 Docker Compose 相关文件。

## 文件结构

```
usermanagement/
├── docker-compose.yml                    # 本地开发环境主配置
├── docker-compose.team.yml               # Team 环境主配置
├── docker-compose.dev.yml                # 原有配置（保留）
├── DEPLOYMENT_GUIDE.md                   # 部署指南（已更新）
│
├── backend/
│   ├── Dockerfile                        # 后端生产环境 Dockerfile
│   ├── Dockerfile.dev                    # 后端开发环境 Dockerfile
│   └── src/main/resources/
│       └── application-team.yml          # Team 环境 Spring Boot 配置
│
├── frontend/
│   ├── Dockerfile                        # 前端生产环境 Dockerfile
│   └── Dockerfile.dev                    # 前端开发环境 Dockerfile
│
├── scripts/
│   ├── test-data/                        # 测试数据脚本（测试工程师提供）
│   │   ├── 01-departments.sql
│   │   ├── 02-roles.sql
│   │   ├── 03-permissions.sql
│   │   ├── 04-role-permissions.sql
│   │   ├── 05-users.sql
│   │   ├── 06-user-roles.sql
│   │   ├── init-test-data.sh            # Linux/macOS 执行脚本
│   │   ├── init-test-data.bat           # Windows 执行脚本
│   │   ├── README.md                    # 测试数据说明
│   │   └── DOCKER_INTEGRATION.md        # Docker 集成说明
│   │
│   └── docker/                           # Docker 辅助脚本和配置
│       ├── wait-for-db.sh               # 数据库等待脚本
│       ├── redis.conf                   # Redis 配置文件
│       ├── pgadmin-servers.json         # pgAdmin 本地配置
│       ├── pgadmin-servers-team.json    # pgAdmin Team 配置
│       ├── nginx.team.conf              # Nginx 反向代理配置
│       ├── prometheus.yml               # Prometheus 监控配置
│       ├── init-scripts/
│       │   └── 01-init-extensions.sql   # PostgreSQL 初始化
│       └── grafana/
│           ├── dashboards/
│           │   └── dashboard.yml        # Grafana 仪表板配置
│           └── datasources/
│               └── datasource.yml       # Grafana 数据源配置
```

## 文件说明

### Docker Compose 配置

| 文件 | 用途 | 环境 | 说明 |
|------|------|------|------|
| `docker-compose.yml` | 本地开发 | 本地开发 | 包含热重载、调试、MailHog |
| `docker-compose.team.yml` | Team 环境 | 团队共享 | 包含监控、Nginx 代理 |
| `docker-compose.dev.yml` | 旧配置 | - | 保留原有配置 |

### Dockerfile

| 文件 | 用途 | 说明 |
|------|------|------|
| `backend/Dockerfile` | 后端生产 | 多阶段构建、JVM 优化、健康检查 |
| `backend/Dockerfile.dev` | 后端开发 | 热重载、远程调试 (5005) |
| `frontend/Dockerfile` | 前端生产 | Next.js standalone、多阶段构建 |
| `frontend/Dockerfile.dev` | 前端开发 | Node 开发模式、热重载 |

### 配置文件

| 文件 | 用途 | 说明 |
|------|------|------|
| `application-team.yml` | Spring Boot | Team 环境配置 |
| `redis.conf` | Redis | 性能优化配置 |
| `nginx.team.conf` | Nginx | 反向代理配置 |
| `prometheus.yml` | Prometheus | 监控指标配置 |
| `grafana/*` | Grafana | 数据源和仪表板配置 |
| `wait-for-db.sh` | 辅助脚本 | 等待数据库就绪 |
| `init-scripts/01-init-extensions.sql` | PostgreSQL | 扩展初始化 |
| `init-scripts/02-init-database.sh` | PostgreSQL | 自动建表和数据初始化 |

### 测试数据脚本

| 文件 | 用途 | 说明 |
|------|------|------|
| `01-departments.sql` | 部门数据 | 12 个部门 |
| `02-roles.sql` | 角色数据 | 16 种角色 |
| `03-permissions.sql` | 权限数据 | 30+ 权限 |
| `04-role-permissions.sql` | 角色权限关联 | 按角色分配 |
| `05-users.sql` | 用户数据 | 35+ 测试用户 |
| `06-user-roles.sql` | 用户角色关联 | 按用户分配 |

## 快速启动命令

### 本地开发环境

```bash
# 启动基础服务
docker-compose up -d postgres redis zookeeper kafka

# 初始化数据库（自动执行建表脚本 + 测试数据）
# 建表脚本: backend/src/main/resources/db/migration/V*.sql
# 测试数据: scripts/test-data/*.sql
docker-compose --profile seed run --rm db-seed

# 启动前后端
docker-compose up -d backend frontend

# 查看状态
docker-compose ps

# 访问地址
# 前端: http://localhost:3000
# 后端: http://localhost:8080
# pgAdmin: http://localhost:5050
# Kafka UI: http://localhost:8081
# MailHog: http://localhost:8025
```

### Team 环境

```bash
# 构建镜像
docker-compose -f docker-compose.team.yml build

# 启动所有服务
docker-compose -f docker-compose.team.yml up -d

# 查看状态
docker-compose -f docker-compose.team.yml ps

# 访问地址
# 统一入口: http://localhost
# pgAdmin: http://localhost:5050
# Kafka UI: http://localhost:8081
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
```

## 环境变量

### 本地开发环境

```bash
# 可选配置
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=user_management
export DB_USER=devuser
export DB_PASSWORD=devpassword
```

### Team 环境

```bash
# 必需
export JWT_SECRET_KEY="your-256-bit-secret-key"

# 可选
export PGADMIN_EMAIL="admin@example.com"
export PGADMIN_PASSWORD="admin123"
export GRAFANA_USER="admin"
export GRAFANA_PASSWORD="admin123"
export BUILD_NUMBER="latest"
```

## 测试账号

所有测试账号密码为：`Test@123`

| 账号 | 角色 |
|------|------|
| superadmin@test.com | 超级管理员 |
| admin@test.com | 系统管理员 |
| tech.lead@test.com | 技术总监 |
| fe.dev1@test.com | 前端开发 |
| be.dev1@test.com | 后端开发 |
| qa.tester1@test.com | 测试工程师 |

## 端口映射

### 本地开发环境

| 服务 | 端口 |
|------|------|
| PostgreSQL | 5432 |
| Redis | 6379 |
| Zookeeper | 2181 |
| Kafka | 9092, 29092 |
| Kafka UI | 8081 |
| Backend | 8080, 5005 (调试) |
| Frontend | 3000 |
| pgAdmin | 5050 |
| MailHog | 1025, 8025 |

### Team 环境

| 服务 | 端口 |
|------|------|
| Nginx | 80, 443 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| pgAdmin | 5050 |
| Kafka UI | 8081 |
| Grafana | 3001 |
| Prometheus | 9090 |

## 故障排查

### 常见问题

1. **数据库连接失败**
   ```bash
   docker-compose exec postgres pg_isready -U devuser -d user_management
   ```

2. **端口被占用**
   ```bash
   # Linux/macOS
   sudo lsof -i :8080

   # Windows
   netstat -ano | findstr :8080
   ```

3. **内存不足**
   - Docker Desktop -> Settings -> Resources -> Memory

4. **测试数据初始化失败**
   ```bash
   # 检查脚本执行顺序
   ls -la scripts/test-data/*.sql

   # 手动执行
   ./scripts/test-data/init-test-data.sh
   ```

## 维护信息

- **创建日期**: 2026-03-25
- **维护者**: 部署工程师
- **相关文档**:
  - `DEPLOYMENT_GUIDE.md` - 详细部署指南
  - `scripts/test-data/README.md` - 测试数据说明
  - `scripts/test-data/DOCKER_INTEGRATION.md` - Docker 集成说明
