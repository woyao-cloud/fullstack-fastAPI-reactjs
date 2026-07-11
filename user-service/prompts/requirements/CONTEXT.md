# 用户决策与技术约束 (CONTEXT)

**文档版本**: 1.1
**最后更新**: 2026-07-04
**状态**: 锁定 (Locked)

本文档记录用户已锁定的关键决策与技术约束，作为架构决策记录 (ADR) 与实施计划的依据。变更需经评审并更新版本号。

---

## 1. Locked Decisions

| 编号 | 决策项 | 选择 | 备注 |
|------|--------|------|------|
| D-01 | 后端技术栈 | FastAPI 0.115+ + Python 3.12 | 数据访问 SQLAlchemy 2.x async + asyncpg；迁移 Alembic；安全 python-jose + passlib |
| D-02 | 数据库 | PostgreSQL 15 | 主从 + 读写分离，JSONB 支持 |
| D-03 | 缓存 | Redis 7+ | 分布式缓存与会话存储，必需 |
| D-04 | 消息队列 | Kafka 3+ | 审计日志异步化，推荐但非强制（aiokafka） |
| D-05 | 前端框架 | Next.js 16+ (App Router) | TypeScript 5+，shadcn/ui + Tailwind，Zustand |
| D-06 | 容器化 | Docker 24+ / Docker Compose | 本地与 Team 开发 |
| D-07 | 编排 | Kubernetes 1.28+ | SIT/UAT/生产 |
| D-08 | 登录性能 | 10,000 TPS，P95 < 100ms | 多 worker + uvloop + Redis 缓存 |
| D-09 | 用户规模 | 1000万+ 注册用户 | 水平扩展，分区表 |
| D-10 | 部署架构 | Docker + Kubernetes | 5 环境：本地 → Team → SIT → UAT → 生产 |
| D-11 | 认证方案 | JWT (RS256) + OAuth2 Password | 无状态，Redis 黑名单撤销 |
| D-12 | 权限模型 | RBAC 四级（菜单/操作/字段/数据） | 数据范围 ALL/DEPT/SELF/CUSTOM |
| D-13 | 部门结构 | 五级 Materialized Path | path + level 字段 |
| D-14 | 测试覆盖率 | 后端 ≥ 85%，前端 ≥ 80% | pytest-cov / coverage.py |
| D-15 | 安全合规 | 等保 2.0 三级 | 多层认证 + 审计 + 加密 |

---

## 2. 技术约束

1. **后端语言/框架**：Python 3.12 + FastAPI，全链路异步 (asyncio + uvloop)，禁止在请求路径使用同步阻塞 IO。
2. **数据访问**：SQLAlchemy 2.x async + asyncpg 驱动；复杂查询可降级为原生 SQL (`text()`)。
3. **数据库迁移**：统一使用 Alembic，CI/CD 部署前自动 `alembic upgrade head`。
4. **依赖与构建**：uv（首选）或 pip + venv，统一 `pyproject.toml` + 锁文件；禁止提交未锁定的依赖。
5. **代码质量**：ruff + black + isort 统一风格；mypy 静态类型检查；pip-audit/safety 依赖安全扫描。
6. **测试**：pytest + pytest-asyncio + httpx AsyncClient + Testcontainers；覆盖率 ≥ 85%。
7. **安全**：密码 BCrypt (passlib)；敏感字段 AES-256-GCM；JWT RS256；传输 TLS 1.3。
8. **配置**：pydantic-settings 从 `.env` 加载；敏感配置加密入库，运行时解密；动态配置经 Redis 订阅热重载。
9. **容器**：基础镜像 `python:3.12-slim`；gunicorn + uvicorn worker 多进程；健康检查端点。
10. **API 版本控制**：URL 版本 `/api/v1/`，向后兼容，弃用提前 3 个月通知。

---

## 3. 变更记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| 1.0 | 2026-03-24 | 系统架构师 | 初始锁定决策（Spring Boot/JDK 21） |
| 1.1 | 2026-07-04 | 系统架构师 | D-01 后端技术栈调整为 FastAPI + Python 3.12；技术约束同步更新 |