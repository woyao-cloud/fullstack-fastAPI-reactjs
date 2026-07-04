# 认证授权流程

## JWT 认证

- **访问令牌**: 30 分钟有效期
- **刷新令牌**: 7 天有效期
- **算法**: HS256

## 核心流程

### 登录流程
1. 验证用户凭证
2. 生成访问令牌 + 刷新令牌
3. 创建会话记录
4. 返回令牌

### 刷新流程
1. 验证刷新令牌
2. 生成新访问令牌
3. 返回新令牌

### 登出流程
1. 验证访问令牌
2. 删除会话记录
3. 清除令牌

## RBAC 权限模型

**权限格式**: `{resource}.{action}`

| 资源 | 操作 |
|------|------|
| users | create, read, update, delete, list |
| roles | create, read, update, delete, list |
| permissions | read, list |

**默认角色**: superadmin, admin, user, guest

## 安全策略

- 密码哈希: Argon2id
- 账户锁定: 5 次失败后锁定 15 分钟
- 速率限制: 登录 10/小时/IP
- HTTPS 强制
