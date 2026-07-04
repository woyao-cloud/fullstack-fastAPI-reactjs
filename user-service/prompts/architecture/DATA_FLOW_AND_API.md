# 数据流与接口设计

## 1. 数据流图

### 1.1 系统数据流概览

```

```

### 1.2 认证数据流

```
```

### 1.3 用户 CRUD 数据流



---

## 2. API 接口契约

### 2.1 基础规范

**Base URL**: `/api/v1`

**请求头**:
```
Content-Type: application/json
Accept: application/json
Authorization: Bearer {access_token}
```

**响应格式**:
```json
{
  "data": { ... },           // 成功时返回的数据
  "meta": {                  // 分页等信息
    "page": 1,
    "size": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**错误响应**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入验证失败",
    "details": [
      { "field": "email", "message": "邮箱格式不正确" }
    ]
  }
}
```

### 2.2 认证接口

#### POST /auth/register
用户注册

**Request**:
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Validation**:
- username: 3-50字符, 字母数字下划线
- email: 有效邮箱格式
- password: 8-100字符, 包含大小写字母和数字
- firstName/lastName: 可选, 2-100字符

**Response 201**:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isActive": true,
    "isVerified": false,
    "createdAt": "2024-03-23T10:30:00Z"
  }
}
```

**Response 400**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入验证失败",
    "details": [
      { "field": "email", "message": "邮箱已被使用" }
    ]
  }
}
```

#### POST /auth/login
用户登录

**Request**:
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response 200**:
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "johndoe",
      "email": "john@example.com"
    }
  }
}
```

**Response 401**:
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "邮箱或密码错误"
  }
}
```

**Rate Limit**: 10次/小时/IP

#### POST /auth/refresh
刷新访问令牌

**Request**:
```json
{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

**Response 200**:
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 1800
  }
}
```

#### POST /auth/logout
用户登出

**Headers**:
```
Authorization: Bearer {access_token}
```

**Response 204**: No Content

#### GET /auth/me
获取当前登录用户

**Headers**:
```
Authorization: Bearer {access_token}
```

**Response 200**:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["user"],
    "permissions": ["users:read", "users:update"],
    "isActive": true,
    "createdAt": "2024-03-23T10:30:00Z",
    "lastLoginAt": "2024-03-23T12:00:00Z"
  }
}
```

### 2.3 用户管理接口

#### GET /users
获取用户列表 (需要 `users:read` 权限)

**Query Parameters**:
- `page`: 页码 (默认 0)
- `size`: 每页数量 (默认 20, 最大 100)
- `sort`: 排序字段 (默认 createdAt,desc)
- `search`: 搜索关键词 (用户名/邮箱)
- `isActive`: 筛选活跃用户

**Response 200**:
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "johndoe",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isActive": true,
      "createdAt": "2024-03-23T10:30:00Z"
    }
  ],
  "meta": {
    "page": 0,
    "size": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### GET /users/{id}
获取用户详情

**Path Parameters**:
- `id`: 用户ID (UUID)

**Response 200**:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": [
      {
        "id": "role-id-1",
        "name": "user",
        "permissions": ["users:read", "users:update"]
      }
    ],
    "isActive": true,
    "isVerified": false,
    "createdAt": "2024-03-23T10:30:00Z",
    "updatedAt": "2024-03-23T12:00:00Z",
    "lastLoginAt": "2024-03-23T12:00:00Z"
  }
}
```

#### POST /users
创建用户 (管理员)

**Request**:
```json
{
  "username": "janedoe",
  "email": "jane@example.com",
  "password": "SecurePass123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "roles": ["user"],
  "isActive": true
}
```

**Response 201**:
```json
{
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "username": "janedoe",
    "email": "jane@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "roles": ["user"],
    "isActive": true,
    "createdAt": "2024-03-23T13:00:00Z"
  }
}
```

#### PUT /users/{id}
更新用户信息

**Request**:
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "isActive": true
}
```

**注意**: 用户只能更新自己的信息，管理员可以更新任何人

**Response 200**:
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "johndoe",
    "email": "john@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "isActive": true,
    "updatedAt": "2024-03-23T14:00:00Z"
  }
}
```

#### DELETE /users/{id}
删除用户 (软删除)

**Response 204**: No Content

### 2.4 角色管理接口

#### GET /roles
获取角色列表

**Response 200**:
```json
{
  "data": [
    {
      "id": "role-id-1",
      "name": "superadmin",
      "description": "超级管理员",
      "permissions": ["*:*"]
    },
    {
      "id": "role-id-2",
      "name": "admin",
      "description": "管理员",
      "permissions": ["users:*", "roles:read"]
    },
    {
      "id": "role-id-3",
      "name": "user",
      "description": "普通用户",
      "isDefault": true,
      "permissions": ["users:read", "users:update"]
    }
  ]
}
```

#### GET /roles/{id}
获取角色详情

#### POST /roles
创建角色

**Request**:
```json
{
  "name": "moderator",
  "description": "内容管理员",
  "permissions": ["users:read", "posts:moderate"]
}
```

#### PUT /roles/{id}
更新角色

#### DELETE /roles/{id}
删除角色

### 2.5 权限管理接口

#### GET /permissions
获取权限列表

**Response 200**:
```json
{
  "data": [
    {
      "id": "perm-id-1",
      "name": "users:create",
      "resource": "users",
      "action": "create"
    },
    {
      "id": "perm-id-2",
      "name": "users:read",
      "resource": "users",
      "action": "read"
    },
    {
      "id": "perm-id-3",
      "name": "users:update",
      "resource": "users",
      "action": "update"
    },
    {
      "id": "perm-id-4",
      "name": "users:delete",
      "resource": "users",
      "action": "delete"
    }
  ]
}
```

---

## 3. 错误代码定义

### 3.1 标准 HTTP 状态码

| 状态码 | 场景 |
|--------|------|
| 200 OK | 请求成功 |
| 201 Created | 资源创建成功 |
| 204 No Content | 删除成功，无返回内容 |
| 400 Bad Request | 请求参数错误 |
| 401 Unauthorized | 未认证/令牌无效 |
| 403 Forbidden | 无权限访问 |
| 404 Not Found | 资源不存在 |
| 409 Conflict | 资源冲突 (如重复邮箱) |
| 422 Unprocessable | 语义错误 (如验证失败) |
| 429 Too Many Requests | 请求过于频繁 |
| 500 Internal Error | 服务器内部错误 |

### 3.2 业务错误代码

| 错误代码 | HTTP | 描述 |
|----------|------|------|
| `VALIDATION_ERROR` | 400 | 输入验证失败 |
| `INVALID_CREDENTIALS` | 401 | 邮箱或密码错误 |
| `TOKEN_EXPIRED` | 401 | 令牌已过期 |
| `TOKEN_INVALID` | 401 | 令牌无效 |
| `ACCESS_DENIED` | 403 | 权限不足 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `ROLE_NOT_FOUND` | 404 | 角色不存在 |
| `EMAIL_EXISTS` | 409 | 邮箱已被使用 |
| `USERNAME_EXISTS` | 409 | 用户名已被使用 |
| `ACCOUNT_LOCKED` | 423 | 账户已锁定 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求过于频繁 |
| `INTERNAL_ERROR` | 500 | 内部服务器错误 |

---

## 4. 分页规范

### 4.1 请求参数

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| page | int | 0 | 页码 (从0开始) |
| size | int | 20 | 每页数量 (1-100) |
| sort | string | createdAt,desc | 排序字段和方向 |

### 4.2 响应元数据

```json
{
  "meta": {
    "page": 0,
    "size": 20,
    "total": 100,
    "totalPages": 5,
    "first": true,
    "last": false,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### 4.3 排序语法

- `createdAt,desc` - 按创建时间降序
- `username,asc` - 按用户名升序
- `lastLoginAt,desc` - 按最后登录时间降序

---

## 5. 安全考虑

### 5.1 认证流程

1. **登录**: 邮箱 + 密码 → JWT 令牌对
2. **请求**: Bearer Token 在 Authorization 头
3. **验证**: 服务端验证签名和过期时间
4. **刷新**: 使用 Refresh Token 获取新的 Access Token

### 5.2 敏感数据处理

- **密码**: BCrypt 哈希 (强度 12)，永不返回
- **令牌**: HTTPS 传输，HttpOnly Cookie (可选)
- **日志**: 脱敏处理，不包含敏感信息

### 5.3 CORS 配置



## 6. 版本控制

### 6.1 API 版本策略

**URL路径版本控制**: `/api/v1/...`

**版本升级触发条件**:
| 触发条件 | 说明 | 示例 |
|----------|------|------|
| 破坏性变更 | 接口删除、参数变更、响应格式变更 | 删除旧字段、修改URL路径 |
| 数据格式变更 | 数据类型变更、枚举值变更 | 将字符串改为对象 |
| 安全漏洞修复 | 需要废弃旧版本以修复安全漏洞 | 认证方式变更 |
| 重大功能重构 | 底层实现变更影响API行为 | 权限模型重构 |

**向后兼容性策略**:
| 变更类型 | 兼容性 | 处理方式 |
|----------|--------|----------|
| 新增字段 | 向后兼容 | 直接添加，默认值处理 |
| 新增接口 | 向后兼容 | 直接添加 |
| 新增可选参数 | 向后兼容 | 直接添加 |
| 删除字段 | 不兼容 | 需要升级版本 |
| 修改数据类型 | 不兼容 | 需要升级版本 |
| 修改URL路径 | 不兼容 | 需要升级版本 |
| 修改认证方式 | 不兼容 | 需要升级版本 |

**版本并行策略**:
- 保持至少2个版本并行（当前版本 + 上一个版本）
- 新版本发布后，旧版本保留6个月
- 通过响应头通知客户端版本弃用: `Sunset: Sun, 30 Sep 2026 00:00:00 GMT`

### 6.2 弃用策略

1. **提前通知**: API弃用前3个月通过多渠道通知
   - 开发者邮件列表
   - API文档标记
   - 响应头添加 `Deprecation: true`

2. **迁移支持**:
   - 提供详细的迁移指南文档
   - 提供代码示例
   - 设立迁移咨询窗口

3. **版本维护**:
   - 维护旧版本至少6个月
   - 旧版本仅修复安全漏洞，不添加新功能
   - 旧版本不保证性能优化
