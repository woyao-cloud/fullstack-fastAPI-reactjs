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

