# E2E测试规划文档

## 概述

本规划为全栈用户管理系统前端部分制定完整的端到端测试策略。基于前端任务规划文档中的15个主要页面和完整功能模块，确保关键用户流程100%覆盖，测试覆盖率≥80%。

## 测试目标

### 核心目标
1. **功能完整性验证**: 所有规划页面和功能100%覆盖
2. **用户体验保障**: 关键用户流程顺畅无阻
3. **跨平台兼容性**: Chrome、Firefox、Safari、移动端适配
4. **性能基准**: 页面加载时间<3秒，交互响应<200ms
5. **视觉一致性**: 视觉回归检测UI变化

### 质量指标
- E2E测试覆盖率: 关键用户流程100%
- 跨浏览器通过率: 100%
- 测试执行时间: <10分钟（完整套件）
- 测试稳定性: 无flaky测试（通过率≥95%）

## 测试范围

### 页面覆盖 (15个主要页面)

| 页面类别 | 页面路径 | 测试优先级 | 关键功能 |
|---------|---------|-----------|---------|
| **认证模块** | `/login` | P0 | 登录、记住我、忘记密码、双因素认证 |
| | `/register` | P0 | 用户注册、邮箱验证 |
| | `/profile` | P0 | 个人资料管理、密码修改 |
| **用户管理** | `/users` | P0 | 用户列表、筛选、分页、排序 |
| | `/users/[id]` | P0 | 用户详情查看 |
| | `/users/new` | P0 | 创建用户 |
| | `/users/[id]/edit` | P0 | 编辑用户 |
| | `/users/[id]/login-history` | P1 | 登录历史查看 |
| **角色管理** | `/roles` | P0 | 角色列表、权限分配 |
| | `/roles/[id]` | P0 | 角色详情 |
| | `/roles/new` | P0 | 创建角色 |
| | `/roles/[id]/edit` | P0 | 编辑角色 |
| | `/roles/templates` | P1 | 权限模板管理 |
| **部门管理** | `/departments` | P0 | 部门树形结构管理 |
| **权限管理** | `/permissions` | P0 | 权限配置管理 |
| **审计日志** | `/audit-logs` | P0 | 日志查询、筛选、导出 |
| **系统配置** | `/settings` | P0 | 系统参数配置 |
| **仪表板** | `/dashboard` | P0 | 系统概览、统计信息 |

### 功能模块覆盖

| 功能模块 | 测试重点 | 优先级 |
|---------|---------|--------|
| **认证流程** | 登录、注册、Token刷新、登出、双因素认证 | P0 |
| **用户管理** | CRUD操作、状态管理、批量导入/导出、搜索筛选 | P0 |
| **角色权限** | 角色CRUD、权限分配、用户角色关联 | P0 |
| **部门管理** | 树形结构CRUD、部门成员管理 | P0 |
| **权限控制** | 路由守卫、按钮权限、菜单动态渲染 | P0 |
| **数据操作** | 表格分页、排序、筛选、批量操作 | P0 |
| **表单验证** | Zod schema验证、实时反馈、错误处理 | P0 |
| **文件处理** | 导入/导出Excel/CSV、图片上传 | P1 |
| **实时功能** | 审计日志实时更新、通知推送 | P1 |

## 测试工具与配置

### 测试框架
- **主框架**: Playwright 1.45+
- **语言**: TypeScript 5+
- **测试运行器**: Playwright Test Runner
- **报告工具**: HTML Reporter, JSON, JUnit

### 浏览器矩阵
```typescript
// playwright.config.ts
projects: [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'] },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'] },
  },
  // 移动端测试
  {
    name: 'Mobile Chrome',
    use: { ...devices['Pixel 5'] },
  },
  {
    name: 'Mobile Safari',
    use: { ...devices['iPhone 12'] },
  },
]
```

### 视觉回归配置
```typescript
expect: {
  toHaveScreenshot: {
    maxDiffPixels: 100,      // 允许的最大像素差异
    threshold: 0.2,          // 相似度阈值
  },
},
```

### 性能监控配置
```typescript
// 性能测试配置
use: {
  // 性能追踪
  trace: 'on-first-retry',

  // 网络限速模拟
  contextOptions: {
    // 模拟3G网络
    // networkConditions: {
    //   download: 750 * 1024 / 8, // 750 Kbps
    //   upload: 250 * 1024 / 8,   // 250 Kbps
    //   latency: 100,             // 100ms
    // },
  },
},
```

## 测试场景设计

### 优先级分类
- **P0 (Critical)**: 核心业务流程，必须100%通过
- **P1 (High)**: 重要功能，通过率≥95%
- **P2 (Medium)**: 辅助功能，通过率≥90%
- **P3 (Low)**: 边缘功能，通过率≥85%

### 关键用户流程 (P0)

#### 1. 完整用户生命周期流程
```gherkin
场景: 管理员创建用户并用户成功登录
  给定 管理员已登录系统
  当 管理员创建新用户
  且 管理员分配角色给新用户
  且 管理员登出系统
  当 新用户使用分配的凭据登录
  那么 新用户应看到仪表板
  且 新用户应只能访问分配的角色权限
```

#### 2. 权限控制完整流程
```gherkin
场景: 角色权限分配与验证
  给定 管理员已登录系统
  当 管理员创建新角色
  且 管理员分配特定权限给角色
  且 管理员将角色分配给用户
  当 用户登录系统
  那么 用户应只能看到分配的菜单
  且 用户应只能执行分配的操作
  且 用户访问未授权页面应被重定向
```

#### 3. 部门管理完整流程
```gherkin
场景: 部门树形结构管理
  给定 管理员已登录系统
  当 管理员创建根部门
  且 管理员创建子部门
  且 管理员移动部门位置
  且 管理员分配部门负责人
  那么 部门树形结构应正确显示
  且 部门负责人应正确关联
```

### 测试用例矩阵

| 测试类别 | 测试场景数量 | 优先级 | 预估执行时间 |
|---------|-------------|--------|------------|
| **认证流程** | 12 | P0 | 2分钟 |
| **用户管理** | 18 | P0 | 3分钟 |
| **角色权限** | 15 | P0 | 2.5分钟 |
| **部门管理** | 10 | P0 | 2分钟 |
| **权限管理** | 8 | P0 | 1.5分钟 |
| **审计日志** | 8 | P0 | 1.5分钟 |
| **系统配置** | 6 | P0 | 1分钟 |
| **仪表板** | 5 | P0 | 1分钟 |
| **批量操作** | 6 | P1 | 2分钟 |
| **文件处理** | 4 | P1 | 1.5分钟 |
| **移动端适配** | 8 | P1 | 2分钟 |
| **性能测试** | 5 | P2 | 3分钟 |
| **视觉回归** | 15 | P2 | 2分钟 |
| **总计** | **120** | - | **25分钟** |

## 测试数据管理

### 测试用户角色
```typescript
// fixtures/users.ts
export const testUsers = {
  superAdmin: {
    email: 'superadmin@test.com',
    password: 'SuperAdmin123!',
    name: '超级管理员',
    role: 'SUPER_ADMIN',
    permissions: ['*'], // 所有权限
  },
  admin: {
    email: 'admin@test.com',
    password: 'Admin123!',
    name: '管理员',
    role: 'ADMIN',
    permissions: [
      'users.*',
      'roles.*',
      'departments.*',
      'permissions.view',
      'audit_logs.view',
      'settings.view',
    ],
  },
  manager: {
    email: 'manager@test.com',
    password: 'Manager123!',
    name: '部门经理',
    role: 'MANAGER',
    permissions: [
      'users.list',
      'users.read',
      'departments.list',
      'departments.read',
    ],
    department: '技术部',
  },
  user: {
    email: 'user@test.com',
    password: 'User123!',
    name: '普通用户',
    role: 'USER',
    permissions: ['dashboard.view', 'profile.*'],
  },
  inactiveUser: {
    email: 'inactive@test.com',
    password: 'Inactive123!',
    name: '禁用用户',
    role: 'USER',
    status: 'INACTIVE',
  },
};
```

### 测试数据生成策略
```typescript
// utils/test-data-generator.ts
export function generateTestUser(role: string = 'USER') {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);

  return {
    email: `test-${timestamp}-${randomStr}@example.com`,
    name: `测试用户 ${timestamp}`,
    role,
    password: 'TestPass123!',
    department: '测试部门',
    phone: `138${String(timestamp).slice(-8)}`,
  };
}

export function generateTestRole() {
  const timestamp = Date.now();
  return {
    name: `测试角色 ${timestamp}`,
    code: `TEST_ROLE_${timestamp}`,
    description: `自动生成的测试角色 ${timestamp}`,
  };
}

export function generateTestDepartment(parentId?: string) {
  const timestamp = Date.now();
  return {
    name: `测试部门 ${timestamp}`,
    code: `DEPT_${timestamp}`,
    description: `自动生成的测试部门 ${timestamp}`,
    parentId,
  };
}
```

### 数据清理策略
```typescript
// utils/api-helpers.ts
export async function cleanupTestData(request: APIRequestContext) {
  // 清理测试用户
  const usersResponse = await request.get('/api/users?email=test-');
  const users = await usersResponse.json();

  for (const user of users.data) {
    if (user.email.startsWith('test-')) {
      await request.delete(`/api/users/${user.id}`);
    }
  }

  // 清理测试角色
  const rolesResponse = await request.get('/api/roles?name=测试角色');
  const roles = await rolesResponse.json();

  for (const role of roles.data) {
    if (role.name.startsWith('测试角色')) {
      await request.delete(`/api/roles/${role.id}`);
    }
  }

  // 清理测试部门
  const deptResponse = await request.get('/api/departments?name=测试部门');
  const departments = await deptResponse.json();

  for (const dept of departments.data) {
    if (dept.name.startsWith('测试部门')) {
      await request.delete(`/api/departments/${dept.id}`);
    }
  }
}
```

## 测试执行策略

### 并行执行策略
```typescript
// playwright.config.ts
export default defineConfig({
  // 完全并行执行
  fullyParallel: true,

  // CI环境重试
  retries: process.env.CI ? 2 : 0,

  // CI环境工作线程数
  workers: process.env.CI ? 4 : undefined,

  // 测试超时
  timeout: 30000, // 30秒
});
```

### 环境配置
```typescript
// 环境变量配置
const environments = {
  local: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:8080',
    adminToken: process.env.ADMIN_TOKEN,
  },
  development: {
    baseURL: 'https://dev.example.com',
    apiURL: 'https://api.dev.example.com',
    adminToken: process.env.DEV_ADMIN_TOKEN,
  },
  staging: {
    baseURL: 'https://staging.example.com',
    apiURL: 'https://api.staging.example.com',
    adminToken: process.env.STAGING_ADMIN_TOKEN,
  },
  production: {
    baseURL: 'https://app.example.com',
    apiURL: 'https://api.example.com',
    adminToken: process.env.PROD_ADMIN_TOKEN,
  },
};

const currentEnv = process.env.ENVIRONMENT || 'local';
export const config = environments[currentEnv];
```

### 测试分组策略
```typescript
// 按功能分组执行
test.describe.configure({ mode: 'parallel' });

// 认证相关测试
test.describe('Authentication', { tag: '@auth' }, () => {
  // 认证测试用例
});

// 用户管理测试
test.describe('User Management', { tag: '@users' }, () => {
  // 用户管理测试用例
});

// 角色权限测试
test.describe('Role & Permissions', { tag: '@roles' }, () => {
  // 角色权限测试用例
});

// 性能测试
test.describe('Performance', { tag: '@performance' }, () => {
  // 性能测试用例
});
```

## 视觉回归测试方案

### 基线截图策略
```typescript
// specs/visual-regression.spec.ts
test.describe('Visual Regression', () => {
  test('login page matches baseline', async ({ page }) => {
    await page.goto('/login');

    // 全页面截图
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      animations: 'disabled', // 禁用动画
      timeout: 10000,
    });

    // 关键区域截图
    await expect(page.locator('[data-testid="login-form"]'))
      .toHaveScreenshot('login-form.png');
  });

  test('dashboard page matches baseline', async ({ page, login }) => {
    await login(page); // 使用自定义fixture登录
    await page.goto('/dashboard');

    await expect(page).toHaveScreenshot('dashboard.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  // 响应式设计测试
  test('responsive design - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    await expect(page).toHaveScreenshot('login-mobile.png', {
      fullPage: true,
    });
  });

  test('responsive design - tablet view', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');

    await expect(page).toHaveScreenshot('dashboard-tablet.png', {
      fullPage: true,
    });
  });
});
```

### 视觉测试覆盖点
1. **关键页面全屏截图**: 所有15个主要页面
2. **表单组件截图**: 所有表单页面（登录、注册、用户表单等）
3. **数据表格截图**: 用户列表、角色列表、审计日志等
4. **树形组件截图**: 部门树、权限树
5. **模态框截图**: 确认对话框、详情弹窗
6. **响应式截图**: 移动端、平板端适配

## 性能测试方案

### 性能指标监控
```typescript
// specs/performance.spec.ts
test.describe('Performance', () => {
  test('page load performance', async ({ page }) => {
    // 监控页面加载性能
    const metrics = await page.evaluate(() => ({
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
      largestContentfulPaint: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime,
      cumulativeLayoutShift: performance.getEntriesByName('layout-shift')
        .reduce((sum, entry) => sum + (entry as any).value, 0),
    }));

    // 断言性能指标
    expect(metrics.loadTime).toBeLessThan(3000); // 3秒内加载完成
    expect(metrics.firstContentfulPaint).toBeLessThan(1500); // 1.5秒内首次内容绘制
    expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1); // 布局偏移小于0.1
  });

  test('API response time', async ({ page }) => {
    // 监控API响应时间
    const requests: any[] = [];

    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        requests.push({
          url: request.url(),
          startTime: Date.now(),
        });
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/')) {
        const request = requests.find(r => r.url === response.url());
        if (request) {
          const responseTime = Date.now() - request.startTime;

          // 记录响应时间
          console.log(`API ${response.url()} response time: ${responseTime}ms`);

          // 断言响应时间
          expect(responseTime).toBeLessThan(1000); // API响应时间小于1秒
        }
      }
    });

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('interaction responsiveness', async ({ page }) => {
    await page.goto('/users');

    // 测试表格排序响应时间
    const startTime = Date.now();
    await page.locator('[data-testid="sort-by-name"]').click();
    const sortTime = Date.now() - startTime;

    expect(sortTime).toBeLessThan(500); // 排序操作500ms内响应

    // 测试搜索响应时间
    const searchStart = Date.now();
    await page.locator('[data-testid="search-input"]').fill('test');
    await page.locator('[data-testid="search-button"]').click();
    await page.waitForResponse(response =>
      response.url().includes('/api/users') && response.status() === 200
    );
    const searchTime = Date.now() - searchStart;

    expect(searchTime).toBeLessThan(1000); // 搜索操作1秒内完成
  });
});
```

### 性能基准
1. **页面加载时间**: <3秒
2. **首次内容绘制**: <1.5秒
3. **API响应时间**: <200ms (P95)
4. **交互响应时间**: <500ms
5. **内存使用**: <100MB (单页面)
6. **CPU使用率**: <30% (典型交互)

## 测试报告与监控

### 报告配置
```typescript
// playwright.config.ts
reporter: [
  // HTML报告
  ['html', {
    outputFolder: 'playwright-report',
    open: 'never',
  }],

  // JSON报告 (用于CI集成)
  ['json', {
    outputFile: 'test-results/results.json'
  }],

  // JUnit报告 (用于Jenkins等CI工具)
  ['junit', {
    outputFile: 'test-results/junit.xml'
  }],

  // 自定义控制台报告
  ['line'],

  // GitHub Actions注释
  process.env.GITHUB_ACTIONS ? ['github'] : null,
].filter(Boolean),
```

### 监控指标
1. **测试通过率**: 目标≥95%
2. **测试执行时间**: 目标<10分钟
3. **失败率趋势**: 监控每日失败率变化
4. **性能基准**: 监控关键性能指标趋势
5. **浏览器兼容性**: 各浏览器通过率对比

### 告警机制
- **测试失败率>10%**: 立即告警
- **性能指标下降>20%**: 告警
- **关键流程测试失败**: 阻塞部署
- **视觉回归差异>阈值**: 人工审核

## 项目结构

```
frontend/
├── e2e/
│   ├── playwright.config.ts          # Playwright配置
│   ├── package.json                  # E2E测试依赖
│   ├── tsconfig.json                 # TypeScript配置
│   ├── fixtures/                     # 测试数据
│   │   ├── users.ts                  # 测试用户数据
│   │   ├── roles.ts                  # 测试角色数据
│   │   ├── departments.ts            # 测试部门数据
│   │   └── test-data.ts              # 测试数据生成器
│   ├── pages/                        # Page Object Model
│   │   ├── LoginPage.ts
│   │   ├── DashboardPage.ts
│   │   ├── UsersPage.ts
│   │   ├── RolesPage.ts
│   │   ├── DepartmentsPage.ts
│   │   ├── PermissionsPage.ts
│   │   ├── AuditLogsPage.ts
│   │   ├── SettingsPage.ts
│   │   └── ProfilePage.ts
│   ├── components/                   # 组件Page Objects
│   │   ├── DataTable.ts
│   │   ├── TreeView.ts
│   │   ├── Modal.ts
│   │   └── Form.ts
│   ├── specs/                        # 测试用例
│   │   ├── auth/                     # 认证测试
│   │   │   ├── login.spec.ts
│   │   │   ├── register.spec.ts
│   │   │   ├── logout.spec.ts
│   │   │   └── token-refresh.spec.ts
│   │   ├── users/                    # 用户管理测试
│   │   │   ├── user-crud.spec.ts
│   │   │   ├── user-search.spec.ts
│   │   │   ├── user-batch.spec.ts
│   │   │   └── user-status.spec.ts
│   │   ├── roles/                    # 角色权限测试
│   │   │   ├── role-crud.spec.ts
│   │   │   ├── permission-assignment.spec.ts
│   │   │   └── role-templates.spec.ts
│   │   ├── departments/              # 部门管理测试
│   │   │   ├── department-tree.spec.ts
│   │   │   └── department-members.spec.ts
│   │   ├── permissions/              # 权限控制测试
│   │   │   ├── route-guard.spec.ts
│   │   │   └── button-permission.spec.ts
│   │   ├── audit-logs/               # 审计日志测试
│   │   │   └── audit-log-search.spec.ts
│   │   ├── settings/                 # 系统配置测试
│   │   │   └── system-config.spec.ts
│   │   ├── flows/                    # 完整流程测试
│   │   │   ├── complete-user-lifecycle.spec.ts
│   │   │   ├── role-permission-flow.spec.ts
│   │   │   └── department-management-flow.spec.ts
│   │   ├── visual/                   # 视觉回归测试
│   │   │   ├── page-screenshots.spec.ts
│   │   │   └── responsive-design.spec.ts
│   │   ├── performance/              # 性能测试
│   │   │   ├── page-load.spec.ts
│   │   │   ├── api-performance.spec.ts
│   │   │   └── interaction-performance.spec.ts
│   │   └── accessibility/            # 可访问性测试
│   │       └── accessibility.spec.ts
│   ├── utils/                        # 工具函数
│   │   ├── api-helpers.ts            # API辅助函数
│   │   ├── test-helpers.ts           # 测试辅助函数
│   │   ├── auth-helpers.ts           # 认证辅助函数
│   │   └── performance-helpers.ts    # 性能测试辅助函数
│   ├── snapshots/                    # 视觉回归基线
│   │   ├── chromium/
│   │   ├── firefox/
│   │   └── webkit/
│   └── reports/                      # 测试报告
│       ├── html/
│       ├── json/
│       └── junit/
└── package.json
```

## CI/CD集成

### GitHub Actions工作流
```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-tests:
    timeout-minutes: 30
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Install Playwright Browsers
      run: npx playwright install --with-deps chromium firefox webkit

    - name: Start Backend
      run: |
        cd backend
        ./mvnw spring-boot:run &
        BACKEND_PID=$!
        sleep 60

    - name: Start Frontend
      run: |
        cd frontend
        npm run dev &
        FRONTEND_PID=$!
        sleep 30

    - name: Run E2E Tests
      run: |
        cd frontend/e2e
        npm run test:e2e
      env:
        BASE_URL: http://localhost:3000
        API_URL: http://localhost:8080
        ENVIRONMENT: local

    - name: Upload Test Results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: |
          frontend/e2e/playwright-report/
          frontend/e2e/test-results/
        retention-days: 30

    - name: Upload Test Results to GitHub
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-results
        path: frontend/e2e/test-results/

    - name: Stop Services
      if: always()
      run: |
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
```

### 测试执行策略
1. **Pull Request检查**: 运行P0测试套件（快速反馈）
2. **合并到develop**: 运行完整测试套件（包括P1）
3. **发布到staging**: 运行完整测试套件 + 性能测试
4. **生产部署前**: 运行完整测试套件 + 视觉回归 + 性能测试

## 风险与缓解

### 技术风险
| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **测试执行时间长** | 中 | 高 | 并行执行、测试分组、优化等待策略 |
| **测试数据污染** | 高 | 中 | 唯一测试数据、自动清理、事务回滚 |
| **跨浏览器兼容性问题** | 高 | 中 | 早期发现、渐进增强、降级方案 |
| **视觉回归误报** | 低 | 高 | 合理阈值、人工审核流程、基线管理 |
| **API依赖导致测试不稳定** | 中 | 中 | API Mock、重试机制、健康检查 |

### 流程风险
| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **测试维护成本高** | 中 | 高 | Page Object模式、组件化、文档完善 |
| **团队协作冲突** | 低 | 中 | 代码规范、代码审查、共享知识库 |
| **环境配置复杂** | 中 | 中 | Docker容器化、环境模板、自动化配置 |

## 成功标准

### 短期目标 (1-2个月)
1. ✅ 完成所有P0测试用例编写
2. ✅ 建立CI/CD流水线集成
3. ✅ 实现关键用户流程100%覆盖
4. ✅ 测试执行时间<15分钟

### 中期目标 (3-6个月)
1. ✅ 完成所有测试用例编写（P0-P2）
2. ✅ 建立完整的视觉回归测试
3. ✅ 建立性能基准测试
4. ✅ 测试通过率≥95%

### 长期目标 (6-12个月)
1. ✅ 建立完整的测试监控体系
2. ✅ 实现测试数据智能生成
3. ✅ 建立测试用例自动生成机制
4. ✅ 测试覆盖率≥90%

## 附录

### A. 测试优先级矩阵

| 测试类型 | P0数量 | P1数量 | P2数量 | P3数量 | 总计 |
|---------|--------|--------|--------|--------|------|
| 功能测试 | 85 | 20 | 10 | 5 | 120 |
| 视觉回归 | 15 | 10 | 5 | 0 | 30 |
| 性能测试 | 5 | 5 | 3 | 2 | 15 |
| 可访问性 | 3 | 5 | 2 | 0 | 10 |
| **总计** | **108** | **40** | **20** | **7** | **175** |

### B. 测试执行时间估算

| 环境 | 并行度 | 预估时间 | 备注 |
|------|--------|----------|------|
| 本地开发 | 4 workers | 6-8分钟 | 快速反馈 |
| CI环境 | 8 workers | 4-6分钟 | 完整执行 |
| 完整套件 | 1 worker | 25-30分钟 | 串行执行 |
| 关键流程 | 4 workers | 2-3分钟 | PR检查 |

### C. 关键性能指标阈值

| 指标 | 优秀 | 良好 | 需改进 | 单位 |
|------|------|------|--------|------|
| 页面加载时间 | <2s | 2-3s | >3s | 秒 |
| 首次内容绘制 | <1s | 1-1.5s | >1.5s | 秒 |
| API响应时间 | <100ms | 100-200ms | >200ms | 毫秒 |
| 交互响应时间 | <300ms | 300-500ms | >500ms | 毫秒 |
| 测试通过率 | ≥98% | 95-98% | <95% | 百分比 |

---

*文档版本: 1.0*
*创建日期: 2026-03-26*
*最后更新: 2026-03-26*