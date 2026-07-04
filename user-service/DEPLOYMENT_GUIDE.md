# 部署指南

## 概述

本文档供部署工程师使用，说明如何在本地开发环境和 Team 共享环境中部署用户管理系统。

## 环境架构总览

### 5环境部署架构

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   本地开发    │ →  │  Team开发   │ →  │   SIT测试   │ →  │  UAT预发布  │ →  │   生产环境   │
│  (Docker)   │    │  (Docker)   │    │    (K8s)    │    │    (K8s)    │    │    (K8s)    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 环境对比

| 环境 | 用途 | 部署方式 | PostgreSQL | Redis | 数据策略 |
|------|------|----------|------------|-------|----------|
| **本地开发** | 个人开发调试 | Docker Compose | 单容器 | 单容器 | 测试数据集 |
| **Team开发** | 团队协作联调 | Docker Compose | 单容器 | 单容器 | 共享测试数据 |
| **SIT测试** | 系统集成测试 | Kubernetes | 云RDS实例 | 云缓存 | 预发布数据 |
| **UAT预发布** | 用户验收测试 | Kubernetes | 云RDS实例 | Redis集群 | 生产脱敏数据 |
| **生产环境** | 正式业务运行 | Kubernetes | 云RDS集群 | Redis集群 | 生产数据 |

## 快速启动

### 本地开发环境

```bash
# 1. 启动基础服务（数据库、缓存、消息队列）
docker-compose up -d postgres redis zookeeper kafka

# 2. 等待数据库就绪
docker-compose exec postgres pg_isready -U devuser -d user_management

# 3. 初始化数据库（先建表，后插入测试数据）
# 此步骤会自动执行:
#   - backend/src/main/resources/db/migration/V*.sql (建表脚本)
#   - scripts/test-data/01-*.sql ~ 06-*.sql (测试数据)
docker-compose --profile seed run --rm db-seed

# 4. 启动后端服务（开发模式，热重载）
docker-compose up -d backend

# 5. 启动前端服务（开发模式）
docker-compose up -d frontend

# 6. 访问服务
# 前端: http://localhost:3000
# 后端 API: http://localhost:8080/api/v1
# pgAdmin: http://localhost:5050 (admin@example.com / admin123)
# Kafka UI: http://localhost:8081
# MailHog: http://localhost:8025
```

### Team 环境

```bash
# 1. 构建镜像
docker-compose -f docker-compose.team.yml build

# 2. 启动基础设施服务（数据库、缓存、消息队列）
docker-compose -f docker-compose.team.yml up -d postgres redis zookeeper kafka

# 3. 初始化数据库（首次部署或数据重置时使用）
# 方式 A: 自动初始化（PostgreSQL 首次启动时自动执行）
# 数据卷为空时，PostgreSQL 会自动执行 /docker-entrypoint-initdb.d/ 中的脚本

# 方式 B: 手动初始化（使用 db-seed 服务）
docker-compose -f docker-compose.team.yml --profile seed run --rm db-seed

# 4. 启动应用服务
docker-compose -f docker-compose.team.yml up -d backend frontend nginx

# 5. 查看服务状态
docker-compose -f docker-compose.team.yml ps

# 6. 访问服务
# 统一入口: http://localhost (Nginx 反向代理)
# pgAdmin: http://localhost:5050
# Kafka UI: http://localhost:8081
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
```
# pgAdmin: http://localhost:5050
# Kafka UI: http://localhost:8081
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
```

## Docker Compose 配置

### 本地开发环境 (docker-compose.yml)

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| PostgreSQL | 5432 | 5432 | 开发数据库，命名卷持久化 |
| Redis | 6379 | 6379 | 开发缓存 |
| Zookeeper | 2181 | 2181 | Kafka 协调 |
| Kafka | 9092, 29092 | 9092, 29092 | 消息队列 |
| Kafka UI | 8080 | 8081 | Kafka 管理界面 |
| Backend | 8080, 5005 | 8080, 5005 | 后端服务（含调试端口） |
| Frontend | 3000 | 3000 | 前端开发服务器 |
| pgAdmin | 80 | 5050 | 数据库管理工具 |
| MailHog | 1025, 8025 | 1025, 8025 | 邮件测试服务 |

### Team 开发环境 (docker-compose.team.yml)

| 服务 | 容器端口 | 主机端口 | 说明 |
|------|----------|----------|------|
| Nginx | 80, 443 | 80, 443 | 反向代理入口 |
| PostgreSQL | 5432 | 5432 | 团队共享数据库 |
| Redis | 6379 | 6379 | 团队共享缓存 |
| Zookeeper | 2181 | 2181 | Kafka 协调 |
| Kafka | 9092, 29092 | 9092, 29092 | 消息队列 |
| Kafka UI | 8080 | 8081 | Kafka 管理界面 |
| Backend | 8080 | - | 后端服务（内部） |
| Frontend | 3000 | - | 前端服务（内部） |
| pgAdmin | 80 | 5050 | 数据库管理工具 |
| Prometheus | 9090 | 9090 | 监控系统 |
| Grafana | 3000 | 3001 | 可视化仪表板 |

## 详细操作指南

### 1. 本地开发环境 (docker-compose.local.yml)

| 服务 | 端口 | 说明 |
|------|------|------|
| PostgreSQL | 5432 | 开发数据库，命名卷持久化 |
| Redis | 6379 | 开发缓存 |
| pgAdmin (可选) | 5050 | 数据库管理界面 |

### 2. Team开发环境 (docker-compose.team.yml)

| 服务 | 端口 | 说明 |
|------|------|------|
| PostgreSQL | 5432 | 团队共享数据库 |
| Redis | 6379 | 团队共享缓存 |
| Backend | 8080 | Spring Boot 应用 |
| Frontend | 3000 | Next.js 应用 |

### 3. SIT/UAT/生产环境 (Kubernetes)

使用外部托管服务：
- **PostgreSQL**: 云RDS (阿里云RDS/AWS RDS/腾讯云CDB)
- **Redis**: 云Redis服务或自建集群

## 数据库与数据管理

### Flyway迁移脚本位置
```
backend/src/main/resources/db/
├── migration/              # 表结构迁移（所有环境）
│   ├── V1__Initial_schema.sql
│   ├── V2__Add_roles_permissions.sql
│   └── V3__Add_audit_tables.sql
├── data/
│   ├── local/              # 本地开发数据种子
│   ├── team/               # Team开发数据种子
│   └── common/             # 通用基础数据
└── test/                   # 测试专用数据
```

### 数据流向策略
- 生产 → UAT: 脱敏导出（用于验收测试）
- 生产 → SIT: 脱敏导出（用于问题复现）
- Team → 本地: SQL导出（协作调试）
- 禁止逆向数据流动

## 测试数据初始化

### 数据脚本说明

测试数据由测试工程师维护，位于 `scripts/test-data/` 目录：

| 脚本 | 内容 | 执行顺序 | 数据量 |
|------|------|----------|--------|
| `01-departments.sql` | 部门数据 | 1 | 12 个部门 |
| `02-roles.sql` | 角色数据 | 2 | 16 种角色 |
| `03-permissions.sql` | 权限数据 | 3 | 30+ 权限 |
| `04-role-permissions.sql` | 角色权限关联 | 4 | 按角色分配 |
| `05-users.sql` | 用户数据 | 5 | 35+ 用户 |
| `06-user-roles.sql` | 用户角色关联 | 6 | 按用户分配 |

### 初始化方式

**方式 1: 使用 Docker Compose (推荐)**

```bash
# 本地开发环境
# 会自动执行:
#   1. backend/src/main/resources/db/migration/V*.sql (建表)
#   2. scripts/test-data/*.sql (测试数据)
docker-compose --profile seed run --rm db-seed

# Team 环境 - 自动初始化（PostgreSQL 首次启动时）
docker-compose -f docker-compose.team.yml up -d postgres

# Team 环境 - 手动初始化（数据重置时使用）
docker-compose -f docker-compose.team.yml --profile seed run --rm db-seed
```

**手动执行 SQL 顺序**

如果手动执行，请严格按照以下顺序：

```bash
# 1. 先执行建表脚本（Flyway 迁移）
psql -h localhost -U devuser -d user_management -f backend/src/main/resources/db/migration/V1__Initial_schema.sql
psql -h localhost -U devuser -d user_management -f backend/src/main/resources/db/migration/V2__add_oauth2_support.sql

# 2. 再执行测试数据脚本
psql -h localhost -U devuser -d user_management -f scripts/test-data/01-departments.sql
psql -h localhost -U devuser -d user_management -f scripts/test-data/02-roles.sql
psql -h localhost -U devuser -d user_management -f scripts/test-data/03-permissions.sql
psql -h localhost -U devuser -d user_management -f scripts/test-data/04-role-permissions.sql
psql -h localhost -U devuser -d user_management -f scripts/test-data/05-users.sql
psql -h localhost -U devuser -d user_management -f scripts/test-data/06-user-roles.sql
```

### 测试账号

所有测试账号密码为：`Test@123`

| 账号 | 角色 | 说明 |
|------|------|------|
| superadmin@test.com | 超级管理员 | 拥有所有权限 |
| admin@test.com | 系统管理员 | 系统管理权限 |
| tech.lead@test.com | 技术总监 | 技术研发中心负责人 |
| fe.dev1@test.com | 前端开发 | 前端开发工程师 |
| be.dev1@test.com | 后端开发 | 后端开发工程师 |
| qa.lead@test.com | 测试负责人 | 测试质量部负责人 |
| qa.tester1@test.com | 测试工程师 | 测试人员 |
| product.lead@test.com | 产品总监 | 产品运营中心负责人 |
| pm1@test.com | 产品经理 | 产品策划部 |
| sales.lead@test.com | 销售总监 | 市场销售中心负责人 |

**特殊状态账号**:
| 账号 | 状态 | 说明 |
|------|------|------|
| pending.user@test.com | 待激活 | 测试待激活流程 |
| locked.user@test.com | 已锁定 | 测试账号锁定功能 |
| inactive.user@test.com | 已禁用 | 测试禁用状态 |

## 容器化部署

### 本地开发环境
```bash
docker-compose -f docker-compose.dev.yml up -d
```




### Team 开发环境 Dockerfile

**Backend Dockerfile** (`backend/Dockerfile`):
```dockerfile
# 多阶段构建
FROM eclipse-temurin:21-jdk-alpine AS builder
RUN apk add --no-cache maven
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests -B -q

FROM eclipse-temurin:21-jre-alpine AS production
RUN apk add --no-cache curl ca-certificates tzdata
ENV TZ=Asia/Shanghai
RUN addgroup -g 1000 appgroup && adduser -u 1000 -G appgroup -s /bin/sh -D appuser
WORKDIR /app
COPY --from=builder /build/target/dependency/BOOT-INF/lib /app/lib
COPY --from=builder /build/target/dependency/META-INF /app/META-INF
COPY --from=builder /build/target/dependency/BOOT-INF/classes /app
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0",
    "-XX:+UseG1GC", "-XX:MaxGCPauseMillis=200",
    "-Djava.security.egd=file:/dev/./urandom",
    "-cp", "app:app/lib/*", "com.usermanagement.Application"]
```

**Frontend Dockerfile** (`frontend/Dockerfile`):
```dockerfile
FROM node:18-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

FROM node:18-alpine AS production
RUN apk add --no-cache curl ca-certificates
RUN addgroup -g 1000 appgroup && adduser -u 1000 -G appgroup -s /bin/sh -D appuser
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=5 \
    CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
```

#### 内存配置建议

| 容器内存限制 | JVM 堆内存 (-Xmx) | 推荐场景 |
|--------------|-------------------|----------|
| 512MB | 384MB | 开发/测试 |
| 1GB | 768MB | 小型生产 |
| 2GB | 1536MB | 中型生产 |
| 4GB | 3072MB | 大型生产 |

## CI/CD 流程

### Spring Boot 后端构建流程

1. **代码提交触发构建**
   ```bash
   git push origin feature/xxx
   ```

2. **Maven 构建和测试**
   ```bash
   ./mvnw clean verify
   # 包含: 编译、测试、覆盖率检查、包构建
   ```

3. **代码质量检查**
   ```bash
   ./mvnw checkstyle:check
   ./mvnw spotbugs:check
   ```

4. **构建 Docker 镜像**
   ```bash
   docker build -t usermanagement-backend:${VERSION} .
   docker push registry/usermanagement-backend:${VERSION}
   ```

5. **部署到 Kubernetes**
   ```bash
   kubectl apply -f k8s/
   kubectl rollout status deployment/backend
   ```

6. **运行冒烟测试**
   ```bash
   curl http://backend:8080/actuator/health
   ```

### GitHub Actions 工作流示例

```yaml
name: Build and Deploy

on:
  push:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: 'maven'

      - name: Build with Maven
        run: ./mvnw clean verify

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3

      - name: Build Docker image
        run: docker build -t backend:${{ github.sha }} .
```

## 监控告警

### Spring Boot 监控
- **Spring Boot Actuator**: 健康检查、指标、信息端点
  - `/actuator/health` - 健康状态
  - `/actuator/metrics` - JVM、HTTP、数据库指标
  - `/actuator/prometheus` - Prometheus 格式指标
- **Micrometer + Prometheus**: 应用指标收集
- **Grafana**: 可视化仪表板
- **日志聚合**: ELK Stack (Elasticsearch + Logstash + Kibana)
- **错误追踪**: Sentry / Sentry-Spring

### 关键监控指标

| 指标 | 告警阈值 | 说明 |
|------|----------|------|
| JVM 内存使用 | > 80% | 堆内存使用率 |
| HTTP 响应时间 | P95 > 500ms | API 响应延迟 |
| 错误率 | > 1% | HTTP 5xx 错误比例 |
| 活跃线程数 | > 200 | 虚拟线程池监控 |
| 数据库连接池 | > 80% | HikariCP 连接使用率 |
| GC 暂停时间 | > 1s | 垃圾回收停顿 |

## 常用命令

### Docker Compose 常用命令

```bash
# 查看所有服务状态
docker-compose ps
docker-compose -f docker-compose.team.yml ps

# 查看日志
docker-compose logs -f [service_name]
docker-compose logs -f backend
docker-compose logs -f postgres

# 进入容器
docker-compose exec backend bash
docker-compose exec postgres psql -U devuser -d user_management

# 重启服务
docker-compose restart [service_name]
docker-compose restart backend

# 停止所有服务
docker-compose down

# 停止并删除数据卷（彻底重置）
docker-compose down -v

# 重建镜像
docker-compose up -d --build [service_name]

# 扩展服务
docker-compose up -d --scale backend=3
```

### 数据库常用命令

```bash
# 进入 PostgreSQL
docker-compose exec postgres psql -U devuser -d user_management

# 导出数据
docker-compose exec postgres pg_dump -U devuser user_management > backup.sql

# 导入数据
cat backup.sql | docker-compose exec -T postgres psql -U devuser -d user_management

# 查看连接
docker-compose exec postgres psql -U devuser -c "SELECT * FROM pg_stat_activity;"

# 查看表大小
docker-compose exec postgres psql -U devuser -d user_management -c "
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(tablename::regclass))
FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename::regclass) DESC;"
```

## 故障排查

### 常见问题

#### 1. 数据库连接失败

**症状**: 应用无法连接数据库

**排查**:
```bash
# 检查 PostgreSQL 状态
docker-compose ps postgres
docker-compose logs postgres

# 手动连接测试
docker-compose exec postgres psql -U devuser -d user_management -c "SELECT 1;"

# 检查网络
docker-compose exec backend ping postgres
```

**解决**:
- 等待数据库完全启动（首次启动需要初始化）
- 检查数据库用户名密码是否正确
- 检查数据库是否已创建

#### 2. Flyway 迁移失败

**症状**: 应用启动时报 Flyway 错误

**排查**:
```bash
# 查看迁移状态
docker-compose exec backend ./mvnw flyway:info -Dspring.profiles.active=dev

# 查看具体错误
docker-compose logs backend
```

**解决**:
```bash
# 修复迁移（谨慎操作，仅开发环境）
docker-compose exec backend ./mvnw flyway:repair -Dspring.profiles.active=dev

# 或者清理数据库后重新迁移
docker-compose exec postgres psql -U devuser -d user_management -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker-compose restart backend
```

#### 3. 测试数据初始化失败

**症状**: 执行 SQL 脚本报错

**排查**:
```bash
# 检查脚本是否存在
ls -la scripts/test-data/

# 手动执行并查看错误
docker-compose exec postgres psql -U devuser -d user_management -f /scripts/01-departments.sql

# 查看详细错误
psql -h localhost -U devuser -d user_management -a -f scripts/test-data/01-departments.sql
```

**解决**:
- 确保按顺序执行脚本（01 -> 06）
- 检查 Flyway 迁移是否已完成
- 检查是否有外键约束错误（父表数据是否已插入）

#### 4. 端口被占用

**症状**: `docker-compose up` 报错端口已被占用

**排查**:
```bash
# 查找占用端口的进程
# Linux/macOS
sudo lsof -i :8080
sudo lsof -i :5432

# Windows
netstat -ano | findstr :8080
```

**解决**:
- 停止占用端口的服务
- 或修改 `docker-compose.yml` 中的端口映射：`"8081:8080"`

#### 5. 内存不足

**症状**: 容器频繁重启或 OOM

**排查**:
```bash
# 查看容器资源使用
docker stats

# 查看日志中的 OOM
docker-compose logs backend | grep -i "out of memory"
```

**解决**:
- 增加 Docker 内存限制（Docker Desktop Settings -> Resources）
- 限制服务内存使用：
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
```

#### 6. Kafka 连接失败

**症状**: 应用无法发送/接收消息

**排查**:
```bash
# 检查 Kafka 状态
docker-compose ps kafka
docker-compose logs kafka

# 测试 Kafka 连接
docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

**解决**:
- 确保 Zookeeper 先启动
- 等待 Kafka 完全启动（首次启动较慢）
- 检查 `KAFKA_ADVERTISED_LISTENERS` 配置

#### 7. 前端构建失败

**症状**: Frontend 容器启动失败

**排查**:
```bash
# 查看前端日志
docker-compose logs frontend

# 进入前端容器
docker-compose exec frontend sh
npm install
npm run build
```

**解决**:
- 删除 node_modules 重新安装
```bash
docker-compose exec frontend rm -rf node_modules
docker-compose exec frontend npm install
```
- 检查 package.json 是否有冲突

### 日志收集

```bash
# 收集所有服务日志
docker-compose logs --no-color > logs.txt

# 收集特定时间段的日志
docker-compose logs --since 2024-01-01T00:00:00 backend

# 实时跟踪多个服务
docker-compose logs -f backend frontend
```

### 性能排查

```bash
# 查看容器资源使用
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# 进入容器分析
docker-compose exec backend sh
# 安装分析工具
apk add --no-cache htop
htop
```

## 安全注意事项

1. **生产环境**: 绝不使用这些 Docker Compose 配置直接部署到生产环境
2. **JWT 密钥**: Team 环境必须使用强密钥，不要在代码中硬编码
3. **数据库密码**: 定期更换数据库密码，使用环境变量管理
4. **网络隔离**: 确保 Docker 网络与生产网络隔离
5. **数据备份**: 定期备份 PostgreSQL 数据卷

## 维护任务

### 定期清理

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的卷
docker volume prune

# 清理构建缓存
docker builder prune

# 清理所有（谨慎操作）
docker system prune -a --volumes
```

### 备份策略

```bash
# 备份 PostgreSQL
docker-compose exec postgres pg_dump -U devuser -d user_management -Fc > backup.dump

# 备份 Redis
docker-compose exec redis redis-cli BGSAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb redis-backup.rdb
```

## 联系信息

- **部署工程师**: Docker 配置、环境部署问题
- **测试工程师**: 测试数据脚本、数据初始化问题
- **开发工程师**: 应用配置、代码相关问题