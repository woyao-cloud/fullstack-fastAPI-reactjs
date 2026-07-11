# Spring Cloud Gateway — JWT 认证网关设计

> 日期: 2026-07-11
> 状态: 已确认
> 吞吐目标: 10M/min (≈167K QPS) | 平均延迟 < 200ms | Gateway 内部 < 10ms

## 1. 概述

Spring Cloud Gateway 作为统一入口网关，混合模式校验 JWT，具备限流熔断能力：
- **本地解析 JWT**（共享密钥，< 1ms），不跨网络调用 user-service
- **Redis 黑名单** 实时使失效 token（登出/禁用/改密）
- **Redis 故障降级** 为纯本地 JWT 校验，保障可用性
- **用户级滑动窗口限流**，基于 Redis Sorted Set，精确到毫秒
- **下游熔断**（Resilience4j）+ **入口熔断**（CPU/内存自保护）
- 仅认证不鉴权，权限判断留给下游微服务

## 2. 架构

```
                    ┌──────────────────────┐
                    │   Redis Cluster       │
                    │   - token 黑名单       │
                    │   - 限流窗口           │
                    └─────┬────────────────┘
                          │
    ┌─────────────────────┼──────────────────────┐
    │   Gateway 实例 × N   │  (K8s HPA 水平扩展)   │
    │                     │                       │
    │   1. 入口熔断检查      │  (CPU/内存自保护)      │
    │   2. 限流检查          │  (滑动窗口 per-user)  │
    │   3. 本地解析 JWT      │  (共享 JWT_SECRET_KEY)│
    │   4. 查 Redis 黑名单    │  (jti/uid+iat)      │
    │   5. 下游熔断检查       │  (Resilience4j)     │
    │   6. 注入 X-User-*     │  header             │
    └─────────────────────┼──────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
    ┌─────────▼──────────┐  ┌────────▼──────────┐
    │   user-service      │  │  其他微服务         │
    │   (FastAPI)         │  │  (Spring Boot)    │
    │   登出/禁用/改密时    │  │                   │
    │   写 Redis 黑名单     │  │                   │
    └────────────────────┘  └───────────────────┘
```

## 3. 技术选型

| 组件 | 选型 | 说明 |
|------|------|------|
| 框架 | Spring Boot 3.5 + JDK 21 | |
| 网关 | Spring Cloud Gateway (Reactive) | Netty 事件循环，非阻塞 |
| JWT 解析 | Nimbus JOSE + JWT (`com.nimbusds:nimbus-jose-jwt`) | 本地解析，共享密钥 |
| Redis 客户端 | Lettuce (Reactive) | 与 WebFlux 共用事件循环 |
| 熔断 | Resilience4j (Reactive) | 下游熔断 + 入口自保护 |
| 可观测性 | Micrometer + Prometheus | 延迟/限流/熔断指标 + 告警 |
| HTTP 客户端 | WebClient | 下游服务调用 |
| 虚拟线程 | 不启用 | Gateway 是 Reactive 模型 |

## 4. Token 黑名单机制

### 4.1 数据结构

```
Key:   blacklist:jti:<jti>           → TTL = token 剩余有效时间
Key:   blacklist:user:<user_id>      → 用户被禁用的时间戳 (iat 阈值)
```

- `jti` 黑名单：登出、refresh 时写入，使特定 token 失效
- `user_id` 黑名单：管理员禁用用户、修改密码时写入，使该用户所有旧 token 失效

### 4.2 写入方（user-service）

| 场景 | 写入 Redis |
|------|-----------|
| 用户登出 | `SET blacklist:jti:<jti> 1 EX <剩余秒数>` |
| 管理员禁用用户 | `SET blacklist:user:<user_id> <当前时间戳>` |
| 用户修改密码 | `SET blacklist:user:<user_id> <当前时间戳>` |

user-service 在对应的 service 方法中追加 Redis 写入逻辑。

### 4.3 读取方（Gateway）

```
提取 JWT → 本地解析签名+过期
  ↓
jti 在黑名单？──是──→ 401
  ↓ 否
user_id 黑名单的 iat 时间戳 > token.iat？──是──→ 401（token 在禁用前签发）
  ↓ 否
通过
```

## 5. 降级策略

```
Redis 连接失败/超时 (> 50ms)
  ↓
记录 WARN 日志 + 指标
  ↓
跳过黑名单检查
  ↓
仅本地 JWT 校验通过即可放行
```

降级时：已登出/禁用的用户在 token 自然过期前仍可访问，可用性优先于安全性。

## 6. 过滤器链（按优先级）

```
请求进入
  ↓
① 入口熔断过滤器 — CPU > 80% 或内存 > 85%？──是──→ 503 {"detail": "服务繁忙，请稍后重试"}
  ↓ 否
② 限流过滤器 — 用户滑动窗口超限？──是──→ 429 {"detail": "请求过于频繁", "retry_after": N}
  ↓ 否
③ 认证过滤器:
  路径在白名单？──是──→ 放行
    ↓ 否
  提取 Authorization: Bearer <token>
    ↓
  无 token？──是──→ 401 {"detail": "缺少认证凭据"}
    ↓ 否
  Nimbus 本地解析 JWT 签名 + 过期
    ↓
  解析失败？──是──→ 401 {"detail": "认证凭据无效或已过期"}
    ↓ 否
  [Redis 可用] → 查黑名单
    ↓
  命中黑名单？──是──→ 401 {"detail": "认证凭据已失效"}
    ↓ 否
  注入 X-User-Id, X-User-Email, X-User-Permissions
    ↓
④ 下游熔断检查 — 目标服务熔断器 OPEN？──是──→ 503 {"detail": "服务暂时不可用"}
    ↓ 否
⑤ 转发到下游服务
```

## 7. 路由设计

| 路由前缀 | 目标服务 | 认证 |
|---------|---------|------|
| `/api/v1/auth/**` | user-service | 放行 |
| `/api/v1/users/**` | user-service | 需认证 |
| `/api/v1/roles/**` | user-service | 需认证 |
| `/api/v1/departments/**` | user-service | 需认证 |
| `/api/v1/config/**` | user-service | 需认证 |
| `/api/v1/audit-logs/**` | user-service | 需认证 |

## 8. 限流设计

### 8.1 滑动窗口算法

使用 Redis Sorted Set 实现毫秒级滑动窗口：

```
Key:   ratelimit:user:<user_id>:<route_group>
Score: 请求时间戳 (毫秒)
Value: 唯一请求 ID (纳秒时间戳 + 随机数)

操作（Lua 脚本原子执行）:
1. ZREMRANGEBYSCORE key 0 <now - window_ms>   # 移除窗口外的记录
2. ZCOUNT key <now - window_ms> +inf           # 统计窗口内请求数
3. if count >= limit → 拒绝
4. ZADD key <now_ms> <request_id>              # 添加当前请求
5. EXPIRE key <window_ms / 1000 + 1>           # 自动过期
```

### 8.2 限流配置

| 粒度 | 默认限制 | 窗口 |
|------|---------|------|
| 每用户全局 | 1000 req/s | 1 秒 |
| 每用户 `/auth/**` | 20 req/s | 1 秒 |
| 每用户 `/users/**` | 200 req/s | 1 秒 |
| 每用户默认 | 300 req/s | 1 秒 |

### 8.3 降级策略

Redis 不可用时跳过限流，认证通过即放行（与黑名单降级一致）。

## 9. 熔断设计

### 9.1 下游熔断（Resilience4j）

按路由为每个下游服务创建独立的 CircuitBreaker：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| sliding-window-type | COUNT_BASED | 基于请求次数 |
| sliding-window-size | 100 | 最近 100 次请求 |
| failure-rate-threshold | 50% | 错误率 > 50% 时 OPEN |
| slow-call-rate-threshold | 50% | 慢调用 > 50% 时 OPEN |
| slow-call-duration-threshold | 500ms | 超过 500ms 算慢调用 |
| wait-duration-in-open-state | 10s | HALF_OPEN 前等待 10s |
| permitted-calls-in-half-open | 10 | 半开状态最多 10 个探测请求 |
| automatic-transition | true | 探测成功后自动 CLOSE |

状态流转：
```
CLOSED → (错误率 > 50%) → OPEN → (10s 后) → HALF_OPEN → (探测成功) → CLOSED
                                                       → (探测失败) → OPEN
```

### 9.2 入口熔断（自保护）

Gateway 自身保护，通过全局过滤器实现：

| 指标 | 阈值 | 动作 |
|------|------|------|
| CPU 使用率 | > 80% | 拒绝新请求 503 |
| 堆内存使用率 | > 85% | 拒绝新请求 503 |
| 活跃连接数 | > 80% max | 拒绝新请求 503 |

每 5 秒采样一次，连续 3 次超阈值触发熔断，连续 3 次低于阈值恢复。

## 10. 模块结构

```
gateway/
├── pom.xml
├── docker-compose.yml
├── Dockerfile
├── src/main/java/com/gateway/
│   ├── GatewayApplication.java
│   ├── config/
│   │   ├── RouteConfig.java            # 路由配置
│   │   ├── RedisConfig.java            # Lettuce Reactive 连接
│   │   ├── Resilience4jConfig.java     # 熔断器配置
│   │   └── SecurityConfig.java         # 禁用默认 form login
│   ├── filter/
│   │   ├── AuthGlobalFilter.java       # ③ 认证过滤器
│   │   ├── RateLimitFilter.java        # ② 限流过滤器
│   │   ├── IngressCircuitBreakerFilter.java  # ① 入口熔断过滤器
│   │   └── AuthProperties.java         # 白名单 + JWT 密钥配置
│   ├── ratelimit/
│   │   ├── RateLimiter.java            # 滑动窗口限流接口
│   │   ├── RedisRateLimiter.java       # Redis Sorted Set 实现
│   │   └── RateLimitConfig.java        # 限流配置加载
│   ├── jwt/
│   │   ├── JwtParser.java              # Nimbus JWT 本地解析
│   │   ├── TokenBlacklist.java         # Redis 黑名单查询接口
│   │   └── RedisTokenBlacklist.java    # Redis 实现（含降级）
│   └── dto/
│       └── UserInfo.java               # JWT payload 映射
├── src/main/resources/
│   ├── application.yml
│   └── application-local.yml           # 本地开发覆盖
└── Dockerfile
```

## 11. 关键配置

```yaml
server:
  port: 8080

spring:
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: http://user-service:8000
          predicates:
            - Path=/api/v1/**
          metadata:
            connect-timeout: 200      # 下游建连超时 ms
            response-timeout: 500     # 下游响应超时 ms
      httpclient:
        pool:
          max-connections: 500
          max-idle-timeout: 60s
        connect-timeout: 200
        response-timeout: 500
  data:
    redis:
      cluster:
        nodes: redis-cluster:6379
      timeout: 100ms
      lettuce:
        pool:
          max-active: 200
          max-idle: 50

gateway:
  auth:
    jwt-secret-key: ${JWT_SECRET_KEY}
    jwt-algorithm: HS256
    exclude-paths:
      - /api/v1/auth/login
      - /api/v1/auth/register
      - /api/v1/auth/refresh
      - /api/v1/auth/login/oauth
    blacklist:
      redis-timeout: 50ms
      degrade-on-failure: true
  ratelimit:
    enabled: true
    default-limit: 300          # 每用户默认 req/s
    default-window: 1s
    routes:
      - path: /api/v1/auth/**
        limit: 20
      - path: /api/v1/users/**
        limit: 200
    degrade-on-failure: true    # Redis 不可用时跳过限流
  circuit-breaker:
    ingress:
      cpu-threshold: 0.8        # CPU > 80%
      memory-threshold: 0.85    # 堆内存 > 85%
      sample-interval: 5s
      trigger-count: 3          # 连续 3 次超阈值触发
      recover-count: 3          # 连续 3 次低于阈值恢复

resilience4j:
  circuitbreaker:
    configs:
      default:
        sliding-window-type: COUNT_BASED
        sliding-window-size: 100
        failure-rate-threshold: 50
        slow-call-rate-threshold: 50
        slow-call-duration-threshold: 500ms
        wait-duration-in-open-state: 10s
        permitted-number-of-calls-in-half-open-state: 10
        automatic-transition-from-open-to-half-open-enabled: true
    instances:
      user-service:
        base-config: default

management:
  endpoints:
    web:
      exposure:
        include: health,prometheus,metrics
  metrics:
    export:
      prometheus:
        enabled: true
```

## 12. 延迟预算 & 优化措施

端到端 200ms 平均延迟分解：

| 环节 | 预算 | 措施 |
|------|------|------|
| Gateway 入口熔断 | < 0.1ms | 本地内存计数器 |
| Gateway 限流 | < 1ms | Redis Lua 原子操作 |
| Gateway 认证 | < 2ms | 本地 JWT 解析 + Redis 异步查黑名单 |
| Gateway → 下游网络 | < 5ms | K8s 内部网络，HTTP/2 多路复用 |
| 下游服务处理 | < 180ms | 各微服务自行保障 |
| 余量 | ~12ms | 缓冲 |

### Gateway 内部优化

| 措施 | 说明 |
|------|------|
| 无状态 Gateway | 任意实例可处理任意请求，K8s HPA 按 CPU > 70% 自动扩缩 |
| 入口熔断 | 本地内存计数器，< 0.1ms |
| 限流 Lua 脚本 | Redis 原子操作，< 1ms |
| 本地 JWT 解析 | 不跨网络调用，< 1ms |
| Redis 异步查询 | Lettuce Reactive，非阻塞事件循环，< 1ms |
| WebClient 连接池 | HTTP keep-alive，连接复用，避免握手开销 |
| 黑名单超时 50ms | 超时即降级，不阻塞请求 |
| JVM 调优 | `-XX:+ZGenerational`（ZGC），GC 暂停 < 1ms |

### 下游服务调优

| 措施 | 说明 |
|------|------|
| 响应超时 500ms | 下游超时即返回 504，避免长尾请求拖高平均延迟 |
| 连接超时 200ms | 建连超时，快速失败 |
| HTTP/2 | 多路复用，减少连接数 |
| 连接池 | max-connections: 500, max-idle: 100, keep-alive: 60s |

## 13. 错误处理

| 场景 | HTTP 状态码 | 响应 |
|------|-----------|------|
| 无 token | 401 | `{"detail": "缺少认证凭据"}` |
| 签名无效/过期 | 401 | `{"detail": "认证凭据无效或已过期"}` |
| token 已登出/禁用 | 401 | `{"detail": "认证凭据已失效"}` |
| 用户限流 | 429 | `{"detail": "请求过于频繁", "retry_after": N}` |
| 入口熔断 | 503 | `{"detail": "服务繁忙，请稍后重试"}` |
| 下游熔断 | 503 | `{"detail": "服务暂时不可用"}` |
| Redis 不可用 | 降级放行 | WARN 日志 |

## 14. 可观测性

### 指标（Micrometer + Prometheus）

```
# 认证
gateway_auth_latency_seconds{outcome="pass|fail|degrade"}
gateway_blacklist_latency_seconds{result="hit|miss|timeout"}

# 限流
gateway_ratelimit_rejected_total{user_id,route}                  # 被限流拒绝次数
gateway_ratelimit_latency_seconds{result="allow|deny|degrade"}   # 限流检查耗时

# 熔断
gateway_circuit_breaker_state{name,state}                        # 熔断器状态 (closed/open/half_open)
gateway_ingress_rejected_total{reason="cpu|memory"}              # 入口熔断拒绝次数
resilience4j_circuitbreaker_calls_seconds{name,kind}             # 下游熔断调用

# 下游
gateway_downstream_latency_seconds{route,status}
gateway_requests_total{route,status}
```

### 告警规则

| 指标 | 阈值 | 级别 |
|------|------|------|
| auth_latency P99 | > 5ms | WARN |
| blacklist_latency P99 | > 20ms | WARN |
| downstream_latency AVG | > 200ms | WARN |
| degrade_rate | > 1% | CRITICAL |
| ratelimit_rejected rate | > 100/s | WARN |
| circuit_breaker_state = open | any | CRITICAL |
| ingress_rejected rate | > 0 | CRITICAL |

## 15. user-service 配合改动

user-service 需新增 Redis 黑名单写入：

| 位置 | 改动 |
|------|------|
| `auth_service.py` — `login()` | 无改动 |
| `auth_service.py` — 新增 `logout()` | 解析 jti，写入 `blacklist:jti:<jti>` |
| `auth_service.py` — `change_password()` | 写入 `blacklist:user:<user_id>` |
| `user_service.py` — 禁用用户 | 写入 `blacklist:user:<user_id>` |

## 16. Docker 部署

### 16.1 Dockerfile

```dockerfile
FROM eclipse-temurin:21-jre-alpine
COPY target/gateway-*.jar app.jar
ENTRYPOINT ["java", \
  "-XX:+UseZGC", \
  "-XX:+ZGenerational", \
  "-XX:MaxRAMPercentage=75", \
  "-jar", "/app.jar"]
```

### 16.2 docker-compose.yml（本地开发）

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  user-service:
    build:
      context: ../user-service/back-end
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite+aiosqlite:///./user_service.db
      - JWT_SECRET_KEY=dev-secret-key-change-in-production
      - REDIS_URL=redis://redis:6379/0
      - CACHE_ENABLED=true
    depends_on:
      redis:
        condition: service_healthy

  gateway:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - JWT_SECRET_KEY=dev-secret-key-change-in-production
      - SPRING_PROFILES_ACTIVE=local
      - SPRING_DATA_REDIS_HOST=redis
      - SPRING_DATA_REDIS_PORT=6379
    depends_on:
      redis:
        condition: service_healthy
      user-service:
        condition: service_started
```

### 16.3 application-local.yml（本地开发覆盖）

```yaml
# 本地开发：Redis 单节点，关闭 cluster 模式
spring:
  data:
    redis:
      host: ${SPRING_DATA_REDIS_HOST:localhost}
      port: ${SPRING_DATA_REDIS_PORT:6379}
      cluster: null         # 本地不用 cluster
      timeout: 100ms
      lettuce:
        pool:
          max-active: 20    # 本地连接池缩小
          max-idle: 5

logging:
  level:
    com.gateway: DEBUG

# 本地开发不放行 Prometheus 端点
management:
  endpoints:
    web:
      exposure:
        include: health,metrics
```

## 17. 不包含的内容

- 权限校验（由下游微服务负责）
- OAuth2 集成
- 前端路由
- 分布式追踪（后续接入 OpenTelemetry）