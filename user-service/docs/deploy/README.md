# 部署文档

## 环境要求

- Docker 24+
- Kubernetes 1.28+（生产）
- PostgreSQL 15+
- Redis 7+
- Kafka 3+（可选）

## 本地开发（Docker Compose）

```bash
# 启动全部服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

访问: http://localhost:3000

## 生产部署（Kubernetes）

```bash
# 1. 构建镜像
docker build -t user-service-backend:latest ./back-end
docker build -t user-service-frontend:latest ./front-end

# 2. 推送镜像到仓库
docker tag user-service-backend:latest registry.example.com/user-service-backend:latest
docker push registry.example.com/user-service-backend:latest

# 3. 部署到 K8s
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# 4. 检查状态
kubectl get pods -l app=user-service
kubectl get svc -l app=user-service
```

## 环境变量

### 后端

| 变量 | 说明 | 默认值 |
|------|------|--------|
| DATABASE_URL | 数据库连接串 | sqlite+aiosqlite:///./user_service.db |
| REDIS_URL | Redis 连接串 | redis://localhost:6379/0 |
| JWT_SECRET_KEY | JWT 签名密钥 | change-me-in-production |
| CONFIG_ENCRYPTION_KEY | 配置加密密钥 | (空) |
| KAFKA_BOOTSTRAP_SERVERS | Kafka 地址 | localhost:9092 |
| CACHE_ENABLED | 缓存开关 | true |
| DB_POOL_SIZE | 连接池大小 | 20 |
| GUNICORN_WORKERS | Worker 数 | CPU×2+1 |

### 前端

| 变量 | 说明 | 默认值 |
|------|------|--------|
| NEXT_PUBLIC_API_BASE | API 基础路径 | /api/v1 |

## 数据库迁移

```bash
# 生成迁移
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

## 健康检查

- 后端: `GET /api/v1/health`
- 前端: `GET /`
