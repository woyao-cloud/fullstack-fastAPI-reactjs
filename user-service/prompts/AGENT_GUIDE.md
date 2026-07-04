# Agent 协作指南

> 统一的 Agent 协作指南

## 目录

1. [快速导航](#快速导航)
2. [核心协作流程](#核心协作流程)
3. [阶段详解](#阶段详解)
4. [交接规范](#交接规范)
5. [触发机制](#触发机制)

---

## 快速导航

### Agent 列表

| Agent | 职责 | 触发时机 | 输出物 |
|-------|------|----------|--------|
| **business-analyst** | 需求分析 | 产品需求明确后 | FRD, NFRD, CONTEXT.md |
| **architect** | 架构设计 | 需求评审通过后 | SYSTEM_ARCHITECTURE.md, ADR |
| **gsd-planner** | 项目规划 | 架构评审通过后 | PLAN.md |
| **tdd-guide** | TDD 指导 | 开发阶段 | 测试代码 (>85% 覆盖) |
| **code-reviewer** | 代码审查 | 代码提交后 | 审查报告 |
| **security-reviewer** | 安全审查 | 安全需求识别后 | 安全报告 |
| **e2e-runner** | E2E 测试 | SIT/UAT 环境就绪 | E2E 测试报告 |
| **gsd-executor** | 任务执行 | 规划完成后 | 实现代码 |

### 文档位置

- **全局 Agent**: `~/.claude/agents/`
- **全局规则**: `~/.claude/rules/`
- **项目配置**: `AGENTS.md`, `CLAUDE.md`

---

## 核心协作流程

### 时序图

```
需求阶段 → 设计阶段 → 规划阶段 → 开发阶段 → 测试阶段 → 部署阶段
   │           │           │           │           │           │
business-   architect   gsd-      tdd-guide   code-      e2e-
analyst                 planner               reviewer   runner
   │           │           │           │           │           │
   └─────► FRD/NFRD      │           │           │           │
               │         │           │           │           │
               └────► SYSTEM_ARCH    │           │           │
                         │           │           │           │
                         └─────► PLAN.md       │           │
                                   │           │           │
                                   └────► 测试代码          │
                                             │           │
                                             └────► 审查报告   │
                                                         │
                                                         └────► E2E 报告
```

### 协作矩阵

| 前置 Agent | 输出 | 后续 Agent | 依赖条件 | 并行可能 |
|----------|------|----------|--------|--------|
| business-analyst | FRD, NFRD, CONTEXT | architect | 需求评审通过 | ❌ 串行 |
| architect | SYSTEM_ARCHITECTURE, ADR | gsd-planner | 架构评审通过 | ✅ 可与 security-reviewer 并行 |
| security-reviewer | 安全审查报告 | gsd-planner | 无 CRITICAL 漏洞 | ✅ 与 architect 并行 |
| gsd-planner | PLAN.md | tdd-guide + gsd-executor | 计划评审通过 | ❌ 串行 |
| tdd-guide | 测试代码 | code-reviewer | 测试编写完成 | ❌ 串行 |
| code-reviewer | 质量报告 | 修改/合并 | 无 CRITICAL 问题 | ⚠️ 可反复 |
| e2e-runner | E2E 报告 | 部署 | 测试通过 | ❌ 串行 |

---

## 阶段详解

### 1. 需求分析 (1-2 周)

**参与者**: business-analyst

**工作流**:
1. 需求发现 → 2. 需求分析 → 3. 文档化 → 4. 验证 → 5. 交接

**交付物**:
```
docs/requirements/
├── FUNCTIONAL_REQUIREMENTS.md
├── NON_FUNCTIONAL_REQUIREMENTS.md
├── USER_STORIES.md
└── CONTEXT.md
```

**验收标准**:
- ✅ 每个功能需求都有验收标准
- ✅ CONTEXT.md 包含所有用户决策 (Locked/Deferred/Discretion)
- ✅ 非功能需求量化 (无模糊表述)

---

### 2. 架构设计 (1-2 周)

**参与者**: architect, security-reviewer (并行)

**工作流**:
1. 需求理解 → 2. 技术选型 → 3. 架构设计 → 4. ADR 文档化

**交付物**:
```
docs/architecture/
├── SYSTEM_ARCHITECTURE.md
├── adr/
│   └── ADR-*.md
└── TECHNICAL_CONSTRAINTS.md
```

**验收标准**:
- ✅ 架构图清晰展示组件交互
- ✅ 每个 NFR 都有对应设计
- ✅ 安全审查无 CRITICAL 问题

---

### 3. 项目规划 (1 周)

**参与者**: gsd-planner

**工作流**:
1. 项目分解 → 2. 时间规划 → 3. 风险识别 → 4. 计划输出

**交付物**: `PLAN.md` (含甘特图、里程碑、风险清单)

---

### 4. 开发实现 (6-8 周)

**参与者**: tdd-guide + gsd-executor

**TDD 循环**: RED → GREEN → REFACTOR

**测试策略**:
| 层级 | 测试类型 | 框架 | 覆盖率 |
|------|---------|------|--------|
| Controller | 集成测试 | @SpringBootTest | 80% |
| Service | 单元测试 | Mockito | 90% |
| Repository | 数据测试 | @DataJpaTest | 85% |
| Security | 安全测试 | @WebMvcTest | 100% |

---

### 5. 代码审查 (持续)

**参与者**: code-reviewer, security-reviewer

**审查维度**:
- 功能正确性
- 性能
- 安全性 (OWASP Top 10)
- 代码质量
- 架构遵循

**问题级别**:
| 级别 | 含义 | 处理 |
|------|------|------|
| CRITICAL | 高度问题 | 🚫 阻止合并 |
| HIGH | 明显缺陷 | ⚠️ 建议修改 |
| MEDIUM | 质量改进 | 💡 可 defer |
| LOW | 风格建议 | 📝 参考 |

---

### 6. E2E 测试 (1-2 周)

**参与者**: e2e-runner

**测试范围**:
- 关键用户流程
- 跨浏览器兼容性
- 视觉回归测试

**交付物**:
```
frontend/e2e/
├── specs/*.spec.ts
├── pages/*.ts
└── reports/
```

---

## 交接规范

### CONTEXT.md 格式

```markdown
# 需求上下文与决策

## 项目信息
- 项目名称：[name]
- 版本：[version]
- 日期：[date]

## 用户决策

### D-01: [决策标题]
- **决策**: [内容]
- **原因**: [原因]
- **影响**: [影响]
- **状态**: LOCKED

## 关键需求摘要

### Must Have
- REQ-001: [描述]

## 非功能指标
| 类别 | 指标 | 目标值 |
|------|------|--------|
| 性能 | 响应时间 P95 | < 200ms |

## 参考文档
- FRD: `./FUNCTIONAL_REQUIREMENTS.md`
- NFRD: `./NON_FUNCTIONAL_REQUIREMENTS.md`
```

---

## 触发机制

| 条件 | 触发动作 |
|------|---------|
| FRD/NFRD/CONTEXT.md 完成 | → architect |
| SYSTEM_ARCHITECTURE.md + ADR 完成 | → gsd-planner |
| PLAN.md 完成 | → tdd-guide + gsd-executor |
| 测试代码完成 | → code-reviewer |
| PR 提交 | → code-reviewer + security-reviewer |
| E2E 环境就绪 | → e2e-runner |

---

**版本**: 2.0
**最后更新**: 2026-03-27
**维护者**: Claude Team
