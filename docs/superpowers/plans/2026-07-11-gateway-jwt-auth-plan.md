# Gateway JWT 认证网关 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 Spring Cloud Gateway 网关，本地校验 JWT + Redis 黑名单 + 滑动窗口限流 + Resilience4j 熔断

**Architecture:** 过滤器链：入口熔断 → 限流 → 认证 → 下游熔断 → 转发。JWT 本地解析，Redis 存储黑名单和限流窗口，Resilience4j 管理下游熔断器。

**Tech Stack:** Spring Boot 3.5 + Spring Cloud Gateway + Nimbus JOSE + Lettuce Reactive + Resilience4j + Micrometer + Prometheus

## Global Constraints

- JDK 21，Spring Boot 3.5
- 仅认证不鉴权，不校验权限码
- Redis 不可用时降级放行（限流和黑名单均跳过）
- HS256 JWT 算法，密钥从环境变量注入
- 吞吐目标 10M/min，Gateway 内部 < 10ms

---

### Task 1: 项目骨架

**Files:**
- Create: `gateway/pom.xml`
- Create: `gateway/src/main/java/com/gateway/GatewayApplication.java`
- Create: `gateway/src/main/resources/application.yml`
- Create: `gateway/src/main/resources/application-local.yml`

**Produces:**
- `GatewayApplication` — Spring Boot 入口，`@SpringBootApplication`
- `application.yml` — 生产配置
- `application-local.yml` — 本地开发覆盖

- [ ] **Step 1: 创建 pom.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.5.0</version>
        <relativePath/>
    </parent>

    <groupId>com.gateway</groupId>
    <artifactId>gateway</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>gateway</name>

    <properties>
        <java.version>21</java.version>
        <spring-cloud.version>2025.0.0</spring-cloud.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-gateway</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis-reactive</artifactId>
        </dependency>
        <dependency>
            <groupId>com.nimbusds</groupId>
            <artifactId>nimbus-jose-jwt</artifactId>
            <version>9.48</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.cloud</groupId>
            <artifactId>spring-cloud-starter-circuitbreaker-reactor-resilience4j</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-registry-prometheus</artifactId>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>io.projectreactor</groupId>
            <artifactId>reactor-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>com.squareup.okhttp3</groupId>
            <artifactId>mockwebserver</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>org.springframework.cloud</groupId>
                <artifactId>spring-cloud-dependencies</artifactId>
                <version>${spring-cloud.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 2: 创建 GatewayApplication.java**

```java
package com.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
```

- [ ] **Step 3: 创建 application.yml**

```yaml
server:
  port: 8080

spring:
  cloud:
    gateway:
      httpclient:
        pool:
          max-connections: 500
          max-idle-timeout: 60s
        connect-timeout: 200
        response-timeout: 500
  data:
    redis:
      cluster:
        nodes: ${REDIS_CLUSTER_NODES:redis-cluster:6379}
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
    default-limit: 300
    default-window: 1s
    routes:
      - path: /api/v1/auth/**
        limit: 20
      - path: /api/v1/users/**
        limit: 200
    degrade-on-failure: true
  circuit-breaker:
    ingress:
      cpu-threshold: 0.8
      memory-threshold: 0.85
      sample-interval: 5s
      trigger-count: 3
      recover-count: 3

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

- [ ] **Step 4: 创建 application-local.yml**

```yaml
spring:
  data:
    redis:
      host: ${SPRING_DATA_REDIS_HOST:localhost}
      port: ${SPRING_DATA_REDIS_PORT:6379}
      cluster: null
      timeout: 100ms
      lettuce:
        pool:
          max-active: 20
          max-idle: 5

logging:
  level:
    com.gateway: DEBUG

management:
  endpoints:
    web:
      exposure:
        include: health,metrics
```

- [ ] **Step 5: 提交**

```bash
git add gateway/pom.xml gateway/src/
git commit -m "feat(gateway): 项目骨架 — pom.xml + 配置 + 启动类"
```

---

### Task 2: UserInfo DTO + AuthProperties

**Files:**
- Create: `gateway/src/main/java/com/gateway/dto/UserInfo.java`
- Create: `gateway/src/main/java/com/gateway/filter/AuthProperties.java`

**Interfaces:**
- Produces: `UserInfo` — 包含 `userId`(String), `email`(String), `permissions`(List\<String\>)
- Produces: `AuthProperties` — `@ConfigurationProperties("gateway.auth")`，包含 excludePaths, jwtSecretKey, jwtAlgorithm, blacklist 配置

- [ ] **Step 1: 创建 UserInfo.java**

```java
package com.gateway.dto;

import java.util.List;

public record UserInfo(
    String userId,
    String email,
    List<String> permissions
) {
    public static UserInfo fromPayload(String userId, String email, List<String> permissions) {
        return new UserInfo(userId, email != null ? email : "", permissions != null ? permissions : List.of());
    }
}
```

- [ ] **Step 2: 创建 AuthProperties.java**

```java
package com.gateway.filter;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties("gateway.auth")
public record AuthProperties(
    String jwtSecretKey,
    String jwtAlgorithm,
    List<String> excludePaths,
    Blacklist blacklist
) {
    public record Blacklist(long redisTimeout, boolean degradeOnFailure) {}
}
```

- [ ] **Step 3: 提交**

```bash
git add gateway/src/main/java/com/gateway/dto/ gateway/src/main/java/com/gateway/filter/AuthProperties.java
git commit -m "feat(gateway): UserInfo DTO + AuthProperties 配置类"
```

---

### Task 3: JwtParser

**Files:**
- Create: `gateway/src/main/java/com/gateway/jwt/JwtParser.java`
- Create: `gateway/src/test/java/com/gateway/jwt/JwtParserTest.java`

**Interfaces:**
- Consumes: `AuthProperties`
- Produces: `JwtParser.parse(String token)` → `UserInfo` (throws JwtException on failure)

- [ ] **Step 1: 编写 JwtParserTest.java**

```java
package com.gateway.jwt;

import com.gateway.dto.UserInfo;
import com.gateway.filter.AuthProperties;
import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtParserTest {

    private JwtParser parser;
    private String secret = "test-secret-key-at-least-256-bits-long!!";

    @BeforeEach
    void setUp() {
        parser = new JwtParser(new AuthProperties(secret, "HS256", List.of(), null));
    }

    private String createToken(String userId, String email, List<String> permissions,
                                Instant issuedAt, Instant expiresAt) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(userId)
                .claim("email", email)
                .claim("permissions", permissions)
                .issueTime(Date.from(issuedAt))
                .expirationTime(Date.from(expiresAt))
                .jwtID(UUID.randomUUID().toString())
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret));
        return jwt.serialize();
    }

    @Test
    void shouldParseValidToken() throws Exception {
        String token = createToken("user-123", "test@example.com", List.of("user:read"),
                Instant.now(), Instant.now().plusSeconds(3600));

        UserInfo info = parser.parse(token);

        assertThat(info.userId()).isEqualTo("user-123");
        assertThat(info.email()).isEqualTo("test@example.com");
        assertThat(info.permissions()).contains("user:read");
    }

    @Test
    void shouldRejectExpiredToken() throws Exception {
        String token = createToken("user-123", "test@example.com", List.of(),
                Instant.now().minusSeconds(7200), Instant.now().minusSeconds(3600));

        assertThatThrownBy(() -> parser.parse(token))
                .isInstanceOf(JwtException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void shouldRejectTokenWithWrongSecret() throws Exception {
        JwtParser otherParser = new JwtParser(new AuthProperties("wrong-secret-key-at-least-256-bits!!!", "HS256", List.of(), null));
        String token = createToken("user-123", "test@example.com", List.of(),
                Instant.now(), Instant.now().plusSeconds(3600));

        assertThatThrownBy(() -> otherParser.parse(token))
                .isInstanceOf(JwtException.class);
    }
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd gateway && mvn test -pl . -Dtest=JwtParserTest
```
Expected: 编译错误，JwtParser 类不存在

- [ ] **Step 3: 创建 JwtParser.java**

```java
package com.gateway.jwt;

import com.gateway.dto.UserInfo;
import com.gateway.filter.AuthProperties;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Component
public class JwtParser {

    private final JWSVerifier verifier;
    private final AuthProperties props;

    public JwtParser(AuthProperties props) {
        this.props = props;
        this.verifier = new MACVerifier(props.jwtSecretKey());
    }

    public UserInfo parse(String token) throws JwtException {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!jwt.verify(verifier)) {
                throw new JwtException("签名验证失败");
            }
            Date expiration = jwt.getJWTClaimsSet().getExpirationTime();
            if (expiration == null || expiration.before(Date.from(Instant.now()))) {
                throw new JwtException("token 已过期");
            }
            String userId = jwt.getJWTClaimsSet().getSubject();
            if (userId == null || userId.isBlank()) {
                throw new JwtException("missing subject");
            }
            String email = jwt.getJWTClaimsSet().getStringClaim("email");
            List<String> permissions = jwt.getJWTClaimsSet().getStringListClaim("permissions");
            return UserInfo.fromPayload(userId, email, permissions);
        } catch (ParseException | com.nimbusds.jose.JOSEException e) {
            throw new JwtException("token 解析失败: " + e.getMessage(), e);
        }
    }
}
```

- [ ] **Step 4: 创建 JwtException.java**

```java
package com.gateway.jwt;

public class JwtException extends RuntimeException {
    public JwtException(String message) {
        super(message);
    }

    public JwtException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

- [ ] **Step 5: 运行测试，确认通过**

```bash
cd gateway && mvn test -pl . -Dtest=JwtParserTest
```
Expected: Tests PASS

- [ ] **Step 6: 提交**

```bash
git add gateway/src/main/java/com/gateway/jwt/ gateway/src/test/
git commit -m "feat(gateway): JwtParser — Nimbus 本地 JWT 解析"
```

---

### Task 4: TokenBlacklist 接口 + Redis 实现

**Files:**
- Create: `gateway/src/main/java/com/gateway/jwt/TokenBlacklist.java`
- Create: `gateway/src/main/java/com/gateway/jwt/RedisTokenBlacklist.java`
- Create: `gateway/src/test/java/com/gateway/jwt/RedisTokenBlacklistTest.java`

**Interfaces:**
- Consumes: `AuthProperties`
- Produces: `TokenBlacklist.isBlacklisted(String jti, String userId, Instant tokenIssuedAt)` → `Mono<Boolean>`

- [ ] **Step 1: 创建 TokenBlacklist.java**

```java
package com.gateway.jwt;

import reactor.core.publisher.Mono;

import java.time.Instant;

public interface TokenBlacklist {
    Mono<Boolean> isBlacklisted(String jti, String userId, Instant tokenIssuedAt);
}
```

- [ ] **Step 2: 创建 RedisTokenBlacklist.java**

```java
package com.gateway.jwt;

import com.gateway.filter.AuthProperties;
import io.lettuce.core.RedisException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;

@Component
public class RedisTokenBlacklist implements TokenBlacklist {

    private static final Logger log = LoggerFactory.getLogger(RedisTokenBlacklist.class);
    private static final String JTI_PREFIX = "blacklist:jti:";
    private static final String USER_PREFIX = "blacklist:user:";

    private final ReactiveRedisTemplate<String, String> redis;
    private final long timeoutMs;
    private final boolean degradeOnFailure;

    public RedisTokenBlacklist(ReactiveRedisTemplate<String, String> redis, AuthProperties props) {
        this.redis = redis;
        this.timeoutMs = props.blacklist().redisTimeout();
        this.degradeOnFailure = props.blacklist().degradeOnFailure();
    }

    @Override
    public Mono<Boolean> isBlacklisted(String jti, String userId, Instant tokenIssuedAt) {
        Mono<Boolean> jtiCheck = redis.hasKey(JTI_PREFIX + jti)
                .timeout(Duration.ofMillis(timeoutMs));

        Mono<Boolean> userCheck = redis.opsForValue().get(USER_PREFIX + userId)
                .timeout(Duration.ofMillis(timeoutMs))
                .map(disabledAt -> {
                    long disabledEpoch = Long.parseLong(disabledAt);
                    return tokenIssuedAt.getEpochSecond() < disabledEpoch;
                })
                .defaultIfEmpty(false);

        return Mono.zip(jtiCheck, userCheck)
                .map(tuple -> tuple.getT1() || tuple.getT2())
                .onErrorResume(RedisException.class, e -> {
                    log.warn("Redis blacklist check failed, degraded: {}", e.getMessage());
                    return degradeOnFailure ? Mono.just(false) : Mono.just(false);
                })
                .onErrorResume(e -> {
                    log.warn("Blacklist check timeout, degraded: {}", e.getMessage());
                    return Mono.just(false);
                });
    }
}
```

- [ ] **Step 3: 创建 RedisTokenBlacklistTest.java**

```java
package com.gateway.jwt;

import com.gateway.filter.AuthProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.ReactiveValueOperations;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RedisTokenBlacklistTest {

    @SuppressWarnings("unchecked")
    private ReactiveRedisTemplate<String, String> redis = mock(ReactiveRedisTemplate.class);
    private ReactiveValueOperations<String, String> ops = mock(ReactiveValueOperations.class);
    private RedisTokenBlacklist blacklist;

    @BeforeEach
    void setUp() {
        when(redis.hasKey(anyString())).thenReturn(Mono.just(false));
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get(anyString())).thenReturn(Mono.empty());

        var authProps = new AuthProperties("secret", "HS256", List.of(),
                new AuthProperties.Blacklist(2000, true));
        blacklist = new RedisTokenBlacklist(redis, authProps);
    }

    @Test
    void shouldReturnFalseWhenNotBlacklisted() {
        StepVerifier.create(blacklist.isBlacklisted("jti-1", "user-1", Instant.now()))
                .expectNext(false)
                .verifyComplete();
    }

    @Test
    void shouldReturnTrueWhenJtiBlacklisted() {
        when(redis.hasKey("blacklist:jti:jti-1")).thenReturn(Mono.just(true));

        StepVerifier.create(blacklist.isBlacklisted("jti-1", "user-1", Instant.now()))
                .expectNext(true)
                .verifyComplete();
    }

    @Test
    void shouldReturnTrueWhenUserDisabledAfterTokenIssued() {
        Instant issuedAt = Instant.now().minus(Duration.ofHours(1));
        when(ops.get("blacklist:user:user-1")).thenReturn(Mono.just(String.valueOf(Instant.now().getEpochSecond())));

        StepVerifier.create(blacklist.isBlacklisted("jti-1", "user-1", issuedAt))
                .expectNext(true)
                .verifyComplete();
    }
}
```

- [ ] **Step 4: 运行测试**

```bash
cd gateway && mvn test -pl . -Dtest=RedisTokenBlacklistTest
```
Expected: Tests PASS

- [ ] **Step 5: 提交**

```bash
git add gateway/src/main/java/com/gateway/jwt/TokenBlacklist.java gateway/src/main/java/com/gateway/jwt/RedisTokenBlacklist.java gateway/src/test/java/com/gateway/jwt/RedisTokenBlacklistTest.java
git commit -m "feat(gateway): TokenBlacklist — Redis 黑名单（含降级）"
```

---

### Task 5: AuthGlobalFilter

**Files:**
- Create: `gateway/src/main/java/com/gateway/filter/AuthGlobalFilter.java`
- Create: `gateway/src/test/java/com/gateway/filter/AuthGlobalFilterTest.java`

**Interfaces:**
- Consumes: `JwtParser`, `TokenBlacklist`, `AuthProperties`
- Produces: `AuthGlobalFilter` — `GlobalFilter`，注入 `X-User-Id`, `X-User-Email`, `X-User-Permissions` header

- [ ] **Step 1: 创建 AuthGlobalFilter.java**

```java
package com.gateway.filter;

import com.gateway.jwt.JwtException;
import com.gateway.jwt.JwtParser;
import com.gateway.jwt.TokenBlacklist;
import io.micrometer.core.instrument.MeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.Date;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 3)
public class AuthGlobalFilter implements GlobalFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthGlobalFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";
    private final AntPathMatcher matcher = new AntPathMatcher();

    private final JwtParser jwtParser;
    private final TokenBlacklist blacklist;
    private final AuthProperties props;

    public AuthGlobalFilter(JwtParser jwtParser, TokenBlacklist blacklist, AuthProperties props) {
        this.jwtParser = jwtParser;
        this.blacklist = blacklist;
        this.props = props;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (isExcluded(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "缺少认证凭据");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            var userInfo = jwtParser.parse(token);
            var jwt = com.nimbusds.jwt.SignedJWT.parse(token);
            String jti = jwt.getJWTClaimsSet().getJWTID();
            Date iat = jwt.getJWTClaimsSet().getIssueTime();
            Instant issuedAt = iat != null ? iat.toInstant() : Instant.EPOCH;

            return blacklist.isBlacklisted(jti, userInfo.userId(), issuedAt)
                    .flatMap(blacklisted -> {
                        if (blacklisted) {
                            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "认证凭据已失效");
                        }
                        return forwardWithUserHeaders(exchange, chain, userInfo);
                    });

        } catch (JwtException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "认证凭据无效或已过期");
        } catch (Exception e) {
            log.error("Unexpected auth error", e);
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "认证凭据无效或已过期");
        }
    }

    private boolean isExcluded(String path) {
        return props.excludePaths().stream().anyMatch(p -> matcher.match(p, path));
    }

    private Mono<Void> forwardWithUserHeaders(ServerWebExchange exchange, GatewayFilterChain chain,
                                               com.gateway.dto.UserInfo userInfo) {
        var req = exchange.getRequest().mutate()
                .header("X-User-Id", userInfo.userId())
                .header("X-User-Email", userInfo.email())
                .header("X-User-Permissions", String.join(",", userInfo.permissions()))
                .build();
        return chain.filter(exchange.mutate().request(req).build());
    }

    private Mono<Void> errorResponse(ServerWebExchange exchange, HttpStatus status, String detail) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
        byte[] body = ("{\"detail\":\"" + detail + "\"}").getBytes();
        var buffer = exchange.getResponse().bufferFactory().wrap(body);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }
}
```

- [ ] **Step 2: 创建 AuthGlobalFilterTest.java**

```java
package com.gateway.filter;

import com.gateway.dto.UserInfo;
import com.gateway.jwt.JwtException;
import com.gateway.jwt.JwtParser;
import com.gateway.jwt.TokenBlacklist;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthGlobalFilterTest {

    private JwtParser jwtParser = mock(JwtParser.class);
    private TokenBlacklist blacklist = mock(TokenBlacklist.class);
    private AuthProperties props = new AuthProperties("secret", "HS256",
            List.of("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh", "/api/v1/auth/login/oauth"),
            new AuthProperties.Blacklist(50, true));
    private AuthGlobalFilter filter = new AuthGlobalFilter(jwtParser, blacklist, props);
    private GatewayFilterChain chain = mock(GatewayFilterChain.class);

    @BeforeEach
    void setUp() {
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Test
    void shouldPassThroughExcludedPaths() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/auth/login").build());

        var result = filter.filter(exchange, chain);

        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void shouldReturn401WhenNoToken() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldReturn401WhenJwtInvalid() {
        when(jwtParser.parse(anyString())).thenThrow(new JwtException("bad token"));

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid"));

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldReturn401WhenBlacklisted() {
        when(jwtParser.parse(anyString())).thenReturn(new UserInfo("user-1", "a@b.com", List.of()));
        when(blacklist.isBlacklisted(anyString(), anyString(), any(Instant.class)))
                .thenReturn(Mono.just(true));

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION,
                                "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE3NTAwMDAwMDAsImV4cCI6MTg1MDAwMDAwMCwianRpIjoianRpLTEifQ.placeholder"));

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
```

- [ ] **Step 3: 运行测试**

```bash
cd gateway && mvn test -pl . -Dtest=AuthGlobalFilterTest
```
Expected: Tests PASS

- [ ] **Step 4: 提交**

```bash
git add gateway/src/main/java/com/gateway/filter/AuthGlobalFilter.java gateway/src/test/java/com/gateway/filter/AuthGlobalFilterTest.java
git commit -m "feat(gateway): AuthGlobalFilter — JWT 认证 + 黑名单校验"
```

---

### Task 6: 限流 — 接口 + Redis 滑动窗口 + Lua 脚本

**Files:**
- Create: `gateway/src/main/java/com/gateway/ratelimit/RateLimiter.java`
- Create: `gateway/src/main/java/com/gateway/ratelimit/RedisRateLimiter.java`
- Create: `gateway/src/main/java/com/gateway/ratelimit/RateLimitConfig.java`
- Create: `gateway/src/test/java/com/gateway/ratelimit/RedisRateLimiterTest.java`

**Interfaces:**
- Consumes: `RateLimitConfig` (限流配置读取)
- Produces: `RateLimiter.isAllowed(String userId, String path)` → `Mono<RateLimitResult>`
- `RateLimitResult` — record(bool allowed, long remaining, long retryAfterMs)

- [ ] **Step 1: 创建 RateLimitConfig.java**

```java
package com.gateway.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties("gateway.ratelimit")
public record RateLimitConfig(
    boolean enabled,
    int defaultLimit,
    Duration defaultWindow,
    List<RouteLimit> routes,
    boolean degradeOnFailure
) {
    public record RouteLimit(String path, int limit) {}

    public int limitForPath(String path) {
        if (routes == null) return defaultLimit;
        return routes.stream()
                .filter(r -> new org.springframework.util.AntPathMatcher().match(r.path(), path))
                .findFirst()
                .map(RouteLimit::limit)
                .orElse(defaultLimit);
    }
}
```

- [ ] **Step 2: 创建 RateLimiter.java**

```java
package com.gateway.ratelimit;

import reactor.core.publisher.Mono;

public interface RateLimiter {
    Mono<RateLimitResult> isAllowed(String userId, String path);
}

record RateLimitResult(boolean allowed, long remaining, long retryAfterMs) {
    public static RateLimitResult allow(long remaining) {
        return new RateLimitResult(true, remaining, 0);
    }

    public static RateLimitResult deny(long retryAfterMs) {
        return new RateLimitResult(false, 0, retryAfterMs);
    }
}
```

- [ ] **Step 3: 创建 RedisRateLimiter.java**

```java
package com.gateway.ratelimit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;

@Component
public class RedisRateLimiter implements RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RedisRateLimiter.class);
    private static final String KEY_PREFIX = "ratelimit:user:";

    private static final RedisScript<List<Long>> SLIDING_WINDOW_SCRIPT = RedisScript.of("""
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local limit = tonumber(ARGV[3])
            local request_id = ARGV[4]

            local window_start = now - window
            redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
            local count = redis.call('ZCOUNT', key, window_start, '+inf')

            if count >= limit then
                local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
                local retry_after = 0
                if #oldest > 0 then
                    retry_after = tonumber(oldest[2]) - window_start
                end
                return {0, retry_after}
            end

            redis.call('ZADD', key, now, request_id)
            local ttl = math.ceil(window / 1000) + 1
            redis.call('EXPIRE', key, ttl)
            return {1, limit - count - 1}
            """, Long.class);

    private final ReactiveRedisTemplate<String, String> redis;
    private final RateLimitConfig config;

    public RedisRateLimiter(ReactiveRedisTemplate<String, String> redis, RateLimitConfig config) {
        this.redis = redis;
        this.config = config;
    }

    @Override
    public Mono<RateLimitResult> isAllowed(String userId, String path) {
        if (!config.enabled()) {
            return Mono.just(RateLimitResult.allow(Long.MAX_VALUE));
        }

        String key = KEY_PREFIX + userId + ":" + routeGroup(path);
        long now = System.currentTimeMillis();
        long windowMs = config.defaultWindow().toMillis();
        int limit = config.limitForPath(path);
        String requestId = System.nanoTime() + "-" + Thread.currentThread().threadId();

        return redis.execute(SLIDING_WINDOW_SCRIPT,
                        List.of(key),
                        List.of(String.valueOf(now), String.valueOf(windowMs),
                                String.valueOf(limit), requestId))
                .map(result -> {
                    if (result.get(0) == 1L) {
                        return RateLimitResult.allow(result.get(1));
                    }
                    return RateLimitResult.deny(result.get(1));
                })
                .defaultIfEmpty(RateLimitResult.allow(Long.MAX_VALUE))
                .onErrorResume(e -> {
                    log.warn("Rate limit Redis error, degraded: {}", e.getMessage());
                    return config.degradeOnFailure()
                            ? Mono.just(RateLimitResult.allow(Long.MAX_VALUE))
                            : Mono.just(RateLimitResult.allow(Long.MAX_VALUE));
                });
    }

    private String routeGroup(String path) {
        if (path.startsWith("/api/v1/auth")) return "auth";
        if (path.startsWith("/api/v1/users")) return "users";
        if (path.startsWith("/api/v1/roles")) return "roles";
        return "default";
    }
}
```

- [ ] **Step 4: 创建 RedisRateLimiterTest.java**

```java
package com.gateway.ratelimit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RedisRateLimiterTest {

    @SuppressWarnings("unchecked")
    private ReactiveRedisTemplate<String, String> redis = mock(ReactiveRedisTemplate.class);
    private RedisRateLimiter limiter;

    @BeforeEach
    void setUp() {
        var config = new RateLimitConfig(true, 300, Duration.ofSeconds(1),
                List.of(new RateLimitConfig.RouteLimit("/api/v1/auth/**", 20),
                        new RateLimitConfig.RouteLimit("/api/v1/users/**", 200)),
                true);
        when(redis.execute(any(), anyList(), anyList())).thenReturn(Mono.just(List.of(1L, 299L)));
        limiter = new RedisRateLimiter(redis, config);
    }

    @Test
    void shouldAllowRequest() {
        StepVerifier.create(limiter.isAllowed("user-1", "/api/v1/users"))
                .expectNextMatches(r -> r.allowed() && r.remaining() == 299L)
                .verifyComplete();
    }

    @Test
    void shouldDenyWhenOverLimit() {
        when(redis.execute(any(), anyList(), anyList())).thenReturn(Mono.just(List.of(0L, 500L)));

        StepVerifier.create(limiter.isAllowed("user-1", "/api/v1/users"))
                .expectNextMatches(r -> !r.allowed() && r.retryAfterMs() == 500L)
                .verifyComplete();
    }

    @Test
    void shouldUseRouteSpecificLimit() {
        when(redis.execute(any(), anyList(), anyList())).thenReturn(Mono.just(List.of(1L, 19L)));

        StepVerifier.create(limiter.isAllowed("user-1", "/api/v1/auth/login"))
                .expectNextMatches(r -> r.allowed() && r.remaining() == 19L)
                .verifyComplete();
    }
}
```

- [ ] **Step 5: 运行测试**

```bash
cd gateway && mvn test -pl . -Dtest=RedisRateLimiterTest
```
Expected: Tests PASS

- [ ] **Step 6: 提交**

```bash
git add gateway/src/main/java/com/gateway/ratelimit/ gateway/src/test/java/com/gateway/ratelimit/
git commit -m "feat(gateway): 滑动窗口限流 — Redis Lua + RateLimiter"
```

---

### Task 7: RateLimitFilter

**Files:**
- Create: `gateway/src/main/java/com/gateway/filter/RateLimitFilter.java`
- Create: `gateway/src/test/java/com/gateway/filter/RateLimitFilterTest.java`

**Interfaces:**
- Consumes: `RateLimiter`, `RateLimitConfig`
- Produces: `RateLimitFilter` — `GlobalFilter`，Order = `HIGHEST_PRECEDENCE + 2`（认证前）

- [ ] **Step 1: 创建 RateLimitFilter.java**

```java
package com.gateway.filter;

import com.gateway.ratelimit.RateLimitConfig;
import com.gateway.ratelimit.RateLimiter;
import com.gateway.ratelimit.RateLimitResult;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class RateLimitFilter implements GlobalFilter {

    private final RateLimiter rateLimiter;
    private final RateLimitConfig config;

    public RateLimitFilter(RateLimiter rateLimiter, RateLimitConfig config) {
        this.rateLimiter = rateLimiter;
        this.config = config;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (!config.enabled()) {
            return chain.filter(exchange);
        }

        String path = exchange.getRequest().getURI().getPath();
        // 限流用 IP 作回退：未认证时用 IP，认证后 AuthFilter 已注入 X-User-Id
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        if (userId == null) {
            // 认证前限流用 IP
            userId = exchange.getRequest().getRemoteAddress() != null
                    ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                    : "anonymous";
        }

        return rateLimiter.isAllowed(userId, path)
                .flatMap(result -> {
                    if (result.allowed()) {
                        return chain.filter(exchange);
                    }
                    exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                    exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
                    exchange.getResponse().getHeaders().set("Retry-After",
                            String.valueOf(result.retryAfterMs() / 1000));
                    String body = "{\"detail\":\"请求过于频繁\",\"retry_after\":" + result.retryAfterMs() / 1000 + "}";
                    byte[] bytes = body.getBytes();
                    return exchange.getResponse()
                            .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(bytes)));
                });
    }
}
```

- [ ] **Step 2: 创建 RateLimitFilterTest.java**

```java
package com.gateway.filter;

import com.gateway.ratelimit.RateLimitConfig;
import com.gateway.ratelimit.RateLimiter;
import com.gateway.ratelimit.RateLimitResult;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimitFilterTest {

    @Test
    void shouldReturn429WhenOverLimit() {
        var limiter = mock(RateLimiter.class);
        when(limiter.isAllowed(anyString(), anyString()))
                .thenReturn(Mono.just(RateLimitResult.deny(500)));
        var config = new RateLimitConfig(true, 300, Duration.ofSeconds(1), List.of(), true);
        var filter = new RateLimitFilter(limiter, config);
        var chain = mock(GatewayFilterChain.class);

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void shouldPassThroughWhenAllowed() {
        var limiter = mock(RateLimiter.class);
        when(limiter.isAllowed(anyString(), anyString()))
                .thenReturn(Mono.just(RateLimitResult.allow(299)));
        var config = new RateLimitConfig(true, 300, Duration.ofSeconds(1), List.of(), true);
        var filter = new RateLimitFilter(limiter, config);
        var chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        var result = filter.filter(exchange, chain);
        reactor.test.StepVerifier.create(result).verifyComplete();
    }
}
```

- [ ] **Step 3: 运行测试**

```bash
cd gateway && mvn test -pl . -Dtest=RateLimitFilterTest
```
Expected: Tests PASS

- [ ] **Step 4: 提交**

```bash
git add gateway/src/main/java/com/gateway/filter/RateLimitFilter.java gateway/src/test/java/com/gateway/filter/RateLimitFilterTest.java
git commit -m "feat(gateway): RateLimitFilter — 限流过滤器"
```

---

### Task 8: 熔断 — Resilience4j 配置 + IngressCircuitBreakerFilter

**Files:**
- Create: `gateway/src/main/java/com/gateway/config/Resilience4jConfig.java`
- Create: `gateway/src/main/java/com/gateway/filter/IngressCircuitBreakerFilter.java`
- Create: `gateway/src/test/java/com/gateway/filter/IngressCircuitBreakerFilterTest.java`

**Interfaces:**
- Consumes: `CircuitBreakerProperties`（gateway.circuit-breaker.ingress 配置）
- Produces: `IngressCircuitBreakerFilter` — `GlobalFilter`，Order = `HIGHEST_PRECEDENCE + 1`（最优先）

- [ ] **Step 1: 创建 Resilience4jConfig.java**

```java
package com.gateway.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.reactor.circuitbreaker.operator.CircuitBreakerOperator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class Resilience4jConfig {

    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(100)
                .failureRateThreshold(50)
                .slowCallRateThreshold(50)
                .slowCallDurationThreshold(Duration.ofMillis(500))
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .permittedNumberOfCallsInHalfOpenState(10)
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .build();
        return CircuitBreakerRegistry.of(config);
    }

    @Bean
    public CircuitBreaker userServiceCircuitBreaker(CircuitBreakerRegistry registry) {
        return registry.circuitBreaker("user-service");
    }
}
```

- [ ] **Step 2: 创建 IngressCircuitBreakerFilter.java**

```java
package com.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class IngressCircuitBreakerFilter implements GlobalFilter {

    private static final Logger log = LoggerFactory.getLogger(IngressCircuitBreakerFilter.class);
    private static final OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
    private static final MemoryMXBean memBean = ManagementFactory.getMemoryMXBean();

    private final IngressConfig config;
    private volatile boolean open = false;
    private int triggerCount = 0;
    private int recoverCount = 0;

    public IngressCircuitBreakerFilter(IngressConfig config) {
        this.config = config;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        updateState();

        if (open) {
            exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
            exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
            byte[] body = "{\"detail\":\"服务繁忙，请稍后重试\"}".getBytes();
            return exchange.getResponse()
                    .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(body)));
        }

        return chain.filter(exchange);
    }

    private void updateState() {
        double cpu = osBean.getCpuLoad();
        if (cpu < 0) return; // JVM 刚启动时 CPU 负载不可用

        long usedMem = memBean.getHeapMemoryUsage().getUsed();
        long maxMem = memBean.getHeapMemoryUsage().getMax();
        double memRatio = (double) usedMem / maxMem;

        boolean overloaded = cpu > config.cpuThreshold() || memRatio > config.memoryThreshold();

        if (overloaded) {
            triggerCount++;
            recoverCount = 0;
            if (triggerCount >= config.triggerCount() && !open) {
                open = true;
                log.warn("Ingress circuit breaker OPENED: cpu={:.2f}, mem={:.2f}", cpu, memRatio);
            }
        } else {
            recoverCount++;
            triggerCount = 0;
            if (recoverCount >= config.recoverCount() && open) {
                open = false;
                log.info("Ingress circuit breaker CLOSED: cpu={:.2f}, mem={:.2f}", cpu, memRatio);
            }
        }
    }
}

@ConfigurationProperties("gateway.circuit-breaker.ingress")
record IngressConfig(double cpuThreshold, double memoryThreshold, int sampleInterval,
                     int triggerCount, int recoverCount) {}
```

- [ ] **Step 3: 创建 IngressCircuitBreakerFilterTest.java**

```java
package com.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IngressCircuitBreakerFilterTest {

    @Test
    void shouldPassThroughWhenClosed() {
        var config = new IngressConfig(0.99, 0.99, 5, 3, 3);
        var filter = new IngressCircuitBreakerFilter(config);
        var chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        var result = filter.filter(exchange, chain);
        reactor.test.StepVerifier.create(result).verifyComplete();
    }
}
```

- [ ] **Step 4: 运行测试**

```bash
cd gateway && mvn test -pl . -Dtest=IngressCircuitBreakerFilterTest
```
Expected: Tests PASS

- [ ] **Step 5: 提交**

```bash
git add gateway/src/main/java/com/gateway/config/Resilience4jConfig.java gateway/src/main/java/com/gateway/filter/IngressCircuitBreakerFilter.java gateway/src/test/java/com/gateway/filter/IngressCircuitBreakerFilterTest.java
git commit -m "feat(gateway): 熔断 — Resilience4j 下游 + 入口熔断过滤器"
```

---

### Task 9: 路由 + Redis + Security 配置

**Files:**
- Create: `gateway/src/main/java/com/gateway/config/RouteConfig.java`
- Create: `gateway/src/main/java/com/gateway/config/RedisConfig.java`
- Create: `gateway/src/main/java/com/gateway/config/SecurityConfig.java`

- [ ] **Step 1: 创建 RouteConfig.java**

```java
package com.gateway.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RouteConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder, CircuitBreaker userServiceCb) {
        return builder.routes()
                .route("user-service", r -> r
                        .path("/api/v1/**")
                        .filters(f -> f.circuitBreaker(c -> c
                                .setName("user-service")
                                .setFallbackUri("forward:/fallback/user-service")))
                        .uri("http://user-service:8000"))
                .build();
    }
}
```

- [ ] **Step 2: 创建 RedisConfig.java**

```java
package com.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public ReactiveRedisTemplate<String, String> reactiveRedisTemplate(
            ReactiveRedisConnectionFactory connectionFactory) {
        StringRedisSerializer serializer = new StringRedisSerializer();
        RedisSerializationContext<String, String> context = RedisSerializationContext
                .<String, String>newSerializationContext(serializer)
                .key(serializer)
                .value(serializer)
                .hashKey(serializer)
                .hashValue(serializer)
                .build();
        return new ReactiveRedisTemplate<>(connectionFactory, context);
    }
}
```

- [ ] **Step 3: 创建 SecurityConfig.java**

```java
package com.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .authorizeExchange(exchanges -> exchanges.anyExchange().permitAll())
                .build();
    }
}
```

- [ ] **Step 4: 创建 FallbackController**

```java
package com.gateway.config;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
public class FallbackController {

    @RequestMapping("/fallback/user-service")
    public Mono<ResponseEntity<Map<String, String>>> userServiceFallback() {
        return Mono.just(ResponseEntity
                .status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("detail", "服务暂时不可用")));
    }
}
```

- [ ] **Step 5: 提交**

```bash
git add gateway/src/main/java/com/gateway/config/
git commit -m "feat(gateway): 路由 + Redis + Security 配置"
```

---

### Task 10: Dockerfile + docker-compose.yml

**Files:**
- Create: `gateway/Dockerfile`
- Create: `gateway/docker-compose.yml`

- [ ] **Step 1: 创建 Dockerfile**

```dockerfile
FROM eclipse-temurin:21-jre-alpine
COPY target/gateway-*.jar app.jar
ENTRYPOINT ["java", \
  "-XX:+UseZGC", \
  "-XX:+ZGenerational", \
  "-XX:MaxRAMPercentage=75", \
  "-jar", "/app.jar"]
```

- [ ] **Step 2: 创建 docker-compose.yml**

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

- [ ] **Step 3: 提交**

```bash
git add gateway/Dockerfile gateway/docker-compose.yml
git commit -m "feat(gateway): Dockerfile + docker-compose 本地开发环境"
```

---

### Task 11: 集成测试

**Files:**
- Create: `gateway/src/test/java/com/gateway/GatewayIntegrationTest.java`

- [ ] **Step 1: 创建 GatewayIntegrationTest.java**

```java
package com.gateway;

import com.gateway.jwt.JwtParser;
import com.gateway.jwt.TokenBlacklist;
import com.gateway.ratelimit.RateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class GatewayIntegrationTest {

    @Autowired
    private WebTestClient webClient;

    @MockBean
    private TokenBlacklist blacklist;

    @MockBean
    private RateLimiter rateLimiter;

    @Test
    void shouldReturn401WhenNoToken() {
        webClient.get().uri("/api/v1/users")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.detail").isEqualTo("缺少认证凭据");
    }

    @Test
    void shouldPassThroughAuthEndpoints() {
        webClient.post().uri("/api/v1/auth/login")
                .exchange()
                .expectStatus().is4xxClientError(); // user-service 不可达，但已放行
    }
}
```

- [ ] **Step 2: 创建 application-test.yml**

```yaml
spring:
  data:
    redis:
      host: localhost
      port: 6379
      cluster: null
  cloud:
    gateway:
      routes:
        - id: user-service
          uri: no://op
          predicates:
            - Path=/api/v1/**

gateway:
  auth:
    jwt-secret-key: test-secret-key-at-least-256-bits-long!!
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
    enabled: false
  circuit-breaker:
    ingress:
      cpu-threshold: 0.99
      memory-threshold: 0.99
      sample-interval: 5s
      trigger-count: 3
      recover-count: 3

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
```

- [ ] **Step 3: 运行集成测试**

```bash
cd gateway && mvn test -pl . -Dtest=GatewayIntegrationTest
```
Expected: Tests PASS

- [ ] **Step 4: 提交**

```bash
git add gateway/src/test/java/com/gateway/GatewayIntegrationTest.java gateway/src/main/resources/application-test.yml
git commit -m "test(gateway): 集成测试 — 认证流程端到端"
```

---

### Task 12: 最终验证

- [ ] **Step 1: 运行全部测试**

```bash
cd gateway && mvn test
```
Expected: All tests PASS

- [ ] **Step 2: 编译打包**

```bash
cd gateway && mvn package -DskipTests
```
Expected: BUILD SUCCESS，`target/gateway-0.0.1-SNAPSHOT.jar` 生成

- [ ] **Step 3: 提交最终状态**

```bash
git add -A
git commit -m "feat(gateway): 完成 JWT 认证网关实现"
```