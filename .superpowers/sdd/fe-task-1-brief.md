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

