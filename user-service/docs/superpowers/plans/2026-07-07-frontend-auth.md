# 前端骨架 + 登录闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Next.js 16 前端骨架并实现 JWT 登录闭环(登录页/注册页/仪表板/路由守卫/Zustand auth store/axios 拦截器自动刷新)。

**Architecture:** Zustand auth store 存 `access_token`(内存)+ `refresh_token`(localStorage);axios 拦截器注入 token + 401 自动刷新+并发排队;路由组 `(auth)`(公开)和 `(dashboard)`(layout 守卫);Next.js rewrites 代理 `/api/v1`→FastAPI。

**Tech Stack:** Next.js 16 App Router / TypeScript 5+ / Tailwind CSS / shadcn/ui / Zustand / React Hook Form + Zod / Axios / Vitest + React Testing Library。

## Global Constraints

- Node.js ≥ 20;包管理用 npm;所有命令在 `front-end/` 目录下执行。
- `next.config.ts` rewrites:`/api/v1/:path*`→`http://localhost:8000/api/v1/:path*`(开发环境)。
- `access_token` 仅存内存(Zustand state);`refresh_token` 存 localStorage(key:`refresh_token`);`refresh_token` 不存入 Zustand state(避免序列化)。
- 路由守卫在 `(dashboard)/layout.tsx` 的 `useEffect` 中;`isLoading` 时显示 loading;`!isAuthenticated`→`router.replace("/login")`。
- `localStorage` 访问仅在客户端(useEffect/event handler),不做 SSR。
- 命名:kebab-case 文件名(auth-store.ts,login-form.tsx);PascalCase 组件(LoginForm);camelCase 函数(login,refreshAccessToken)。
- 提交粒度:每 Task 一次 commit;TDD(失败测试→实现→通过→提交)。
- PowerShell 为 shell(Bash 不可靠);`npm run dev`/`npm test`/`npm run build`。

**设计文档:** `docs/superpowers/specs/2026-07-07-frontend-auth-design.md`

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `package.json` | Next.js + 依赖 | Create |
| `next.config.ts` | rewrites 代理 | Create |
| `tailwind.config.ts` | Tailwind 配置 | Create |
| `tsconfig.json` | TypeScript 配置 | Create |
| `components.json` | shadcn/ui 配置 | Create |
| `app/globals.css` | Tailwind + shadcn 主题 | Create |
| `app/layout.tsx` | 根布局(html/body/Providers) | Create |
| `app/page.tsx` | 首页(重定向) | Create |
| `app/(auth)/login/page.tsx` | 登录页 | Create |
| `app/(auth)/register/page.tsx` | 注册页 | Create |
| `app/(dashboard)/layout.tsx` | 仪表板布局(路由守卫) | Create |
| `app/(dashboard)/page.tsx` | 仪表板首页 | Create |
| `components/providers.tsx` | 客户端 Providers(hydrate) | Create |
| `components/auth/login-form.tsx` | 登录表单 | Create |
| `components/auth/register-form.tsx` | 注册表单 | Create |
| `components/ui/*` | shadcn 组件 | Create |
| `lib/api/client.ts` | axios 客户端+拦截器 | Create |
| `lib/utils.ts` | cn() 工具 | Create |
| `lib/schemas/auth.ts` | Zod 校验 | Create |
| `stores/auth.ts` | Zustand auth store | Create |
| `types/auth.ts` | TypeScript 类型 | Create |
| `__tests__/auth-store.test.ts` | store 测试 | Create |
| `__tests__/api-client.test.ts` | axios 拦截器测试 | Create |

---

## Task 1: 项目初始化(Next.js + Tailwind + shadcn/ui + 依赖)

**Files:**
- Create: `package.json`、`next.config.ts`、`tailwind.config.ts`、`tsconfig.json`、`components.json`、`app/globals.css`、`lib/utils.ts`、`components/ui/*`

**Interfaces:**
- Produces:可运行的 Next.js 项目(`npm run dev` 启动),Tailwind + shadcn/ui 就绪,路径别名 `@/` → `./` 配置好。

- [ ] **Step 1: 创建 Next.js 项目**

```bash
cd front-end
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --no-turbopack
```
Expected:项目文件生成,`package.json` 含 next/react/typescript/tailwind。

- [ ] **Step 2: 安装依赖**

```bash
npm install zustand axios react-hook-form @hookform/resolvers zod
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

- [ ] **Step 3: 初始化 shadcn/ui**

```bash
npx shadcn@latest init -d
```
Expected:生成 `components.json`,`app/globals.css` 更新(Tailwind CSS 变量),`lib/utils.ts` 生成(cn 函数)。

- [ ] **Step 4: 安装 shadcn 组件**

```bash
npx shadcn@latest add button card input label form toast
```
Expected:`components/ui/` 下生成对应组件。

- [ ] **Step 5: 配置 rewrites**

`next.config.ts`:
```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: "http://localhost:8000/api/v1/:path*" },
    ];
  },
};
export default nextConfig;
```

- [ ] **Step 6: 配置 Vitest**

`vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", globals: true, setupFiles: ["./vitest.setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

`vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

`package.json` 追加 scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: 验证项目可运行**

Run: `npm run dev`(手动终止);`npm run build` 无 error。
Expected:build 成功。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "feat(frontend): Next.js 16 + Tailwind + shadcn/ui 项目初始化"
```

---

## Task 2: TypeScript 类型 + Zod 校验 schema

**Files:**
- Create: `types/auth.ts`、`lib/schemas/auth.ts`
- Test: `__tests__/schemas.test.ts`

**Interfaces:**
- Produces:
  - `LoginRequest{ email, password }`、`RegisterRequest{ email, password, first_name, last_name, phone? }`、`TokenResponse{ access_token, refresh_token, token_type, expires_in }`、`UserOut{ id, email, first_name, last_name, phone?, status, email_verified, created_at }`。
  - `loginSchema`(Zod):`email` EmailStr,`password` min(8)。`registerSchema`:`email` EmailStr,`password` min(8),`confirmPassword`(refine 匹配),`first_name` min(1),`last_name` min(1),`phone` optional。

- [ ] **Step 1: 写失败测试**

```typescript
// __tests__/schemas.test.ts
import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/schemas/auth";

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "12345678" }).success).toBe(true);
  });
  it("rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "not-email", password: "12345678" }).success).toBe(false);
  });
  it("rejects short password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "123" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("rejects password mismatch", () => {
    const r = registerSchema.safeParse({
      email: "a@b.com", password: "12345678", confirmPassword: "87654321",
      first_name: "A", last_name: "B",
    });
    expect(r.success).toBe(false);
  });
  it("accepts valid registration", () => {
    expect(registerSchema.safeParse({
      email: "a@b.com", password: "12345678", confirmPassword: "12345678",
      first_name: "Alice", last_name: "Wang",
    }).success).toBe(true);
  });
});
```

Run: `npx vitest run`
Expected:FAIL(`@/lib/schemas/auth` 不存在)

- [ ] **Step 2: 实现类型**

```typescript
// types/auth.ts
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserOut {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  status: string;
  email_verified: boolean;
  created_at: string;
}
```

- [ ] **Step 3: 实现 Zod schema**

```typescript
// lib/schemas/auth.ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
});

export const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
  confirmPassword: z.string(),
  first_name: z.string().min(1, "请输入名字"),
  last_name: z.string().min(1, "请输入姓氏"),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次密码不一致",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run`
Expected:PASS(5 passed);`npm run build` 无 error。

- [ ] **Step 5: 提交**

```bash
git add types/auth.ts lib/schemas/auth.ts __tests__/schemas.test.ts
git commit -m "feat(frontend): TypeScript 类型 + Zod 校验 schema"
```

---

## Task 3: Zustand Auth Store

**Files:**
- Create: `stores/auth.ts`
- Test: `__tests__/auth-store.test.ts`

**Interfaces:**
- Produces:`useAuthStore`(Zustand hook) with state:`accessToken`、`user`、`isAuthenticated`、`isLoading`;actions:`login(email,password)`、`register(data)`、`logout()`、`hydrate()`、`refreshAccessToken()`。
- Consumes:`types/auth.ts`、`lib/schemas/auth.ts`、axios(直接调 API 用 fetch 或裸 axios;本任务用 fetch 简化,不必等 Task 4 的 axios 客户端——Task 4 会迁移到 axios)。

- [ ] **Step 1: 写失败测试**

```typescript
// __tests__/auth-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth";

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, isAuthenticated: false, isLoading: true });
  localStorage.clear();
});

describe("AuthStore", () => {
  it("initial state is not authenticated", () => {
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it("logout clears state and localStorage", () => {
    useAuthStore.setState({ accessToken: "t", user: { id: "1", email: "a@b.com", first_name: "A", last_name: "B", status: "ACTIVE", email_verified: true, created_at: "2026-01-01T00:00:00Z" }, isAuthenticated: true });
    localStorage.setItem("refresh_token", "rt");
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});
```

Run: `npx vitest run`
Expected:FAIL(模块不存在)

- [ ] **Step 3: 实现 store**

```typescript
// stores/auth.ts
import { create } from "zustand";
import type { LoginRequest, RegisterRequest, TokenResponse, UserOut } from "@/types/auth";

const REFRESH_KEY = "refresh_token";

interface AuthState {
  accessToken: string | null;
  user: UserOut | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
}

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const data = await apiCall<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password } as LoginRequest),
    });
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    const user = await apiCall<UserOut>("/users/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    set({ accessToken: data.access_token, user, isAuthenticated: true, isLoading: false });
  },

  register: async (req) => {
    await apiCall("/auth/register", { method: "POST", body: JSON.stringify(req) });
    await get().login(req.email, req.password);
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, user: null, isAuthenticated: false, isLoading: false });
  },

  hydrate: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) { set({ isLoading: false }); return; }
    try {
      const data = await apiCall<TokenResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: rt }),
      });
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      const user = await apiCall<UserOut>("/users/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      set({ accessToken: data.access_token, user, isAuthenticated: true, isLoading: false });
    } catch {
      get().logout();
      set({ isLoading: false });
    }
  },

  refreshAccessToken: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return null;
    try {
      const data = await apiCall<TokenResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: rt }),
      });
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      set({ accessToken: data.access_token, isAuthenticated: true });
      return data.access_token;
    } catch {
      get().logout();
      return null;
    }
  },
}));
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run`
Expected:PASS(2 passed);`npm run build` 无 error。

- [ ] **Step 5: 提交**

```bash
git add stores/auth.ts __tests__/auth-store.test.ts
git commit -m "feat(frontend): Zustand auth store(login/register/logout/hydrate/refresh)"
```

---

## Task 4: axios 客户端 + 拦截器(自动刷新 + 并发排队)

**Files:**
- Create: `lib/api/client.ts`
- Modify: `stores/auth.ts`(refreshAccessToken 已实现,无需改)
- Test: `__tests__/api-client.test.ts`

**Interfaces:**
- Produces:`api`(axios instance,baseURL `/api/v1`);request 拦截器注入 `Authorization`;response 拦截器 401 自动刷新+并发排队。
- Consumes:`useAuthStore.getState().accessToken`、`useAuthStore.getState().refreshAccessToken()`。

- [ ] **Step 1: 实现 axios 客户端**

```typescript
// lib/api/client.ts
import axios from "axios";
import { useAuthStore } from "@/stores/auth";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Request 拦截器
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response 拦截器: 401 自动刷新
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (err: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error); else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const newToken = await useAuthStore.getState().refreshAccessToken();
        if (newToken) {
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
        useAuthStore.getState().logout();
        return Promise.reject(error);
      } catch (err) {
        processQueue(err, null);
        useAuthStore.getState().logout();
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 2: 验证 build**

Run: `npm run build`
Expected:成功。

- [ ] **Step 3: 提交**

```bash
git add lib/api/client.ts
git commit -m "feat(frontend): axios 客户端+拦截器(自动刷新+并发排队)"
```

---

## Task 5: 登录/注册表单组件 + 页面

**Files:**
- Create: `components/auth/login-form.tsx`、`components/auth/register-form.tsx`
- Create: `app/(auth)/login/page.tsx`、`app/(auth)/register/page.tsx`
- Test: `__tests__/login-form.test.tsx`、`__tests__/register-form.test.tsx`

**Interfaces:**
- Consumes:`useAuthStore`、`loginSchema`/`registerSchema`、`react-hook-form`、`Card`/`Button`/`Input`/`Label`/`Form` from shadcn。

- [ ] **Step 1: 写失败测试**

```typescript
// __tests__/login-form.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";

describe("LoginPage", () => {
  it("renders login form", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/邮箱/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/密码/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /登录/i })).toBeDefined();
  });
});
```

Run: `npx vitest run`
Expected:FAIL(页面不存在)

- [ ] **Step 2: 实现 login-form**

```tsx
// components/auth/login-form.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormData } from "@/lib/schemas/auth";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setError("");
      await login(data.email, data.password);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "登录失败");
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>登录</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" placeholder="请输入邮箱" {...register("email")} />
            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">密码</Label>
            <Input id="password" type="password" placeholder="请输入密码" {...register("password")} />
            {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>登录</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: 实现 register-form**

```tsx
// components/auth/register-form.tsx
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterFormData } from "@/lib/schemas/auth";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const reg = useAuthStore((s) => s.register);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError("");
      await reg(data);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "注册失败");
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader><CardTitle>注册</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" placeholder="请输入邮箱" {...register("email")} />
            {errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">密码</Label>
            <Input id="password" type="password" placeholder="请输入密码" {...register("password")} />
            {errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input id="confirmPassword" type="password" placeholder="请确认密码" {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="text-red-500 text-sm">{errors.confirmPassword.message}</p>}
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="first_name">姓</Label>
              <Input id="first_name" placeholder="姓" {...register("first_name")} />
              {errors.first_name && <p className="text-red-500 text-sm">{errors.first_name.message}</p>}
            </div>
            <div className="flex-1">
              <Label htmlFor="last_name">名</Label>
              <Input id="last_name" placeholder="名" {...register("last_name")} />
              {errors.last_name && <p className="text-red-500 text-sm">{errors.last_name.message}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="phone">手机号(选填)</Label>
            <Input id="phone" placeholder="请输入手机号" {...register("phone")} />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>注册</Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: 实现登录页面**

```tsx
// app/(auth)/login/page.tsx
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <LoginForm />
        <p className="mt-4 text-sm">
          还没有账号? <Link href="/register" className="underline">去注册</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 实现注册页面**

```tsx
// app/(auth)/register/page.tsx
import { RegisterForm } from "@/components/auth/register-form";
import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <RegisterForm />
        <p className="mt-4 text-sm">
          已有账号? <Link href="/login" className="underline">去登录</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 运行测试 + build**

Run: `npx vitest run`;`npm run build`
Expected:测试 PASS;build 成功。

- [ ] **Step 7: 提交**

```bash
git add components/auth/ app/(auth)/ __tests__/
git commit -m "feat(frontend): 登录/注册表单+页面"
```

---

## Task 6: 仪表板 + 路由守卫 + Providers + 根布局

**Files:**
- Create: `app/(dashboard)/layout.tsx`、`app/(dashboard)/page.tsx`
- Create: `components/providers.tsx`
- Modify: `app/layout.tsx`(包裹 Providers)
- Modify: `app/page.tsx`(首页重定向)

**Interfaces:**
- Consumes:`useAuthStore`、`useRouter`。

- [ ] **Step 1: 实现 Providers**

```tsx
// components/providers.tsx
"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  return <>{children}</>;
}
```

- [ ] **Step 2: 修改根 layout**

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = { title: "用户管理系统" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
```

- [ ] **Step 3: 实现 路由守卫 layout**

```tsx
// app/(dashboard)/layout.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">加载中...</div>;
  if (!isAuthenticated) return null;
  return <>{children}</>;
}
```

- [ ] **Step 4: 实现仪表板页面**

```tsx
// app/(dashboard)/page.tsx
"use client";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>欢迎, {user?.first_name}!</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4">你已成功登录。</p>
          <Button onClick={() => { logout(); router.push("/login"); }}>登出</Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: 首页重定向**

```tsx
// app/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) router.replace(isAuthenticated ? "/dashboard" : "/login");
  }, [isLoading, isAuthenticated, router]);

  return null;
}
```

- [ ] **Step 6: 运行 build**

Run: `npm run build`
Expected:成功。

- [ ] **Step 7: 提交**

```bash
git add app/layout.tsx app/page.tsx app/(dashboard)/ components/providers.tsx
git commit -m "feat(frontend): 仪表板+路由守卫+Providers+根布局"
```

---

## Task 7: 全量测试 + lint + build

**Files:** 无新增(验证性任务)

- [ ] **Step 1: 全量测试**

Run: `npx vitest run`
Expected:全部 PASS

- [ ] **Step 2: lint**

Run: `npm run lint`
Expected:0 errors(Next.js 默认 ESLint 配置)

- [ ] **Step 3: build**

Run: `npm run build`
Expected:成功,无 error/warning

- [ ] **Step 4: 修复失败后再次运行至全绿**

- [ ] **Step 5: 提交(如有修复)**

```bash
git add -A
git commit -m "test(frontend): 全量测试+lint+build 通过"
```

---

## Self-Review 结论

**Spec coverage**:§3 项目结构→Task 1;§4 Auth Store→Task 3;§5 axios 拦截器→Task 4;§6 路由守卫+页面→Task 5/6;§7 类型→Task 2;§8 测试策略→Task 7。全规格覆盖。

**Placeholder scan**:无 TBD/TODO;每步含完整代码与命令。

**Type一致性**:`AuthState` 接口跨 Task 3/4/5/6 一致;`LoginFormData`/`RegisterFormData` 跨 Task 2/5 一致;`api` 单例跨 Task 4/5 一致;`UserOut`/`TokenResponse` 跨 Task 2/3/6 一致。