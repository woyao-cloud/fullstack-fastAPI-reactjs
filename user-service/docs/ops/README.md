# 运维手册

## 监控

### Prometheus + Grafana

```bash
# 启动监控栈
docker compose -f monitoring/docker-compose.yml up -d
```

访问:
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

### 关键指标

| 指标 | 告警阈值 | 说明 |
|------|----------|------|
| http_request_duration_seconds | P95 > 500ms | API 响应时间 |
| http_requests_total | - | 请求量 |
| db_pool_available | < 5 | 数据库连接池可用数 |
| redis_memory_usage | > 80% | Redis 内存使用率 |
| kafka_lag | > 1000 | Kafka 消费延迟 |

## 日志

```bash
# 查看后端日志
kubectl logs -l app=user-service,tier=backend

# 查看前端日志
kubectl logs -l app=user-service,tier=frontend

# 实时追踪
kubectl logs -l app=user-service,tier=backend -f
```

## 备份

```bash
# 数据库备份
pg_dump -h localhost -U user_service user_service > backup_$(date +%Y%m%d).sql

# 恢复
psql -h localhost -U user_service user_service < backup.sql
```

## 故障处理

### 后端无法启动
1. 检查数据库连接: `kubectl exec -it postgres-0 -- pg_isready`
2. 检查 Redis: `kubectl exec -it redis-xxx -- redis-cli ping`
3. 查看日志: `kubectl logs -l app=user-service,tier=backend`

### 前端白屏
1. 检查后端健康: `curl http://backend:8000/api/v1/health`
2. 检查 Next.js rewrites 配置
3. 查看浏览器控制台网络请求

### 性能问题
1. 检查连接池: `kubectl exec -it postgres-0 -- psql -c "SELECT count(*) FROM pg_stat_activity;"`
2. 检查 Redis 缓存命中率
3. 检查 Kafka 消费延迟
