# 安全架构设计

## 1. 安全目标

### 1.1 CIA 三要素

| 要素 | 目标 | 实现措施 |
|------|------|----------|
| **保密性 (Confidentiality)** | 保护敏感数据不被未授权访问 | 加密传输、访问控制、数据脱敏 |
| **完整性 (Integrity)** | 确保数据不被未授权修改 | 输入验证、签名验证、审计日志 |
| **可用性 (Availability)** | 确保系统对授权用户可用 | 速率限制、账户锁定、容错设计 |

### 1.2 威胁模型

```
攻击向量:
┌─────────────────────────────────────────────────────────────────┐
│                        威胁模型                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  外部攻击者                                                      │
│       │                                                         │
│       ├──► 网络层攻击                                            │
│       │    • DDoS/DoS                                           │
│       │    • MITM (中间人)                                       │
│       │    • 流量嗅探                                            │
│       │                                                         │
│       ├──► 应用层攻击                                            │
│       │    • SQL 注入                                            │
│       │    • XSS / CSRF                                          │
│       │    • 暴力破解                                            │
│       │    • 会话劫持                                            │
│       │                                                         │
│       └──► 业务逻辑攻击                                          │
│            • 越权访问                                            │
│            • 数据遍历                                            │
│            • 批量注册                                            │
│                                                                 │
│  内部威胁                                                        │
│       • 权限滥用                                                 │
│       • 数据泄露                                                 │
│       • 配置错误                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 认证架构

### 2.1 JWT 认证流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         JWT 认证架构                                     │
└─────────────────────────────────────────────────────────────────────────┘

登录阶段:
┌─────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────┐
│ Client  │      │ AuthController│      │ AuthService  │      │ Database │
└────┬────┘      └──────┬───────┘      └──────┬───────┘      └────┬─────┘
     │                  │                     │                   │
     │ POST /login      │                     │                   │
     │ {email, pwd}    │                     │                   │
     │─────────────────▶│                     │                   │
     │                  │                     │                   │
     │                  │ authenticate()      │                   │
     │                  │────────────────────▶│                   │
     │                  │                     │                   │
     │                  │                     │ validate user     │
     │                  │                     │──────────────────▶│
     │                  │                     │◀──────────────────│
     │                  │                     │                   │
     │                  │                     │ check password    │
     │                  │                     │ (BCrypt)          │
     │                  │                     │                   │
     │                  │                     │ generate tokens   │
     │                  │                     │ ┌───────────────┐ │
     │                  │                     │ │ Access Token  │ │
     │                  │                     │ │ • User ID     │ │
     │                  │                     │ │ • Roles       │ │
     │                  │                     │ │ • Exp: 15min  │ │
     │                  │                     │ │ • RSA Signed  │ │
     │                  │                     │ └───────────────┘ │
     │                  │                     │                   │
     │                  │                     │ ┌───────────────┐ │
     │                  │                     │ │ Refresh Token │ │
     │                  │                     │ │ • Token ID    │ │
     │                  │                     │ │ • Exp: 7days  │ │
     │                  │                     │ │ • Stored in DB│ │
     │                  │                     │ └───────────────┘ │
     │                  │                     │                   │
     │                  │◀────────────────────│                   │
     │                  │ TokenResponse       │                   │
     │                  │                     │                   │
     │ 200 OK           │                     │                   │
     │ {access, refresh}│                     │                   │
     │◀─────────────────│                     │                   │
     │                  │                     │                   │

请求阶段:
     │                  │                     │                   │
     │ GET /users/me    │                     │                   │
     │ Authorization:   │                     │                   │
     │ Bearer <token>   │                     │                   │
     │─────────────────▶│                     │                   │
     │                  │                     │                   │
     │                  │ JwtAuthFilter       │                   │
     │                  │ ┌─────────────────┐ │                   │
     │                  │ │ 1. Extract Token│ │                   │
     │                  │ │ 2. Parse JWT    │ │                   │
     │                  │ │ 3. Verify Sig   │ │                   │
     │                  │ │ 4. Check Exp    │ │                   │
     │                  │ │ 5. Load User    │ │                   │
     │                  │ │ 6. Set Context  │ │                   │
     │                  │ └─────────────────┘ │                   │
     │                  │                     │                   │
     │                  │ @PreAuthorize       │                   │
     │                  │ check permissions   │                   │
     │                  │                     │                   │
     │                  │ getCurrentUser()    │                   │
     │                  │────────────────────▶│                   │
     │                  │                     │                   │
     │ 200 OK           │                     │                   │
     │ {user data}      │                     │                   │
     │◀─────────────────│                     │                   │
```

### 2.2 JWT 令牌设计

#### Access Token (访问令牌)

**Header**:
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "key-id-2024-03"
}
```

**Payload**:
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "iss": "usermanagement-api",
  "aud": "usermanagement-client",
  "iat": 1711192800,
  "exp": 1711194600,
  "jti": "unique-token-id",
  "username": "johndoe",
  "email": "john@example.com",
  "roles": ["user"],
  "permissions": ["users:read", "users:update"]
}
```

**有效期**: 15 分钟 (900秒)

#### Refresh Token (刷新令牌)

**存储方式**: 数据库存储 (user_sessions 表)

**结构**:
```json
{
  "token_id": "refresh-token-uuid",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "hashed_token": "bcrypt-hash-of-token",
  "expires_at": "2024-03-30T10:30:00Z",
  "created_at": "2024-03-23T10:30:00Z",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "is_revoked": false
}
```

**有效期**: 7 天

### 2.3 RSA 密钥管理

```
密钥生成:
┌──────────────────────────────────────────────────────────────┐
│ $ openssl genrsa -out private.pem 2048                      │
│ $ openssl rsa -in private.pem -pubout -out public.pem       │
└──────────────────────────────────────────────────────────────┘

密钥存储:
┌──────────────────────────────────────────────────────────────┐
│ 生产环境:                                                    │
│ • 私钥: AWS Secrets Manager / HashiCorp Vault               │
│ • 公钥: 应用配置文件 (非敏感)                                │
│                                                              │
│ 开发环境:                                                    │
│ • 私钥/公钥: 环境变量或配置文件                              │
└──────────────────────────────────────────────────────────────┘

密钥轮换:
┌──────────────────────────────────────────────────────────────┐
│ 1. 生成新密钥对                                              │
│ 2. 部署新公钥 (支持多 key)                                   │
│ 3. 强制刷新所有令牌                                          │
│ 4. 24小时后废弃旧密钥                                        │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 授权架构 (RBAC)

### 3.1 权限模型

```
┌─────────────────────────────────────────────────────────────────┐
│                     RBAC 权限模型                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户 (User)          角色 (Role)          权限 (Permission)    │
│  ┌─────────┐          ┌─────────┐          ┌──────────────┐     │
│  │ alice   │◄────────►│ admin   │◄────────►│ users:create │     │
│  └─────────┘   M:N    └─────────┘   M:N    ├──────────────┤     │
│                                            │ users:read   │     │
│  ┌─────────┐          ┌─────────┐          │ users:update │     │
│  │ bob     │◄────────►│ user    │◄────────►│ users:delete │     │
│  └─────────┘          └─────────┘          └──────────────┘     │
│                                                                 │
│  权限格式: {resource}:{action}                                   │
│                                                                 │
│  资源 (Resource): users, roles, permissions                      │
│  操作 (Action): create, read, update, delete, list               │
│                                                                 │
│  示例:                                                           │
│  • users:read    - 查看用户信息                                  │
│  • users:create  - 创建用户                                      │
│  • roles:update  - 修改角色                                      │
│  • *:*           - 超级管理员 (所有权限)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 默认角色定义

| 角色 | 权限 | 说明 |
|------|------|------|
| `superadmin` | `*:*` | 超级管理员，拥有所有权限 |
| `admin` | `users:*`, `roles:read`, `permissions:read` | 管理员，管理用户和查看角色 |
| `user` | `users:read`, `users:update` (仅自己) | 普通用户，管理自己的资料 |
| `guest` | `users:read` (仅自己) | 访客，有限的只读权限 |

### 3.3 方法级权限控制

```java
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    // 需要 users:read 权限
    @GetMapping
    @PreAuthorize("hasAuthority('users:read')")
    public Page<UserResponse> listUsers(Pageable pageable) {
        // ...
    }

    // 需要 users:read 权限，或查询自己
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('users:read') or @securityService.isCurrentUser(#id)")
    public UserResponse getUser(@PathVariable UUID id) {
        // ...
    }

    // 需要 users:create 权限
    @PostMapping
    @PreAuthorize("hasAuthority('users:create')")
    public ResponseEntity<UserResponse> createUser(
            @Valid @RequestBody UserCreateRequest request) {
        // ...
    }

    // 需要 users:update 权限，或更新自己
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('users:update') or @securityService.isCurrentUser(#id)")
    public UserResponse updateUser(
            @PathVariable UUID id,
            @Valid @RequestBody UserUpdateRequest request) {
        // ...
    }

    // 需要 users:delete 权限
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('users:delete')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteUser(@PathVariable UUID id) {
        // ...
    }
}
```

### 3.4 权限评估器

```java
@Component("securityService")
public class SecurityService {

    private final UserRepository userRepository;

    public boolean isCurrentUser(UUID userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return false;
        }

        String currentUserId = auth.getName();
        return currentUserId.equals(userId.toString());
    }

    public boolean hasPermission(String resource, String action) {
        // 自定义权限检查逻辑
    }
}
```

---

## 4. 安全机制

### 4.1 密码安全

```java
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        // 强度因子 12 (2^12 iterations)
        return new BCryptPasswordEncoder(12);
    }
}
```

**密码策略**:
- 最小长度: 8 字符
- 最大长度: 100 字符
- 必须包含: 大写字母、小写字母、数字
- 可选包含: 特殊字符
- 哈希算法: BCrypt (自适应，可升级)

### 4.2 账户锁定机制

```
登录失败处理:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  失败次数        操作                  锁定时间             │
│  ────────────────────────────────────────────────────────   │
│  1-4 次         记录日志               无                   │
│  5 次           锁定账户               15 分钟              │
│  10 次          延长锁定               1 小时               │
│  20 次          通知管理员             24 小时              │
│                                                             │
│  数据模型:                                                  │
│  ┌─────────────────┐                                        │
│  │ login_attempts  │                                        │
│  ├─────────────────┤                                        │
│  │ user_id         │                                        │
│  │ ip_address      │                                        │
│  │ attempt_count   │                                        │
│  │ last_attempt    │                                        │
│  │ locked_until    │                                        │
│  └─────────────────┘                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 速率限制

```java
@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final LoadingCache<String, Bucket> buckets;

    public RateLimitFilter() {
        this.buckets = Caffeine.newBuilder()
            .expireAfterAccess(1, TimeUnit.HOURS)
            .build(this::createNewBucket);
    }

    private Bucket createNewBucket(String key) {
        // 每小时 100 次请求
        Bandwidth limit = Bandwidth.classic(100, Refill.intervally(100, Duration.ofHours(1)));
        return Bucket.builder()
            .addLimit(limit)
            .build();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String clientIp = getClientIp(request);
        Bucket bucket = buckets.get(clientIp);

        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            response.addHeader("X-Rate-Limit-Remaining", String.valueOf(probe.getRemainingTokens()));
            filterChain.doFilter(request, response);
        } else {
            response.setStatus(429);
            response.getWriter().write("{\"error\":\"Rate limit exceeded\"}");
        }
    }
}
```

**速率限制规则**:

| 端点 | 限制 | 说明 |
|------|------|------|
| 通用 API | 1000/小时 | 认证用户 |
| 通用 API | 100/小时 | 未认证用户 |
| /auth/login | 10/小时/IP | 防止暴力破解 |
| /auth/register | 5/小时/IP | 防止批量注册 |
| /auth/refresh | 100/小时 | 正常刷新频率 |

### 4.4 输入验证

```java
public record UserCreateRequest(
    @NotBlank(message = "用户名不能为空")
    @Size(min = 3, max = 50, message = "用户名长度必须在 3-50 字符之间")
    @Pattern(regexp = "^[a-zA-Z0-9_]+$", message = "用户名只能包含字母、数字和下划线")
    String username,

    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    @Size(max = 255, message = "邮箱长度不能超过 255 字符")
    String email,

    @NotBlank(message = "密码不能为空")
    @Size(min = 8, max = 100, message = "密码长度必须在 8-100 字符之间")
    @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).+$",
             message = "密码必须包含至少一个大写字母、一个小写字母和一个数字")
    String password,

    @Size(max = 100, message = "名字长度不能超过 100 字符")
    String firstName,

    @Size(max = 100, message = "姓氏长度不能超过 100 字符")
    String lastName
) {}
```

### 4.5 SQL 注入防护

- 使用 **JPA/Hibernate** (参数化查询)
- 禁止使用字符串拼接 SQL
- 启用 Hibernate 的 SQL 日志审计

```java
// 安全示例 (使用参数化查询)
@Query("SELECT u FROM User u WHERE u.email = :email")
Optional<User> findByEmail(@Param("email") String email);

// 危险示例 (不要这样做)
// @Query("SELECT * FROM users WHERE email = '" + email + "'")
```

### 4.6 XSS 防护

- 前端使用 React/Next.js (自动转义)
- 后端使用 DTO，不直接暴露实体
- 响应头配置:

```java
@Configuration
public class SecurityHeadersConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .headers(headers -> headers
                .contentSecurityPolicy(csp ->
                    csp.policyDirectives("default-src 'self'"))
                .xssProtection(xss ->
                    xss.headerValue(XXssProtectionHeaderWriter.HeaderValue.ENABLED_MODE_BLOCK))
                .frameOptions(frame ->
                    frame.sameOrigin())
            );
        return http.build();
    }
}
```

### 4.7 CSRF 防护

对于 API 服务器 (无状态):
- 使用 JWT 认证 (天然 CSRF 防护)
- 不使用 Cookie-based Session

如果必须使用 Cookie:
```java
http
    .csrf(csrf -> csrf
        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
    );
```

---

## 5. 数据保护

### 5.1 传输层安全

```yaml
# application-prod.yml
server:
  ssl:
    enabled: true
    protocol: TLS
    enabled-protocols: TLSv1.2,TLSv1.3
    cipher-suites: TLS_AES_256_GCM_SHA384,TLS_CHACHA20_POLY1305_SHA256
    certificate: classpath:ssl/server.crt
    certificate-private-key: classpath:ssl/server.key
```

**HSTS 配置**:
```java
http.headers(headers ->
    headers.httpStrictTransportSecurity(hsts ->
        hsts.includeSubDomains(true)
            .maxAgeInSeconds(31536000)  // 1 year
    )
);
```

### 5.2 敏感数据存储

| 数据类型 | 存储方式 | 说明 |
|----------|----------|------|
| 密码 | BCrypt 哈希 | 单向哈希，不可还原 |
| JWT 密钥 | 环境变量/Vault | 生产环境加密存储 |
| 个人身份信息 | 明文 (已授权) | 数据库级访问控制 |
| 日志中的敏感信息 | 脱敏 | 使用掩码处理 |

### 5.3 日志脱敏

```java
@Component
public class SensitiveDataMasker {

    private static final Pattern EMAIL_PATTERN =
        Pattern.compile("([a-zA-Z0-9._%+-]{2})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})");

    public String maskEmail(String email) {
        if (email == null) return null;
        Matcher matcher = EMAIL_PATTERN.matcher(email);
        if (matcher.find()) {
            return matcher.group(1) + "***@" + matcher.group(2);
        }
        return "***";
    }

    public String maskPassword(String password) {
        return "[REDACTED]";
    }
}
```

---

## 6. 安全监控

### 6.1 审计日志

```java
@Aspect
@Component
public class AuditLogAspect {

    @Around("@annotation(Auditable)")
    public Object logAudit(ProceedingJoinPoint joinPoint) throws Throwable {
        // 记录操作前状态
        AuditLogEntry entry = new AuditLogEntry();
        entry.setTimestamp(Instant.now());
        entry.setUser(getCurrentUser());
        entry.setAction(joinPoint.getSignature().getName());
        entry.setIpAddress(getClientIp());
        entry.setUserAgent(getUserAgent());

        try {
            Object result = joinPoint.proceed();
            entry.setStatus("SUCCESS");
            return result;
        } catch (Exception e) {
            entry.setStatus("FAILURE");
            entry.setErrorMessage(e.getMessage());
            throw e;
        } finally {
            auditLogRepository.save(entry);
        }
    }
}
```

**审计事件**:
- 用户登录/登出
- 密码修改
- 敏感数据访问
- 权限变更
- 配置修改

### 6.2 安全告警

| 告警类型 | 触发条件 | 响应 |
|----------|----------|------|
| 暴力破解 | 1小时内10次登录失败 | 锁定IP，通知管理员 |
| 异常时间登录 | 凌晨2-5点登录 | 发送邮件确认 |
| 异地登录 | IP地理位置变化 | 发送邮件确认 |
| 敏感操作 | 删除管理员账户 | 立即通知超级管理员 |
| 高错误率 | 5分钟内错误率>10% | 触发系统检查 |

---

## 7. 安全测试

### 7.1 安全测试清单

- [ ] 认证绕过测试
- [ ] 权限提升测试
- [ ] SQL 注入测试
- [ ] XSS 注入测试
- [ ] CSRF 攻击测试
- [ ] 敏感数据泄露测试
- [ ] 速率限制测试
- [ ] 会话固定测试
- [ ] 密码策略测试
- [ ] JWT 安全性测试

### 7.2 依赖安全扫描

```bash
# OWASP Dependency Check
./mvnw org.owasp:dependency-check-maven:check

# Snyk 扫描
snyk test

# GitHub Dependabot
# 自动 PR 更新有漏洞的依赖
```

---

## 8. 应急响应

### 8.1 安全事件响应流程

```
检测 ──► 分析 ──► 遏制 ──► 根除 ──► 恢复 ──► 总结
 │        │        │        │        │        │
 │        │        │        │        │        └─► 更新流程
 │        │        │        │        └─► 恢复服务
 │        │        │        └─► 修复漏洞
 │        │        └─► 隔离受影响的系统
 │        └─► 评估影响范围
 └─► 日志告警、监控发现
```

### 8.2 密钥泄露响应

1. **立即**: 吊销泄露的密钥
2. **5分钟内**: 轮换所有 JWT 签名密钥
3. **30分钟内**: 强制所有用户重新登录
4. **24小时内**: 审计访问日志，评估影响
5. **事后**: 复盘泄露原因，加强管控

---

## 9. 合规性

### 9.1 遵循标准

- **OWASP Top 10**: 防护措施覆盖
- **GDPR**: 用户数据保护 (如适用)
- **等保 2.0**: 网络安全等级保护 (如适用)
- **ISO 27001**: 信息安全管理体系

### 9.2 密码学标准

- **哈希**: BCrypt (自适应)
- **签名**: RSA-2048 / ECDSA P-256
- **对称加密**: AES-256-GCM
- **TLS**: 1.2+ (禁用 1.0/1.1)
