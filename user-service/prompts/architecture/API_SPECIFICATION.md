# API 接口规范

## 基础规范

- URL 格式: `/api/v1/{resource}`
- 请求头: `Content-Type: application/json`
- 认证: `Authorization: Bearer {token}`

## 响应格式

**成功:**
```json
{
  "data": {},
  "meta": { "page": 1, "total": 100 }
}
```

**错误:**
```json
{
  "error": {
    "code": "validation_error",
    "message": "输入验证失败"
  }
}
```

## 核心端点

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /auth/login | 登录 |
| POST | /auth/register | 注册 |
| POST | /auth/refresh | 刷新令牌 |
| GET | /auth/me | 当前用户 |
| GET | /users | 用户列表 |
| POST | /users | 创建用户 |
| GET | /users/{id} | 用户详情 |
| PUT | /users/{id} | 更新用户 |
| DELETE | /users/{id} | 删除用户 |
| GET | /roles | 角色列表 |
| GET | /permissions | 权限列表 |

## 速率限制

- 认证用户: 1000/小时
- 未认证: 100/小时
- 登录端点: 10/小时/IP
