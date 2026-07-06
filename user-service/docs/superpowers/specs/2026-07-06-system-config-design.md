# 系统配置模块设计(阶段3)

**日期**: 2026-07-06
**状态**: 已批准(设计阶段)
**范围**: 后端动态配置管理 + 邮件模板 CRUD(前端管理界面延后;邮件发送延后)
**依据**: SYSTEM_ARCHITECTURE.md §4.5、ADR-005(缓存策略)、CONTEXT.md、IMPLEMENTATION_PLAN 阶段3

---

## 1. 背景与目标

在已完成的 FastAPI 后端(认证/用户/权限/部门模块)之上,实现运行时可改的业务配置管理:邮件 SMTP、安全策略、性能配置、系统参数;支持加密存储、分组校验、热重载、变更审计;以及邮件模板 CRUD。

**核心边界**:现有 `app/core/config.py`(`Settings`/pydantic-settings)管**启动期不可变配置**(DB/Redis/JWT/密钥等,来自 `.env`);本模块管**运行时可改业务配置**(存 DB)。两者不混淆。

**不在本期内**:
- 前端配置管理界面(后续单独 spec)。
- 邮件发送服务(SMTP + aiostmplib + 渲染 + 发送队列)——本期只做模板 CRUD。
- 数据权限过滤(阶段4)。

## 2. 关键决策(澄清结论)

| 决策点 | 选择 |
|---|---|
| 覆盖层 | 后端先行,前端延后 |
| 加密 | Fernet 对称加密(cryptography 库),密钥从 `CONFIG_ENCRYPTION_KEY` 环境变量加载 |
| 热重载 | cachetools 本地 TTL(60s)+ Redis pub/sub 跨 worker 即时失效;Redis 缺失降级为仅本地 TTL |
| 校验 | Pydantic 分组模型(4 组),更新某 key 时整组校验 |
| 邮件范围 | 仅 EmailTemplate CRUD,不含发送 |
| 整体方案 | 方案 A:逐 key 存储 + 分组校验 + 双层缓存 + ConfigHistory 审计 |

## 3. 模块边界与分层

```
app/domain/models/system_config.py        # SystemConfig / ConfigHistory / EmailTemplate
app/application/schemas/system_config.py   # 4 个分组 Pydantic 模型 + Create/Update/Out
app/application/services/config_service.py # ConfigService
app/application/services/email_template_service.py
app/repositories/system_config_repository.py
app/core/crypto.py                         # Fernet 加解密
app/core/config_cache.py                   # ConfigCache 协议 + LocalTTLCache + RedisPubSubConfigCache + 工厂
app/interfaces/api/system_config.py        # 配置 API
app/interfaces/api/email_templates.py      # 模板 API
```

**职责边界**:
- 配置模块管配置自身(逐 key 存储 + 分组校验 + 加解密 + 审计 + 热重载缓存)与邮件模板 CRUD;不实现邮件发送。
- `app/core/config.py`(`Settings`)保持不变——管启动期 `.env` 配置;`SystemConfig` 管可变运行时配置。
- 缓存层以协议注入 `ConfigService`,复用部门模块降级模式;Redis 缺失降级本地 TTL。
- 数据权限(阶段4)不集成;读写权限由 `config:*`/`template:*` 权限码控制。

## 4. 数据模型

### 4.1 SystemConfig(逐 key 行)

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| config_key | String(100) | 唯一,如 `mail.host`、`security.password.min_length` |
| config_value | Text | 值(SECRET 存密文,其余明文) |
| config_group | String(50) | `MAIL`/`SECURITY`/`PERFORMANCE`/`SYSTEM` |
| config_type | String(20) | `STRING`/`INT`/`BOOL`/`JSON`/`SECRET`(SECRET 触发加密) |
| is_encrypted | Bool | 实际是否加密(= `config_type==SECRET`) |
| description | String(500)? | 说明 |
| updated_by | UUID? | 操作人(引用 user_account) |
| created_at / updated_at | datetime | 继承 Base |

索引:`config_key` 唯一、`config_group`。

### 4.2 ConfigHistory(审计)

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| config_key | String(100) | 关联 key(冗余存,key 可删) |
| old_value | Text? | 旧值(SECRET 存密文) |
| new_value | Text? | 新值(SECRET 存密文) |
| changed_by | UUID | 操作人 |
| changed_at | datetime | 变更时间 |

索引:`config_key`、`changed_at`。

### 4.3 EmailTemplate

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键 |
| template_code | String(50) | 唯一,如 `USER_ACTIVATION`/`PASSWORD_RESET` |
| template_name | String(100) | |
| subject | String(200) | |
| content | Text | 正文(含 `{{var}}` 占位符) |
| variables | JSON | `[{name, description, required}]` |
| is_active | Bool | 启停 |
| created_at / updated_at | datetime | |

索引:`template_code` 唯一。

跨库:`Uuid` 类型沿用;`JSON` 用 `sqlalchemy.JSON`(SQLite+PG 通用)。

## 5. 加密与分组校验

### 5.1 加密(`app/core/crypto.py`)

- `cryptography.fernet.Fernet`,密钥从 `settings.CONFIG_ENCRYPTION_KEY`(新增到 `Settings`,启动期必须提供,缺失则启动失败——生产强制)。
- `encrypt(plain: str) -> str` / `decrypt(cipher: str) -> str`。
- 仅 `config_type == SECRET` 的 key 加密(`is_encrypted=True`);其余明文。
- `ConfigHistory` 的 `old_value`/`new_value` 对 SECRET key 存密文(与 SystemConfig 一致)。
- 测试:`CONFIG_ENCRYPTION_KEY` 用 Fernet 生成测试密钥(conftest fixture 注入)。

### 5.2 分组 Pydantic 模型(`app/application/schemas/system_config.py`)

```python
class MailConfig(BaseModel):
    host: str
    port: int = Field(ge=1, le=65535)
    username: str
    password: SecretStr          # SECRET,加密存
    protocol: Literal["smtp", "smtps"] = "smtp"
    starttls: bool = True

class SecurityPolicy(BaseModel):
    password_min_length: int = Field(ge=6, le=128)
    password_require_uppercase: bool
    password_require_lowercase: bool
    password_require_digits: bool
    password_require_special: bool
    password_history_size: int = Field(ge=0, le=20)
    password_expiration_days: int = Field(ge=0, le=365)
    login_max_attempts: int = Field(ge=1, le=20)
    login_lock_minutes: int = Field(ge=1, le=1440)
    session_timeout_minutes: int = Field(ge=1, le=1440)

class PerformanceConfig(BaseModel):
    cache_user_info_ttl: int = Field(ge=10, le=3600)
    cache_permission_ttl: int = Field(ge=10, le=3600)
    cache_department_tree_ttl: int = Field(ge=10, le=3600)
    db_max_pool_size: int = Field(ge=1, le=100)
    api_response_threshold_ms: int = Field(ge=10, le=10000)

class SystemParams(BaseModel):
    site_name: str
    default_locale: str = Field(pattern=r"^[a-z]{2}_[A-Z]{2}$")
    support_email: EmailStr
```

### 5.3 key→组 映射与校验流程

- key→组:`config_key` 前缀(`mail.*`→MAIL,`security.*`→SECURITY,`performance.*`→PERFORMANCE,`system.*`→SYSTEM)。
- `GROUP_MODELS = {"MAIL": MailConfig, "SECURITY": SecurityPolicy, "PERFORMANCE": PerformanceConfig, "SYSTEM": SystemParams}`。
- 更新某 key 时:
  1. 加载同组所有 key 当前值(SECRET 解密)。
  2. 用新值替换该 key → 组装 dict(扁平 key→value)→ 去掉组前缀得到模型字段名 → `GroupModel(**fields)` 校验。
  3. 失败 → `BusinessException`(含字段名与原因);成功 → SECRET 加密 → 持久化。
  4. 写 `ConfigHistory`(old/new,SECRET 存密文)。
  5. `cache.invalidate(group)`(Redis 实现 publish)。
- SECRET 字段对应模型 `SecretStr`;组装用 `SecretStr(plain)`,持久化取 `.get_secret_value()` 加密。
- 首次部署:`init_default_configs()` 按模型默认值批量 `create_or_init` 所有 key(幂等:key 存在则跳过)。

## 6. 缓存与热重载(双层 + 降级)

### 6.1 ConfigCache 协议(`app/core/config_cache.py`)

```python
class ConfigCache(Protocol):
    async def get_group(self, group: str) -> dict | None: ...
    async def set_group(self, group: str, values: dict) -> None: ...
    async def invalidate(self, group: str | None = None) -> None: ...
    async def start_subscriber(self) -> None: ...
```

### 6.2 LocalTTLCache(cachetools TTLCache,每 worker,TTL 60s)

- `get_group` 命中即返;`set_group` 写入;`invalidate(group)` 删本地 key。无 pub/sub 时变更靠 TTL 在 60s 内生效。`start_subscriber` no-op。

### 6.3 RedisPubSubConfigCache(组合 LocalTTLCache + Redis pub/sub)

- 读:先查本地 TTL,未命中查 DB → 写本地。
- `invalidate(group)`:删本地 + `PUBLISH config-change {group}`。
- `start_subscriber`:订阅 `config-change`,收到 `{group}` 删本地该组缓存 → 下次读重新查 DB。即时跨 worker。
- Redis 故障:`try/except` 降级为仅本地 TTL(publish 失败吞掉+告警;订阅断开不影响读)。

### 6.4 工厂 + 降级

- `get_config_cache()` 启动期探测 Redis;成功 → `RedisPubSubConfigCache`(lifespan 启动订阅 task);失败 → `LocalTTLCache`。
- 新增 `settings.CONFIG_CACHE_ENABLED: bool = True`(测试置 False 强制本地)。
- 测试注入 `LocalTTLCache`。

### 6.5 Cache Aside 编排(在 ConfigService)

- 读组:`cache.get_group(group)` 命中→返;未命中→DB 查整组(解密 SECRET)→组装 dict→`cache.set_group`→返。
- 写 key:持久化 + 历史 + `cache.invalidate(group)`(Redis 实现 publish)。

### 6.6 生命周期

`app/main.py` lifespan 启动期:`asyncio.create_task(cache.start_subscriber())`(Redis 实现时)+ `init_default_configs()` 幂等 seed;关闭期取消订阅 task。

## 7. 业务层

### 7.1 ConfigService(db, repo, crypto, cache)

| 方法 | 流程 |
|---|---|
| `get_group(group) -> dict` | Cache Aside:命中→返;未命中→`repo.list_by_group`(SECRET 解密)→组装 dict→`cache.set_group`→返 |
| `get_value(key) -> Any` | 加载所属组(get_group)→取该 key(SECRET 解密) |
| `set_value(key, value, updated_by)` | 加载同组→替换→分组校验→SECRET 加密→upsert→写 ConfigHistory→`invalidate(group)` |
| `create_or_init(key, value, group, type, description)` | 首次初始化用;校验同组;幂等(存在跳过);写;invalidate |
| `init_default_configs()` | 按 4 组模型默认值批量 create_or_init |
| `list_groups() -> list[str]` | 返回 4 组 |
| `list_keys(group?) -> list[SystemConfig]` | key 元信息(SECRET 不返回 value,返回 `is_encrypted=True` 标记) |

事务:写操作 flush+commit(沿用部门模块模式,非 `async with begin()`);`invalidate` 在 commit 后。

> **明文 vs 掩码**:`get_group`/`get_value` 返回**真实解密值**,供内部调用方使用(如未来邮件发送服务取 SMTP 密码)。API 层(§8)构建 `ConfigOut`/`ConfigGroupOut` 时将 SECRET 字段的 `value` 替换为 `"***"`——掩码发生在 API 层,不泄露明文。

### 7.2 EmailTemplateService(db, repo)

| 方法 | 流程 |
|---|---|
| `create(req)` | code 唯一校验 → 写 |
| `update(id, req)` | 加载或 404;code 改动唯一校验;写 |
| `get(id)` | 加载或 404 |
| `list(page, size)` | 分页(按 code 排序) |
| `delete(id)` | 加载或 404;硬删除 |
| `get_by_code(code)` | 未来发送服务用 |

变量校验:`variables` JSON `[{name, description, required}]`,`content` 含 `{{name}}`。不渲染/发送(下轮);仅 CRUD + 基本校验(content 非空、variables 合法 JSON 数组)。

## 8. API 设计

路由挂 `API_V1_PREFIX`。

### 8.1 配置管理(`/config`)

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/config/groups` | `config:read` | 列出 4 个分组 |
| GET | `/config?group={g}` | `config:read` | 取整组值(SECRET 字段 `value="***"`,不泄露) |
| GET | `/config/{key}` | `config:read` | 取单 key(SECRET 占位) |
| PUT | `/config/{key}` | `config:update` | 更新单 key(body: `{value}`)→ 分组校验 |
| POST | `/config/init` | `config:update` | 首次部署 seed(幂等) |
| GET | `/config/history?key={k}` | `config:read` | 该 key 变更历史(SECRET 占位) |

### 8.2 邮件模板(`/email-templates`)

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/email-templates` | `template:read` | 分页列表 |
| GET | `/email-templates/{id}` | `template:read` | 单模板 |
| POST | `/email-templates` | `template:create` | 创建 |
| PUT | `/email-templates/{id}` | `template:update` | 更新 |
| DELETE | `/email-templates/{id}` | `template:delete` | 删除 |

### 8.3 Schema

- `ConfigValueUpdate{ value: str | int | bool | dict }`(联合类型,运行时按 key 的 `config_type` 强转)
- `ConfigOut{ key, group, type, is_encrypted, value, description, updated_by, updated_at }`(`is_encrypted` 时 `value="***"`)
- `ConfigGroupOut{ group, values: dict }`(SECRET 占位)
- `ConfigHistoryOut{ key, old_value, new_value, changed_by, changed_at }`(SECRET 占位)
- `EmailTemplateCreate/Update/Out/ListOut`

### 8.4 权限种子

conftest seed + 生产迁移种子补充 `config:read/update`、`template:read/create/update/delete`,`ADMIN` 绑定。

## 9. 错误处理与边界

| 场景 | 异常 | HTTP |
|---|---|---|
| 配置 key/模板不存在 | NotFoundError | 404 |
| key/模板 code 重复 | ConflictError | 409 |
| 分组校验失败(类型/范围/格式) | BusinessException(字段名+原因) | 400 |
| 未知分组 | BusinessException | 400 |
| `CONFIG_ENCRYPTION_KEY` 缺失(启动期) | 启动失败(RuntimeError) | — |
| 解密失败(密文损坏/密钥不匹配) | BusinessException("配置解密失败") | 500 |
| 缺权限 | HTTPException | 403 |
| 未认证 | HTTPException | 401 |

**边界**:
- Redis 故障:publish/订阅 `try/except` 降级本地 TTL,不阻断业务。
- 加解密失败:转 `BusinessException`(提示检查密钥)。
- 并发更新同一 key:事务 + upsert;ConfigHistory 每次变更(不做乐观锁,低频)。
- `init_default_configs` 幂等:key 存在跳过,不覆盖已有值。

## 10. 测试策略

**基础设施**(扩展 `tests/conftest.py`):
- `CONFIG_ENCRYPTION_KEY` 注入测试密钥(Fernet 生成);`CONFIG_CACHE_ENABLED=False` → 注入 `LocalTTLCache`。
- seed 扩展 `config:read/update`、`template:read/create/update/delete`,ADMIN 绑定;复用 `admin_token`。
- 缓存层用 `LocalTTLCache`(测试)+ 可选内存替身验证 pub/sub 逻辑(不连真实 Redis)。

**测试矩阵**:

| 测试 | 覆盖点 |
|---|---|
| `test_config_init_seeds_defaults` | init 后 4 组 key 齐全,值=模型默认 |
| `test_config_init_idempotent` | 二次 init 不覆盖已有值 |
| `test_set_value_validates_group` | 设 `security.password_min_length=3` → 400(范围) |
| `test_set_value_secret_encrypts` | 设 `mail.password` → DB 存密文(≠明文),读回解密=原值,历史存密文 |
| `test_get_group_masks_secret` | GET 组返回 `mail.password="***"` |
| `test_config_history_recorded` | 更新后 history 有 old/new(SECRET 占位) |
| `test_cache_invalidation` | 内存替身验证 set_value 后 invalidate 被调用 |
| `test_unknown_group_rejected` | key 前缀不属于 4 组 → 400 |
| `test_email_template_crud` | 创建/读/更新/删除/code 重复 409 |
| `test_email_template_variables_json` | variables 非法 JSON → 422 |
| `test_regular_user_forbidden` | 无 `config:update` → 403 |
| `test_config_cache_degradation` | Redis 缺失 → LocalTTLCache 仍能读(降级) |

**覆盖率目标**:配置模块 ≥85%;`uv run pytest --cov=app` 全量 ≥85%;`uv run ruff check` 0 错误。

## 11. 实施顺序(供 writing-plans 展开)

1. 数据模型(SystemConfig/ConfigHistory/EmailTemplate)+ 建表
2. 加密模块(crypto.py)+ `CONFIG_ENCRYPTION_KEY` 配置
3. 分组 Pydantic 模型 + 校验逻辑
4. ConfigCache 协议 + LocalTTLCache + RedisPubSubConfigCache + 工厂/配置
5. repository + ConfigService(CRUD/校验/加解密/历史/缓存)
6. EmailTemplateService + repository
7. schema + 路由(配置 + 模板)+ main 注册 + seed 扩展
8. lifespan 集成(订阅 task + init_default_configs)
9. 测试矩阵 + 全量 pytest + ruff

## 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `CONFIG_ENCRYPTION_KEY` 缺失/轮换导致历史密文不可解 | 启动期强制校验;密钥轮换需重新加密(本期不实现轮换,文档提示) |
| Redis pub/sub 订阅 task 泄漏 | lifespan 关闭期取消 task;Redis 断连自动降级 |
| 分组校验在 key 不全时失败 | `init_default_configs` 幂等补齐;校验前确保组内 key 齐全 |
| 跨库 JSON 差异 | 用 `sqlalchemy.JSON`(SQLite/PG 通用) |
| 并发更新配置竞态 | 低频场景;事务 + upsert;ConfigHistory 记录(不乐观锁) |

---

## 变更记录

| 版本 | 日期 | 作者 | 内容 |
|---|---|---|---|
| 1.0 | 2026-07-06 | 系统架构师(Claude) | 初始设计,8 节逐节获批 |