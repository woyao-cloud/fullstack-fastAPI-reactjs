# 全栈用户管理系统 - Claude Code 项目配置
 - 不用过度解释基础功能；
 - 回答简洁，不加客套话；
 - 代码改动后不用总结，我可看diff
 - 优先使用简洁方案，不要过度工程
 - 先进行规划，批准前不实际执行
 - 每个任务执行后打印出用了什么SKILLs ，什么plugins及什么agents

## 项目概述

全栈用户管理系统，采用 Spring Boot 后端和 Next.js 前端，提供用户注册、登录、权限管理、角色分配等功能。

## 技术栈

### 后端
- Spring Boot 3.5 + JDK 21
- Spring Data JPA + Flyway
- PostgreSQL (生产) /(开发测试)
- Spring Security + JWT + OAuth2 认证

### 前端
- Next.js 16+ (App Router)
- TypeScript 5+
- shadcn/ui + Tailwind CSS
- Zustand 状态管理

### 基础设施
- Docker + Docker Compose (本地/Team开发)
- Kubernetes (SIT/UAT/生产)
- GitHub Actions CI/CD
- 5环境架构: 本地开发 → Team开发 → SIT → UAT → 生产

## 开发原则

1. 类型安全: TypeScript + Java 强类型系统
2. 测试驱动: 覆盖率 > 85%
3. 分层架构: Controller → Service → Repository → Entity
4. 安全第一: 最小权限、输入验证、防御性编程

## 项目结构

```
usermanagement/
├── backend/          # Spring Boot 后端
│   ├── src/main/java/com/usermanagement/
│   │   ├── domain/       # JPA 实体
│   │   ├── repository/   # Spring Data 仓库
│   │   ├── service/      # 业务服务
│   │   ├── web/          # Controller + DTO
│   │   ├── security/     # 安全配置
│   │   └── config/       # 应用配置
│   └── src/main/resources/
│       └── db/migration/ # Flyway 迁移脚本
├── frontend/         # Next.js 前端
├── docs/            # 文档
├── prompts/            # 提示词
└── scripts/         # 脚本
```

## 关键文档

### 项目配置
- AGENTS.md - 多代理协作配置
- CLAUDE.md - 项目级 Claude 配置

### Agent 协作
- **prompts/AGENT_GUIDE.md** - Agent 协作指南（统一文档）
- ~/.claude/agents/ - 全局 Agent 提示词
- ~/.claude/rules/ - 全局开发规则
### 决策与技术约束文档
- prompts/requirements/CONTEXT.md - 用户决策与技术约束
### 非功能需求文档
- prompts/requirements/NON_FUNCTIONAL_REQUIREMENTS.md - 非功能需求
### USER_STORIES文档
- prompts/requirements/USER_STORIES.md - 用户故事
### 需求文档
- prompts/requirements/USER_MANAGEMENT.md - 用户管理
- prompts/requirements/ROLE_PERMISSION_MANAGEMENT.md - 角色权限管理
- prompts/requirements/AUTHENTICATION_AUTHORIZATION.md - 认证授权
- prompts/requirements/AUDIT_LOG.md - 审计日志
- prompts/requirements/SYSTEM_CONFIGURATION.md - 系统配置
- prompts/requirements/DEPARTMENT_MANAGEMENT.md - 部门管理

### 架构文档
- prompts/architecture/SYSTEM_ARCHITECTURE.md - 系统架构
- prompts/architecture/adr/ - 架构决策记录
- prompts/architecture/TECHNICAL_CONSTRAINTS.md - 技术约束

### 实施计划
- PLAN.md - 可执行项目计划

## 质量指标

- 后端测试覆盖率 ≥ 85%
- 前端测试覆盖率 ≥ 80%
- API 响应时间 P95 < 200ms
