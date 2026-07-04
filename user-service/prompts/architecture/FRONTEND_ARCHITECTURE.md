# 前端架构设计

## 技术栈

- Next.js 16+ (App Router)
- TypeScript 5+
- Tailwind CSS + shadcn/ui
- Zustand (状态管理)
- React Hook Form + Zod
- Axios

## 项目结构

```
frontend/
├── app/                    # 页面路由
│   ├── (auth)/            # 认证路由组
│   ├── (dashboard)/       # 仪表板路由组
│   ├── api/               # API 路由
│   └── layout.tsx         # 根布局
├── components/
│   ├── ui/                # shadcn 组件
│   ├── forms/             # 表单组件
│   ├── layout/            # 布局组件
│   └── data-display/      # 数据展示
├── lib/
│   ├── api/               # API 客户端
│   ├── utils/             # 工具函数
│   └── schemas/           # Zod 验证
├── stores/                # 状态管理
└── types/                 # 类型定义
```

## 核心设计

- 原子化组件设计
- 全面 TypeScript 类型安全
- SSR/SSG 优化性能
- 路由保护中间件

## 开发命令

```bash
npm run dev      # 开发
npm run build    # 构建
npm run test     # 测试
npm run lint     # 检查
```
