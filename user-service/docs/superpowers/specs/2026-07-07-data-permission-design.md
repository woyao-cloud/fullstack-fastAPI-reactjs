# 数据权限模块设计(阶段4)

**日期**: 2026-07-07
**状态**: 已批准(设计阶段)
**范围**: 四级数据权限(ALL/DEPT/SELF;CUSTOM 延后)角色级 data_scope,查询时动态过滤,集成 User 查询,复用部门子树缓存
**依据**: SYSTEM_ARCHITECTURE.md §4.3、ADR-009(数据权限范围实现)、CONTEXT.md D-12、IMPLEMENTATION_PLAN 阶段4

---

## 1. 背景与目标

在已完成的 FastAPI 后端(认证/用户/角色/权限/部门/系统配置)之上,实现数据权限过滤:角色配置 `data_scope`(ALL/DEPT/SELF/CUSTOM),用户查询时按其有效 data_scope 动态过滤可见数据。

**核心边界**:
- 仅对 **User 资源的 list/get** 应用数据权限过滤。部门/审计/配置查询仍由各自权限码控制,本期不集成。
- CUSTOM 范围本期**延后**:若有效范围为 CUSTOM,回退 SELF(不实现 `Role.data_conditions` 字段与条件解析器,YAGNI)。
- 数据权限与权限码**正交**:权限码(`user:read` 等)决定能否调用接口;`data_scope` 决定能看到哪些数据。

## 2. 关键决策(澄清结论)

| 决策点 | 选择 |
|---|---|
| 过滤资源范围 | 仅 User 查询(list/get) |
| SELF 语义 | 加 `User.created_by`(FK user_account,可空);SELF = `created_by == current_user.id` |
| 多角色有效范围 | 最高权限胜出:ALL > DEPT > SELF;纯 CUSTOM/无角色 → SELF 回退 |
| CUSTOM | 延后(回退 SELF),不加 `data_conditions` |
| 缓存 | 不加新缓存;有效范围从已加载角色算(廉价),DEPT 子树复用部门模块缓存 |
| 集成模式 | 方案 A:DataPermissionFilter 服务,显式调用,UserService.list/get 接 current_user |

## 3. 模块边界与分层

```
app/domain/models/user.py                              # User 加 created_by
app/application/services/data_permission_filter.py     # DataPermissionFilter(新)
app/application/services/user_service.py              # list/get 接 current_user;create 接 actor
app/repositories/department_repository.py              # 复用 get_sub_department_ids(已有)
app/interfaces/api/users.py                            # 注入 current_user 到 service
app/core/security.py                                   # get_current_user(已有)
```

**职责边界**:
- `DataPermissionFilter`:纯函数式,输入 `select(User)` stmt + `current_user` → 返回叠加 where 的 stmt。不持久化、不提交、不缓存。
- `UserService.list/get`:新增 `current_user: User | None = None` 参数;非 None 时调 filter 叠加 where;None 时不过滤(向后兼容:系统/内部调用)。
- `Role.data_scope` 已存在(ALL/DEPT/SELF/CUSTOM);本期不新增 `data_conditions`。

## 4. 数据模型变更

仅一处:`User` 新增 `created_by`。

```python
# app/domain/models/user.py —— User 类追加
created_by: Mapped[uuid.UUID | None] = mapped_column(
    UUIDType, ForeignKey("user_account.id"), nullable=True
)
```

- 自关联 FK(`user_account.id`);`nullable=True`(系统创建、历史数据无创建人)。
- `UserService.create` 签名改接 `actor: User | None = None`,设 `created_by=actor.id`(actor 为 None 时 created_by=None,如自服务注册)。
- 跨库:`UUIDType = Uuid` 沿用。`created_by` 加索引(SELF 过滤按此列查)。
- 确认 `User.department_id` 有索引(部门模块建表时应已加 `idx_user_department`;若缺则本期补)。
- 迁移:无 Alembic,沿用 lifespan `create_all`(测试自动建;生产需 Alembic 加列,文档提示)。

## 5. DataPermissionFilter + 有效范围

**`DataPermissionFilter`**(`app/application/services/data_permission_filter.py`):

```python
class DataPermissionFilter:
    def __init__(self, db: AsyncSession, dept_repo: DepartmentRepository):
        self.db = db
        self.dept_repo = dept_repo

    async def apply(self, stmt, current_user: User) -> select:
        scope = self._effective_scope(current_user)
        if scope is DataScope.ALL:
            return stmt
        if scope is DataScope.SELF:
            return stmt.where(User.created_by == current_user.id)
        if scope is DataScope.DEPT:
            dept_ids = await self._accessible_dept_ids(current_user)
            if not dept_ids:
                return stmt.where(false())  # SQLAlchemy false_() 恒假谓词,返回空集
            return stmt.where(User.department_id.in_(dept_ids))
        return stmt.where(User.created_by == current_user.id)  # CUSTOM 回退 SELF

    @staticmethod
    def _effective_scope(user: User) -> DataScope:
        scopes = {r.data_scope for r in user.roles}
        if DataScope.ALL in scopes:
            return DataScope.ALL
        if DataScope.DEPT in scopes:
            return DataScope.DEPT
        if DataScope.SELF in scopes:
            return DataScope.SELF
        return DataScope.SELF  # CUSTOM/无角色 → SELF

    async def _accessible_dept_ids(self, user: User) -> list[uuid.UUID]:
        if user.department_id is None:
            return []
        ids = await self.dept_repo.get_sub_department_ids(user.department_id)
        ids.append(user.department_id)
        return ids
```

**有效范围解析**(最高权限胜出):
- 任一角色 ALL → ALL(不过滤)。
- 否则任一 DEPT → DEPT。
- 否则任一 SELF → SELF。
- 否则(纯 CUSTOM 或无角色)→ SELF 回退。
- `user.roles` 经 `User.with_roles()` 预加载;`r.data_scope` 是 `DataScope` 枚举可直接比较。

**DEPT 可访问部门集**:
- `current_user.department_id` 为 None → 空集(返回空结果 `where(false())`)。
- 否则 `accessible = await dept_repo.get_sub_department_ids(user.department_id)` + `[user.department_id]`(本部门 + 子部门);复用部门模块 `get_sub_department_ids`(走部门树缓存)。

**纯函数/无状态**:filter 不缓存、不提交;`_effective_scope` staticmethod 纯计算;`_accessible_dept_ids` 走部门缓存。

## 6. 集成 UserService + API

**`UserService` 改造**:

```python
class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)
        self.roles = RoleRepository(db)
        self.filter = DataPermissionFilter(db, DepartmentRepository(db))

    async def list(self, page, size, current_user: User | None = None) -> tuple[Sequence[User], int]:
        stmt = User.with_roles()
        if current_user is not None:
            stmt = await self.filter.apply(stmt, current_user)
        # 基于 stmt 计 count + offset/limit
        ...

    async def get(self, user_id, current_user: User | None = None) -> User:
        stmt = User.with_roles().where(User.id == user_id)
        if current_user is not None:
            stmt = await self.filter.apply(stmt, current_user)
        # 执行;None → NotFoundError(被过滤也当 404,不泄露存在性)

    async def create(self, req: UserCreate, actor: User | None = None) -> User:
        ...  # created_by = actor.id if actor else None
```

- `current_user=None` 不过滤(向后兼容:系统/内部调用)。
- `get` 被过滤掉(无权看)→ `NotFoundError`(404),不返 403(避免泄露存在性)。
- `create` 加 `actor: User | None = None`,设 `created_by=actor.id`。

**API 路由**(`app/interfaces/api/users.py`):
- `list_users`、`get_user`:注入 `current_user = Depends(get_current_user)` 传入 service。
- `get_user`:本人(`current_user.id == user_id`)直接返;否则走 `service.get(user_id, current_user)` 过滤。
- `create_user`:传 `actor=current_user` 设 `created_by`。
- update/delete/assign_role:不经 data_scope(由 `user:update/delete` 权限码控制;写操作 data_scope 管读)。
- 自服务注册(`/auth/register`):`actor=None` → `created_by=None`。

## 7. 错误处理与边界

| 场景 | 行为 | HTTP |
|---|---|---|
| `current_user=None` | 不过滤 | — |
| DEPT 且用户无 department_id | 空集 `where(false())` | 200 空 / 404 |
| 被过滤掉(get) | NotFoundError | 404(不泄露) |
| 部门子树查询失败 | 异常上抛 | 500 |
| 缺 `user:read` 权限码 | require_permission 拦截 | 403 |
| 未认证 | get_current_user | 401 |

**边界**:
- `created_by` 自关联 FK:SQLite 测试默认不强制;生产 PG 强制。系统创建(`actor=None`→`created_by=None`)不违反(可空)。
- 无角色 → SELF 回退(只能看自己创建的;若无 created_by 记录则空)。
- DEPT 子树经部门模块缓存;部门变更后缓存失效由部门模块 invalidate 负责(已有)。
- 并发:filter 无状态;DEPT 子树每请求读一次(走缓存);无竞态。

## 8. 测试策略

**基础设施**(扩展 `tests/conftest.py`):
- seed 已有 ADMIN/USER 角色;新增带 data_scope 的角色种子:ADMIN(ALL)、DEPT_MANAGER(DEPT)、REGULAR(SELF)、CUSTOM_ROLE(CUSTOM,回退 SELF)。
- 构造用户挂对应角色 + 设置 department_id/created_by,断言过滤结果。复用 `engine`/`seed`/`admin_token`。

**测试矩阵**(`tests/test_data_permission.py` + 扩展 `tests/test_users_api.py`):

| 测试 | 覆盖点 |
|---|---|
| `test_effective_scope_all_wins` | 任一 ALL → ALL(不过滤,看到全部) |
| `test_effective_scope_dept_over_self` | DEPT + SELF → DEPT |
| `test_effective_scope_self_fallback` | 纯 CUSTOM/无角色 → SELF |
| `test_filter_all_returns_all` | ALL 用户:列表含所有 |
| `test_filter_dept_subtree` | DEPT 用户:仅本部门+子部门用户 |
| `test_filter_dept_no_department_empty` | DEPT 用户无 department_id → 空 |
| `test_filter_self_only_created` | SELF 用户:仅 created_by == 自己 |
| `test_filter_no_current_user_no_filter` | `current_user=None` → 不过滤 |
| `test_get_filtered_returns_404` | get 被过滤 → 404(不泄露) |
| `test_create_sets_created_by` | 创建时 created_by = actor.id |
| `test_self_can_see_own_record` | 本人 get 自己 → 200 |
| `test_regular_user_list_filtered` | API:普通用户列表只看到自己(SELF) |

**覆盖率目标**:`data_permission_filter` ≥ 90%;全量 ≥ 85%;`uv run ruff` 0。

## 9. 实施顺序(供 writing-plans 展开)

1. `User.created_by` 字段 + 索引;`UserService.create` 接 actor
2. `DataPermissionFilter`(apply + _effective_scope + _accessible_dept_ids)
3. `UserService.list/get` 集成 filter(current_user 参数)
4. API 路由注入 current_user;`get_user` 本人直查保留
5. 测试矩阵 + seed 角色扩展
6. 全量 pytest + 覆盖率 + ruff

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `created_by` FK 自关联(生产 PG 强制) | 系统创建用 None;测试不强制 FK |
| DEPT 子树缓存与部门变更不一致 | 部门模块 invalidate 已负责 |
| 被过滤 get 返 404 误判 | 非权限问题,符合"不泄露存在性"语义 |
| 角色变更后有效范围过期 | 不缓存有效范围(每请求算),无过期问题 |
| CUSTOM 未实现 | 回退 SELF,文档标记下期实现 data_conditions + 解析器 |

---

## 变更记录

| 版本 | 日期 | 作者 | 内容 |
|---|---|---|---|
| 1.0 | 2026-07-07 | 系统架构师(Claude) | 初始设计,6 节逐节获批 |