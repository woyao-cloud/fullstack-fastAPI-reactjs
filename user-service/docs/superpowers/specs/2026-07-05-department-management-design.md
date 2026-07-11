# 部门管理模块设计(阶段2)

**日期**: 2026-07-05
**状态**: 已批准(设计阶段)
**范围**: 后端部门管理模块 + Redis 缓存(前端树组件延后)
**依据**: SYSTEM_ARCHITECTURE.md §4.4、ADR-007/ADR-008(部门树 Materialized Path)、ADR-005(缓存策略)、IMPLEMENTATION_PLAN 阶段2

---

## 1. 背景与目标

在已完成的 FastAPI 后端骨架(认证/用户/权限 MVP)之上,实现五级部门树形结构管理。本模块提供部门 CRUD、整树/子树查询、层级调整(移动)、成员只读查询,并接入 Redis 多级缓存(可选降级)。

**不在本期内**:
- 前端树形组件与拖拽(后续单独 spec)。
- 数据权限过滤(ALL/DEPT/SELF/CUSTOM)属阶段4,本模块仅在 service 预留扩展点,不集成。
- 部门负责人(manager_id)的强约束与权限联动(仅存储)。

## 2. 关键决策(澄清结论)

| 决策点 | 选择 |
|---|---|
| 覆盖层 | 后端 + Redis 缓存;前端延后 |
| path 格式 | `node_seq` 整数路径(`/1/2/5`),UUID 主键保留对外引用 |
| 删除策略 | 严格拒绝:有子部门或关联用户时 409 |
| 成员管理 | 只读 `GET /departments/{id}/users`;归属变更经用户模块 `PUT /users/{id}` |
| Redis 测试 | 可选降级:测试注入 NoopDepartmentCache 走直查路径;缓存序列化用内存替身单测 |
| 缓存集成方案 | 方案 A:CacheClient 抽象 + 显式 get_or_set + 显式降级 |

## 3. 模块边界与分层

```
app/domain/models/department.py          # Department 模型(node_seq + path + level)
app/repositories/department_repository.py # CRUD、子树 LIKE、子树路径批量更新
app/application/services/department_service.py # 树构建、层级调整、防循环、缓存编排
app/application/schemas/department.py    # Pydantic 请求/响应(含树节点递归)
app/core/cache/__init__.py               # DepartmentCache 协议 + NoopDepartmentCache + 工厂
app/core/cache/redis_cache.py            # RedisDepartmentCache(生产)
app/interfaces/api/departments.py        # 路由
```

**职责边界**:
- 部门模块管部门自身 + 树结构 + 缓存;用户归属经用户模块改 `department_id`,本模块只读成员。
- 缓存层以协议注入 service:测试注入 Noop,生产注入 Redis。
- 数据权限过滤(阶段4)不集成;service 查询 stmt 可被外部叠加 where(预留扩展点)。

## 4. 数据模型

`Department` 表(在现有 `department.py` 基础上调整):

| 字段 | 类型 | 说明 |
|---|---|---|
| id | UUID | 主键(对外引用) |
| node_seq | Integer | 发号序号,唯一索引,path 用它拼接 |
| name | String(100) | 部门名 |
| code | String(50) | 唯一,如 DEPT-001 |
| parent_id | UUID? | 父部门(自关联) |
| level | Integer | 1-5,根=1,`CHECK BETWEEN 1 AND 5` |
| path | String(500) | `/{parent_seq}/.../{node_seq}`,根为 `/{node_seq}` |
| sort_order | Integer | 同级排序,默认 0 |
| manager_id | UUID? | 负责人(引用 user_account,可空) |
| status | String(20) | ACTIVE/INACTIVE |
| created_at / updated_at | datetime | 继承 Base |
| deleted_at | datetime? | 软删除(本期用 status 过滤,deleted_at 预留) |

**发号**:无外部发号器。插入时同一事务内 `node_seq = SELECT COALESCE(MAX(node_seq),0)+1`,加唯一索引兜底;并发冲突捕获 `IntegrityError` 重试一次,仍失败返 409。生产可后续换 DB 序列。

**path 维护规则**:
- 创建:有 parent → `level=parent.level+1`,`path=parent.path + "/" + str(node_seq)`;根 → `level=1`,`path="/"+str(node_seq)`。
- 移动:防循环 → 更新自身 `parent_id/level/path` → 批量更新后代 `path` 与 `level`(子串替换),单事务。
- 约束:`level BETWEEN 1 AND 5`;移动后 `new_level + max_descendant_depth <= 5`(否则拒绝)。

**索引**:`path`(LIKE 子树)、`parent_id`、`code`、`node_seq` 唯一、`level`。

## 5. 缓存层(CacheClient 抽象 + 降级)

### 5.1 协议

`app/core/cache/__init__.py`:

```python
class DepartmentCache(Protocol):
    async def get_tree(self) -> list[dict] | None: ...
    async def set_tree(self, nodes: list[dict]) -> None: ...
    async def get_subtree_ids(self, root_id: str) -> list[str] | None: ...
    async def set_subtree_ids(self, root_id: str, ids: list[str]) -> None: ...
    async def invalidate(self) -> None: ...
```

### 5.2 RedisDepartmentCache

- redis-py async;Key 规约(对齐 ADR-005):`um:dept:tree`(整树 JSON)、`um:dept:subtree:{node_seq}`(子树 id 列表)。
- TTL 30min;`invalidate` = `DELETE um:dept:tree` + `SCAN um:dept:subtree:*` 删除。
- 序列化:节点 `DepartmentTreeNode.model_dump()`(含 children 嵌套)。
- 运行期故障:每个方法 `try/except redis.RedisError` → `log.warning` + get 返 None / set·invalidate 吞掉,不阻断业务。

### 5.3 NoopDepartmentCache

- `get_*` 返 `None`(MISS),`set_*`/`invalidate` no-op,等价直查 DB。

### 5.4 工厂与降级

- `get_department_cache()`:启动期探测 Redis(超时 2s),成功 → `RedisDepartmentCache`;失败 → `NoopDepartmentCache` + 告警日志。
- 新增配置 `CACHE_ENABLED: bool = True`(False 时强制 Noop,便于测试)。
- 作为 FastAPI 依赖注入 service;**不**在请求路径做 Redis 健康探测,仅启动期探测一次 + 运行期抛错捕获降级。

### 5.5 Cache Aside 编排

读先查缓存命中即返,未命中查库→写缓存;写(增/改/删/移动)后 `invalidate`(在事务提交后调用,避免缓存指向未提交数据)。

### 5.6 子树缓存策略

子树查询复用整树缓存在内存裁剪,避免子树缓存双写一致性问题;`get_subtree_ids` 协议保留供数据权限(阶段4)使用,本期 service 不强制写子树缓存。

## 6. 业务层(DepartmentService)

`DepartmentService(db, repo, cache)`,cache 经 FastAPI 依赖注入。

| 方法 | 流程 |
|---|---|
| `create(req)` | 事务内取 `node_seq`;有 parent 校验 `parent.level<5`;算 level/path;code 唯一;提交后 `invalidate` |
| `update(id, req)` | 改 name/code/sort_order/manager_id/status(**不改层级**);提交后 `invalidate` |
| `move(id, new_parent_id)` | 防循环(目标非自身/后代,用 path LIKE 判定);深度校验(`new_level+max_descendant_depth<=5`);单事务更新自身 + `UPDATE ... SET path=REPLACE(path,old_prefix,new_prefix), level=level+delta WHERE path LIKE old_prefix||'%'`;提交后 `invalidate` |
| `delete(id)` | 子部门数>0 → 409;关联用户数>0 → 409;否则软删除(置 `status=INACTIVE`);提交后 `invalidate` |
| `get_tree()` | `cache.get_tree()` 命中→返;未命中→`repo.list_all(status=ACTIVE)`(过滤软删除)→内存建树→`cache.set_tree()`→返 |
| `get_subtree(root_id)` | 复用 `get_tree()` 内存裁剪 |
| `list_users(dept_id)` | `SELECT user_account WHERE department_id=dept_id`,返回 UserOut;不做数据权限过滤 |

> 查询语义:`get_tree`/`get_subtree`/扁平列表/单部门详情均只返回 `status=ACTIVE` 的部门;软删除(INACTIVE)不返回。`list_users` 不受部门 status 过滤(成员查询)。

**树构建**:flat 列表按 `sort_order, code` 排序,一次遍历 + dict 索引组装 children,O(n)。

**事务**:每个写方法 `async with db.begin()`;`invalidate` 在提交后调用。

## 7. API 设计

路由 `app/interfaces/api/departments.py`,挂 `API_V1_PREFIX`:

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/departments/tree` | `dept:read` | 整树(嵌套 children) |
| GET | `/departments/{id}/subtree` | `dept:read` | 以 id 为根的子树 |
| GET | `/departments` | `dept:read` | 扁平列表(分页) |
| GET | `/departments/{id}` | `dept:read` | 单部门详情 |
| POST | `/departments` | `dept:create` | 创建 |
| PUT | `/departments/{id}` | `dept:update` | 改非层级字段 |
| POST | `/departments/{id}/move` | `dept:update` | 层级调整(body: `{parent_id}`) |
| DELETE | `/departments/{id}` | `dept:delete` | 删除(严格拒绝) |
| GET | `/departments/{id}/users` | `dept:read` | 只读成员 |

**Schema**(`schemas/department.py`):
- `DepartmentCreate{ name, code, parent_id?, sort_order?, manager_id? }`
- `DepartmentUpdate{ name?, code?, sort_order?, manager_id?, status? }`(不含 parent_id)
- `DepartmentMove{ parent_id: uuid | None }`
- `DepartmentOut{ id, node_seq, name, code, parent_id, level, path, sort_order, manager_id, status, created_at, updated_at }`
- `DepartmentTreeNode{ ...DepartmentOut, children: list[DepartmentTreeNode] }`(递归)
- `DepartmentListOut{ items, total, page, size }`

**权限**:沿用 `require_permission(*codes)`;新增种子权限 `dept:read/create/update/delete`,`ADMIN` 角色绑定。move 与 update 分离端点:层级调整有防循环/深度/子树批量更新,语义与风险不同于普通字段更新,独立端点使校验显式、审计清晰。

## 8. 错误处理与边界

| 场景 | 异常 | HTTP |
|---|---|---|
| 部门不存在 | NotFoundError | 404 |
| code 重复 | ConflictError | 409 |
| 存在子部门/关联用户时删除 | ConflictError(明确 message) | 409 |
| 移动形成循环 | BusinessException | 400 |
| 移动后后代超 5 级 | BusinessException | 400 |
| parent 不存在 | NotFoundError | 404 |
| parent 已到第 5 级仍加子 | BusinessException | 400 |
| 缺权限 | HTTPException | 403 |
| 未认证 | HTTPException | 401 |

**Redis 故障降级**:`RedisDepartmentCache` 方法 `try/except redis.RedisError` → 降级直查 DB + 告警;启动期工厂探测超时 2s,失败 → Noop + 告警。

**并发**:`create` 抢 `node_seq` 唯一索引冲突重试一次;`move` 不加强锁(低频),靠事务 + path 原子更新;后续如需更强一致可加 `SELECT...FOR UPDATE`(本期不做)。

**输入校验**:Pydantic schema 层校验长度/格式;业务校验(层级/循环/深度)在 service。

## 9. 测试策略

**基础设施**(扩展 `tests/conftest.py`):
- 沿用 SQLite 文件 + httpx AsyncClient;`CACHE_ENABLED=False` → 注入 Noop,走降级直查。
- seed 扩展:新增 `dept:read/create/update/delete` 权限,ADMIN 绑定;新增根部门 + 两级子部门作基线。
- 复用 `admin_token`。

**测试矩阵**:

| 测试 | 覆盖点 |
|---|---|
| `test_create_root_and_child` | 根/子 path·level 正确 |
| `test_create_code_conflict` | 409 |
| `test_create_parent_at_level5` | 400 |
| `test_get_tree` | 整树嵌套结构 |
| `test_get_subtree` | 子树裁剪 |
| `test_move_subtree` | 自身+后代 path/level 更新 |
| `test_move_circular` | 400 |
| `test_move_exceeds_5levels` | 400 |
| `test_delete_with_children` | 409 |
| `test_delete_with_users` | 409 |
| `test_delete_leaf` | 软删除成功 |
| `test_list_users_of_dept` | 成员只读 |
| `test_permission_regular_user_denied` | 403 |
| `test_update_does_not_change_path` | update 不动 path |
| `test_cache_serialization`(可选,内存替身) | 直接测 RedisDepartmentCache 序列化与 key 规约 |

**覆盖率目标**:部门模块 ≥ 85%;缓存降级路径由 Noop 覆盖,Redis 序列化由内存替身单测。

**验证命令**:`uv run pytest --cov=app` 全量通过;`uv run ruff check app tests` 无新增 error。

## 10. 实施顺序(供 writing-plans 展开)

1. 模型调整(node_seq + manager_id + deleted_at 预留)+ 建表(当前由 lifespan `create_all` 自动建表;若已引入 Alembic 则生成迁移脚本)
2. repository(CRUD、子树 LIKE、批量路径更新)
3. 缓存协议 + Noop + Redis 实现 + 工厂/配置
4. service(create/update/move/delete/get_tree/get_subtree/list_users)
5. schema + 路由 + 权限种子
6. 测试矩阵 + seed 扩展
7. 全量 pytest + ruff 通过

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| `node_seq` 并发冲突 | 唯一索引 + 重试一次 |
| 移动子树路径更新出错 | 单事务回滚;防循环 + 深度校验前置 |
| Redis 故障影响业务 | 运行期捕获降级 + 启动期探测 |
| 缓存与 DB 不一致 | 写后 invalidate(提交后调用);Cache Aside |
| SQLite 测试与 PostgreSQL 生产差异(path REPLACE/LIKE) | repository 用 SQLAlchemy 表达,LIKE + 字符串拼接跨库;批量更新用 `func.replace` |

---

## 变更记录

| 版本 | 日期 | 作者 | 内容 |
|---|---|---|---|
| 1.0 | 2026-07-05 | 系统架构师(Claude) | 初始设计,7 节逐节获批 |