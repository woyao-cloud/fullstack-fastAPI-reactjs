# 前端骨架 + 登录闭环设计

**日期**: 2026-07-07
**状态**: 已批准(设计阶段)
**范围**: Next.js 16 前端骨架 + JWT 登录闭环(登录页/注册页/仪表板/路由守卫/Auth Store/axios 拦截器)
**依据**: FRONTEND_ARCHITECTURE.md、CLAUDE.md 技术栈、后端已完备的认证 API

---

## 1. 背景与目标

后端 FastAPI 已完成(认证/用户/角色/权限/部门/配置/数据权限),`front-end/` 目录为空。本周期搭建 Next.js 16 前端骨架并实现 JWT 登录闭环:登录页、注册页、登录后空白仪表板、Zustand auth store、axios 拦截器自动刷新 token、路由守卫。

**不在本期内**:
- 部门树组件、配置管理界面、数据权限 UI(后续单独 spec)
- 用户管理界面(CRUD、角色分配)
- 仪表板内容(图表/统计)

## 2. 关键决策(澄清结论)

| 决策点 | 选择 |
|---|---|
| Token 存储 | `access_token` 存内存(Zustand state);`refresh_token` 存 localStorage |
| 页面范围 | 登录页 + 注册页 + 空白仪表板(标题+登出) + 路由守卫 |
| API 调用 | 直接 axios 调 FastAPI,Next.js rewrites 代理 `/api/v1` → 后端 |
| 认证层 | 方案 A:Zustand auth store + axios 拦截器 + 持久化刷新 |
| 架构 | Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui + Zustand + React Hook Form + Zod |

## 3. 项目结构

```
front-end/
├── app/
│   ├── layout.tsx              # 根布局(html/body + Providers)
│   ├── page.tsx                # 首页(重定向到 /dashboard)
│   ├── (auth)/
│   │   ├── login/page.tsx      # 登录页
│   │   └── register/page.tsx   # 注册页
│   ├── (dashboard)/
│   │   ├── layout.tsx          # 仪表板布局(路由守卫)
│   │   └── page.tsx            # 仪表板首页(欢迎 + 登出)
│   └── globals.css             # Tailwind + shadcn 主题
├── components/
│   ├── ui/                     # shadcn 组件(button/card/input/label/form)
│   ├── auth/
│   │   ├── login-form.tsx      # 登录表单
│   │   └── register-form.tsx   # 注册表单
│   └── providers.tsx           # 客户端 Providers(Zustand hydrate)
├── lib/
│   ├── api/
│   │   └── client.ts           # axios instance + interceptors
│   ├── utils.ts                # cn() 工具
│   └── schemas/
│       └── auth.ts             # Zod 登录/注册校验
├── stores/
│   └── auth.ts                 # Zustand auth store
├── types/
│   └── auth.ts                 # TypeScript 类型
├── next.config.ts              # rewrites 代理 /api → FastAPI
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

**职责边界**:
- `(auth)` 路由组:公开,无守卫(登录/注册)。
- `(dashboard)` 路由组:layout 层做路由守卫(未登录→重定向到 `/login`)。
- `providers.tsx` 包裹根 layout,客户端 mount 时 hydrate auth store。
- `lib/api/client.ts` 是 axios 单例,所有 API 调经此。

## 4. Zustand Auth Store

**`stores/auth.ts`**(Zustand + persist middleware):

```typescript
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;  // 仅存 localStorage,不从 state 读
  user: UserOut | null;
  isAuthenticated: boolean;
  isLoading: boolean;           // hydrate 中

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>; // 页面刷新恢复
  refreshAccessToken: () => Promise<string | null>;
}
```

- `access_token` 存 state(内存);`refresh_token` 不存 state,只存 `localStorage("refresh_token")`(避免 state 序列化到 localStorage)。
- `login`:调 `POST /auth/login` → 存 `access_token` 到 state + `refresh_token` 到 localStorage + 调 `GET /users/me` 取 `user`。
- `register`:调 `POST /auth/register` → 自动登录(同 login)。
- `logout`:清 state + 清 localStorage + 清 axios Authorization header。
- `hydrate`:从 localStorage 读 `refresh_token` → 调 `POST /auth/refresh` → 新 access_token → 调 `GET /users/me` → 恢复会话。失败则 `isLoading=false`(路由守卫跳转登录)。
- `refreshAccessToken`:供 axios 拦截器 401 调用,返回新 token(或 null 失败→登出)。

## 5. axios 拦截器 + 自动刷新

**`lib/api/client.ts`**:

- Request 拦截器:注入 `Authorization: Bearer <token>`(从 Zustand store 同步读)。
- Response 拦截器:401 → 自动刷新 token → 重试原请求;并发 401 排队(不重复刷新);刷新失败 → logout。
- `next.config.ts` rewrites:`/api/v1/:path*` → `http://localhost:8000/api/v1/:path*`(开发环境)。

## 6. 路由守卫 + 页面

**路由守卫**(`app/(dashboard)/layout.tsx`):
- `useEffect`:若 `!isLoading && !isAuthenticated` → `router.replace("/login")`。
- `isLoading` 时显示 loading 状态;`!isAuthenticated` 时返回 null(防止闪动)。

**登录页**(`app/(auth)/login/page.tsx`):
- 居中卡片(400px),email/密码/登录按钮 + "还没有账号?去注册"链接。
- `react-hook-form` + `zod`(LoginFormSchema)校验。
- 调 `useAuthStore().login()` → 成功后 `router.push("/dashboard")`。
- 错误显示 toast/alert。

**注册页**(`app/(auth)/register/page.tsx`):
- 居中卡片,email/密码/确认密码/姓/名/手机 + "已有账号?去登录"。
- Zod 校验(密码最少 8 位,邮箱格式,姓名非空,密码确认一致)。
- 调 `useAuthStore().register()` → 成功后 `router.push("/dashboard")`。

**仪表板**(`app/(dashboard)/page.tsx`):
- 标题 "欢迎,{user.first_name}!" + 登出按钮。
- 登出调 `useAuthStore().logout()` → `router.push("/login")`。

**首页**(`app/page.tsx`):重定向到 `/dashboard`。

**shadcn 组件**:按需安装(Button/Card/Input/Label/Form/Toast)。

## 7. 类型定义

```typescript
interface LoginRequest { email: string; password: string }
interface RegisterRequest { email: string; password: string; first_name: string; last_name: string; phone?: string }
interface TokenResponse { access_token: string; refresh_token: string; token_type: string; expires_in: number }
interface UserOut { id: string; email: string; first_name: string; last_name: string; phone?: string; status: string; email_verified: boolean; created_at: string }
```

## 8. 测试策略

**单元测试**(Vitest + React Testing Library):
- Auth store:login/register/logout/hydrate/refresh 状态转换。
- axios 拦截器:401 自动刷新、并发排队、刷新失败 logout。
- 登录/注册表单:校验(Zod schema)、提交按钮状态。

**E2E 测试**(Playwright,后续):
- 登录流程:输入凭据→登录→重定向到仪表板→显示用户名。
- 注册流程:输入注册信息→注册→自动登录→仪表板。
- 路由守卫:未登录访问 `/dashboard` → 重定向到 `/login`。
- Token 刷新:页面刷新后恢复会话。

**覆盖率目标**:≥80%(CLAUDE.md 前端指标)。

## 9. 实施顺序(供 writing-plans 展开)

1. Next.js 项目初始化 + Tailwind + shadcn/ui 安装
2. TypeScript 类型 + Zod 校验 schema
3. Zustand auth store(login/register/logout/hydrate/refresh)
4. axios 客户端 + 拦截器
5. 登录/注册表单组件 + 页面
6. 仪表板页面 + 路由守卫
7. Providers(hydrate) + 根布局
8. 测试 + lint + build

## 10. 风险与缓解

| 风险 | 缓解 |
|---|---|
| shadcn/ui 初始化与 Next.js 16 兼容性 | 使用 `npx shadcn@latest init` 最新版 |
| localStorage 不可用(SSR) | `hydrate` 仅在客户端调用(useEffect/Providers) |
| 并发 401 排队死锁 | 队列超时(5s) + 失败全部 reject |
| axios 拦截器中调 Zustand store | 用 `useAuthStore.getState()` 同步读(非 hook) |

---

## 变更记录

| 版本 | 日期 | 作者 | 内容 |
|---|---|---|---|
| 1.0 | 2026-07-07 | 系统架构师(Claude) | 初始设计,4 节逐节获批 |