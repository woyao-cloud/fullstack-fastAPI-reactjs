# 多代理协作配置

## 代理角色

| 角色 | 职责 | 权限边界 |
|------|------|----------|
| 产品经理 | 产品战略、PRD 编写、路线图规划、用户研究 | 只修改产品文档，不修改代码 |
| 项目经理 | 项目计划、进度跟踪、风险管理、质量把关、沟通协调 | 访问所有文档和进度状态，不修改代码 |
| 业务分析师 | 需求梳理、功能/非功能需求定义、业务流程建模 | 只修改需求文档，不修改代码 |
| 架构师 | 系统设计、技术选型、接口定义 | 只修改架构文档 |
| 后端工程师 | Spring Boot 实现、API、业务逻辑 | 只修改后端代码 |
| 前端工程师 | Next.js 开发、UI 组件 | 只修改前端代码 |
| 数据库工程师 | 数据模型、迁移、优化 | 只修改数据库文件 |
| 测试工程师 | 测试策略、用例实现 | 访问所有代码测试 |
| E2E测试工程师 | Playwright E2E测试、关键用户流程验证 | 只修改 e2e/ 目录 |
| 部署工程师 | CI/CD、容器化、监控 | 只修改基础设施文件 |

## Agent 提示词位置

所有 Agent 的详细提示词文档存储在：`~/.claude/agents/`

| Agent | 用途 | 详细文档 |
|-------|------|----------|
| **business-analyst.md** | 需求分析、FRD/NFRD 编写 | 输出: `FUNCTIONAL_REQUIREMENTS.md`, `NON_FUNCTIONAL_REQUIREMENTS.md`, `CONTEXT.md` |
| **architect.md** | 系统架构设计、技术选型 | 输出: `SYSTEM_ARCHITECTURE.md`, `adr/ADR-*.md` |
| **gsd-planner.md** | 项目规划、任务拆分、进度跟踪、风险管理、质量把关 | 输出: `PLAN.md`, 进度报告、风险评估 |
| **tdd-guide.md** | 测试驱动开发，覆盖率 > 85% | 输出: 测试代码、覆盖率报告 |
| **code-reviewer.md** | 代码审查（功能/性能/安全/质量） | 审查报告 |
| **security-reviewer.md** | 安全审查（OWASP Top 10） | 安全漏洞、改进建议 |
| **e2e-runner.md** | E2E 测试（Playwright） | 输出: E2E 测试套件、测试报告 |
| **gsd-executor.md** | 任务执行脚手架 | 执行结果 |

## 协作流程概览

```
业务分析师  →  项目经理  →  架构师  →  (开发并行)  →  测试工程师  →  E2E测试  →  部署工程师
  (需求)      (计划跟踪)   (架构)     (编码实现)    (单元/集成)     (端到端)   (CI/CD)
                 ↓           ↓           ↓             ↓            ↓          ↓
                 └─────────────────────────────────────────────────────────────┘
                              (全程监督、风险管理、进度把控)
```

## 调用方式

```bash
# 启动特定 Agent 进行工作
claude agent business-analyst      # 需求分析
claude agent architect             # 架构设计
claude agent gsd-planner           # 项目规划与进度管理（项目经理）
claude agent tdd-guide             # TDD 开发指导
claude agent code-reviewer         # 代码审查
claude agent security-reviewer     # 安全审查
claude agent e2e-runner            # E2E 测试
claude agent gsd-executor          # 执行计划任务
```

## 详细文档链接

- [Agent协作详解](prompts/prompts/AGENT_GUIDE.md) - 协作时序、触发机制、交接规范
- [交付物清单](prompts/DELIVERABLES.md) - 各角色的输出物
- [质量门禁](prompts/QUALITY_GATES.md) - 质量检查标准
- [开发工作流程](../../rules/development-workflow.md) - 开发流程规范
- [测试策略](prompts/TESTING_STRATEGY.md) - 测试设计与执行
