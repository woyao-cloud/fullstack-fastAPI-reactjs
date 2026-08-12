# 商品/库存/订单前端（商城 + 管理后台）设计

> 日期：2026-08-12
> 前置规格：`docs/superpowers/specs/2026-08-11-product-inventory-order-design.md`（三后端模块设计，明确"不含前端页面"）
> 关联：`docs/superpowers/specs/2026-07-11-gateway-jwt-auth-design.md`（网关注入 X-User-Id/X-User-Email/X-User-Permissions）

## 1. 目标

为 product-service / inventory-service / order-service 三模块生成前端代码：一个 Next.js 应用，含**用户商城**（浏览/搜索/详情/购物车/下单/支付/我的订单）与**管理后台**（商品/分类/品牌/库存/订单管理）两个区域，全部请求经 Spring Cloud Gateway（JWT）转发。

## 2. 架构（方案 A：网关直连 + 客户端 token）

```
浏览器 ── Next.js frontend（rewrites /api/v1/* ──> http://localhost:8080 网关）
          ├─ 登录/注册 → 网关 → user-service（复用既有认证，返回 JWT，存浏览器）
          └─ 业务请求   → 网关（校验 JWT → 注入 X-User-Id/X-User-Permissions）
                          ├─ /api/v1/products|categories|brands/** → product-service:8081
                          ├─ /api/v1/inventory/**                 → inventory-service:8082
                          ├─ /api/v1/cart|orders/**               → order-service:8083
                          └─ 其余 /api/v1/**                      → user-service:8000
                          （/internal/orders/** 需管理员权限，网关注入 X-Internal-Token → order-service）
```

- **客户端持有 JWT**：axios 请求拦截器加 `Authorization: Bearer`，401 自动刷新（复用 user-service/front-end 的 `lib/api/client.ts` 模式）。
- 网关是唯一认证边界；三服务信任网关注入的 `X-User-Id`/`X-User-Permissions`，`/internal/**` 额外以 `X-Internal-Token` 守卫（复用 product/inventory 既有模式）。

## 3. 范围

### 3.1 新建前端（`frontend/`，仓库根）

Next.js 16.2.10（App Router）+ React 19 + TS 5 + Tailwind 4 + shadcn/ui + Zustand 5 + react-hook-form + zod + axios + sonner + vitest 4 + RTL + playwright。技术基线对齐 user-service/front-end（含 Next 16 破坏性变更以 `node_modules/next/dist/docs/` 为准）。

### 3.2 后端前置改动（本迭代一并实施）

1. **网关 `RouteConfig` 扩展**：`/api/v1/**` 按前缀分发三服务（见 §2），透传用户头；`/internal/orders/**` 单独路由 + 管理员权限 gate + 注入 `X-Internal-Token`。网关当前不在根 compose，本迭代**将网关纳入根 docker-compose**（或本地运行），`rewrites` 指向 `:8080`。
2. **order-service 新增 `GET /api/v1/orders`**：当前用户订单分页列表（`status`/`page`/`size` 可选）→ `PageResponse<OrderResponse>`。供"我的订单"与后台只读展示。
3. **`OrderResponse` 扩展商品明细**：新增 `List<OrderItemResponse> items`（`skuId/productName/skuSpec/price/quantity/subtotal`），create 与 get 均返回。供订单详情页。
4. **order-service 新增 `/internal/orders/**`（跨用户，管理员操作）**：
   - `GET /internal/orders?status&page&size` → `PageResponse<OrderResponse>`（全量，不按 userId 过滤）
   - `GET /internal/orders/{id}` → `OrderResponse`（含明细，不按 userId 过滤；现有 `GET /api/v1/orders/{id}` 归属校验，管理员无法查看他人订单）
   - `POST /internal/orders/{id}/ship`、`POST /internal/orders/{id}/refund`（不做归属校验，仅状态机校验）
   - 新增 `X-Internal-Token` `OncePerRequestFilter`（`/internal/**` 校验，模式同 product/inventory 的 `SecurityConfig`；order-service 当前无 security 配置，需新增）
5. **网关管理员 gate**：对 `/internal/orders/**` 校验 JWT 的 `X-User-Permissions` 含订单管理权限 code（落地时从 user-service 权限表取具体值），通过后注入 `X-Internal-Token` 转发；不通过返回 403。防止浏览器直连内部端点。

### 3.3 前端侧处理（无后端改动）

- **商城详情库存**：product-service 的 `SkuResponse.available` 硬编码为 `0`（代码验证 `ProductQueryService.toSkuResponse` 末参恒 `0`），详情页对**当前选中 SKU** 懒加载 `GET /api/v1/inventory/{skuId}`（无批量接口，单 SKU 查询即可）。
- **购物车勾选态**：`Cart.checked` 后端无写接口，勾选态存前端 Zustand（UI 态）；下单时把选中行的 `skuId+quantity` 作为 `CreateOrderRequest.lines` 提交（后端 `deleteByUserIdAndSkuIdIn` 只删已下单项，未勾选项保留——已实现，符合语义）。
- **管理端权限**：前端以登录后用户权限列表（存 auth store）控制 `(admin)` 区域渲染与路由守卫；服务端以网关/内部端点为准，前端守卫仅为 UX。

### 3.4 非目标

- 秒杀模块、库存手动出入库页面、订单超时关闭页（后端已定时任务自动关单）。
- 网关权限模型改造（不改 user-service 权限体系，只读取判断）。
- 支付对接真实渠道（`pay` 为 MOCK）。

## 4. 前端应用结构

```
frontend/
├── next.config.ts          # rewrites /api/v1/:path* → http://localhost:8080/api/v1/:path*
├── package.json / tsconfig / vitest.config / playwright.config / postcss / eslint
├── app/
│   ├── layout.tsx          # 根布局 + providers（sonner、主题）
│   ├── globals.css
│   ├── page.tsx            # 重定向 → /（商城首页）或登录
│   ├── (auth)/login/page.tsx        # 登录（复用既有认证流程）
│   ├── (storefront)/       # ── 用户商城（无需登录可浏览）──
│   │   ├── layout.tsx      # 顶栏：Logo / 搜索 / 购物车入口 / 用户菜单(登录/订单)
│   │   ├── page.tsx        # 商品列表（搜索 q、分类、品牌、价格、排序、分页）
│   │   ├── products/[id]/page.tsx   # 详情：规格选择、库存懒加载、数量、加购
│   │   ├── cart/page.tsx   # 购物车：勾选/改量/删除/合计/结算
│   │   ├── checkout/page.tsx        # 结算：确认行→提交下单
│   │   ├── orders/page.tsx          # 我的订单：状态过滤 + 分页
│   │   └── orders/[id]/page.tsx     # 订单详情：明细 + 支付/取消/退款操作
│   └── (admin)/            # ── 管理后台（权限守卫）──
│       ├── layout.tsx      # 侧边栏（商品/分类/品牌/库存/订单）
│       ├── page.tsx        # 仪表板（计数概览，可选）
│       ├── products/page.tsx        # 商品列表（搜索/分页）+ 新建/编辑/启停
│       ├── products/[id]/page.tsx   # SPU 编辑 + SKU 子表（规格/价/码/重量/启停）
│       ├── categories/page.tsx      # 分类树：增删改（含父级与排序）
│       ├── brands/page.tsx          # 品牌 CRUD（分页）
│       ├── inventory/page.tsx       # 库存查询：按 SKU 查 quantity/frozen/available
│       └── orders/page.tsx          # 订单管理：全量列表 + 状态过滤 + 发货/退款（内部端点）
├── components/
│   ├── ui/                 # shadcn 组件
│   ├── storefront/         # product-card / product-grid / cart-drawer / quantity-stepper / order-status-badge
│   ├── admin/              # data-table / category-tree / sku-editor / status-select
│   └── shared/             # error-boundary / loading-skeleton / permission-guard
├── lib/
│   ├── api/client.ts       # axios 实例：baseURL /api/v1 + Bearer + 401 并发刷新（移植既有）
│   ├── api/products.ts / categories.ts / brands.ts / inventory.ts / cart.ts / orders.ts
│   └── utils.ts
├── stores/                 # auth.ts（JWT + 用户 + 权限，persist）/ cart.ts（勾选态）
├── types/                  # api.ts：DTO 对齐（§6）
├── hooks/                  # useDebounce / usePagination 等
└── __tests__/              # vitest+RTL 单测 + playwright e2e
```

## 5. 认证与数据通路

- **登录**：`(auth)/login` 调用网关 → user-service 登录端点（路径沿用 user-service/front-end 既有实现），成功后存 JWT 至 `stores/auth`（Zustand persist）。登出清 token。
- **请求注入**：`lib/api/client.ts` request 拦截器加 `Authorization: Bearer <token>`；response 拦截器 401 时并发刷新（复用既有 `refreshAccessToken` + failedQueue 模式，token 刷新走网关）。
- **路由守卫**：`(admin)/layout.tsx` 未登录 → 重定向 `/login`；无权限 → 403 页。`(storefront)` 浏览无需登录；下单/购物车/订单需登录（守卫提示登录）。
- **权限**：登录后从用户信息取权限列表存 auth store；管理端页面/操作据此显隐（产品/分类/品牌/库存/订单管理分别对应权限 code，落地时从 user-service 权限表确认具体值）。

## 6. API 契约（代码验证）

### 6.1 现有端点

**product-service（`:8081`，经网关 `/api/v1/**`）**
| 方法 路径 | 说明 | 入参 → 出参 |
|---|---|---|
| POST `/api/v1/products` | 创建 SPU | `SpuCreateRequest` → `SpuResponse` |
| PUT `/api/v1/products/{id}` | 更新 | `SpuCreateRequest` → `SpuResponse` |
| PATCH `/api/v1/products/{id}/status` | 启停 | body=枚举**小写** `"draft"\|"active"\|"inactive"` |
| DELETE `/api/v1/products/{id}` | 删除 | — |
| GET `/api/v1/products/{id}` | 详情 | → `SpuResponse` |
| GET `/api/v1/products/search` | 搜索 | `q/category(slug)/brand(name)/minPrice/maxPrice/sort/page/size` → `PageResponse<SpuResponse>` |
| GET `/api/v1/categories/tree` | 分类树 | → `List<CategoryResponse>` |
| POST/PUT/DELETE `/api/v1/categories(/{id})` | 分类 CRUD | `CategoryRequest` |
| GET `/api/v1/brands?page&size` | 品牌分页 | → `PageResponse<BrandResponse>` |
| POST/PUT/DELETE `/api/v1/brands(/{id})` | 品牌 CRUD | `BrandRequest` |

- `SpuCreateRequest`：`name≤200 必填, description, categoryId 必填, brandId, coverImage, images[], specsTemplate[{key,values[]}], tags[], skus@NotEmpty[{specs(Map),price,skuCode,barCode,weight,images,isActive}]`
- `SpuResponse`：`id,name,description,category,brand,status,coverImage,images,specsTemplate,tags,skus[SkuResponse]`
- `SkuResponse`：`id,specs(Map),price,skuCode,barCode,weight,images,isActive,available`（**available 恒 0，勿信**）
- `PageResponse<T>`：`{items,total,page,size}`（非 Spring Page 结构）
- `CategoryResponse`：`id,name,slug,parentId,sortOrder,icon,isActive,children[]`
- `BrandResponse`：`id,name,logoUrl,description,sortOrder`

**inventory-service（`:8082`）**
| 方法 路径 | 说明 | 出参 |
|---|---|---|
| GET `/api/v1/inventory/{skuId}` | 库存查询（前台可经网关） | `InventoryStock{skuId,quantity,frozen,available}` |

**order-service（`:8083`）**
| 方法 路径 | 说明 | 入参 → 出参 |
|---|---|---|
| POST `/api/v1/cart` | 加购 | `AddItemRequest{skuId,quantity}` |
| GET `/api/v1/cart` | 购物车列表 | → `List<Cart{id,userId,skuId,quantity,checked,...}>` |
| DELETE `/api/v1/cart/{skuId}` | 删除 | — |
| POST `/api/v1/orders` | 下单 | `CreateOrderRequest{lines:[{skuId,quantity}]}`（行数≤50、数量1-999、去重）→ `OrderResponse` |
| GET `/api/v1/orders/{id}` | 详情（归属校验） | → `OrderResponse` |
| POST `/api/v1/orders/{id}/pay\|cancel\|refund\|ship` | 状态操作（归属校验） | — |

**状态机**：`PENDING_PAYMENT → PAID → SHIPPED → COMPLETED`；`PENDING_PAYMENT → CLOSED`（取消/15 分钟超时自动）；`PAID → REFUNDING → REFUNDED`（MOCK 立即）。

### 6.2 新增端点（后端前置改动）

| 方法 路径 | 说明 | 出参 |
|---|---|---|
| GET `/api/v1/orders?status&page&size` | 当前用户订单分页（前端按需取） | `PageResponse<OrderResponse>` |
| GET `/internal/orders?status&page&size` | 全量订单分页（管理员，X-Internal-Token） | `PageResponse<OrderResponse>` |
| GET `/internal/orders/{id}` | 全量订单详情含明细（管理员，X-Internal-Token） | `OrderResponse` |
| POST `/internal/orders/{id}/ship` | 跨用户发货（X-Internal-Token，仅状态机校验） | — |
| POST `/internal/orders/{id}/refund` | 跨用户退款（X-Internal-Token，仅状态机校验） | — |

- `OrderResponse` 扩展：`id,orderNo,status,totalAmount,paidAt,closedAt,items[OrderItemResponse{skuId,productName,skuSpec,price,quantity,subtotal}]`。

## 7. 页面与交互

**商城（storefront）**
- 首页/列表：搜索框（q）、分类侧栏（`/categories/tree` 渲染，选中传 slug）、品牌下拉（`/brands`）、价格区间、排序（价格/新品）、分页（`/products/search`）。商品卡：图/名/价/状态角标（active 才可购）。
- 详情：图集、规格选择（specsTemplate → 选中 SKU）、价格/库存（选中 SKU 懒查 `/api/v1/inventory/{skuId}`，`available` 决定可购量与缺货提示）、数量步进、加购（登录后 `POST /api/v1/cart`）。
- 购物车：勾选（UI 态）、改量（重加购）、删除、合计（仅勾选）、去结算。
- 结算：展示勾选行 → `POST /api/v1/orders`（lines=勾选行）→ 成功跳订单详情；库存不足（reserve 失败）→ 订单 CLOSED 提示，不抛错（后端保留可对账记录）。
- 订单列表：状态过滤（全部/待支付/已支付/已发货/已完成/已关闭/已退款）+ 分页。
- 订单详情：状态徽章、明细、金额；按状态显示操作：待支付→支付/取消；已支付→退款。

**后台（admin，权限守卫）**
- 商品列表：搜索/分页 + 状态筛选；新建（表单：基本信息 + SKU 子表动态行，zod 对齐后端约束）；编辑复用表单；启停（PATCH status 小写枚举）；删除。
- SKU 管理：SPU 详情内 SKU 子表（规格/价格/编码/重量/图片/启停）。
- 分类：树渲染（层级、排序、启停），节点增删改（编辑父级）。
- 品牌：分页表格 + CRUD。
- 库存：按 SKU 查询 → quantity/frozen/available 展示。
- 订单管理：全量列表（status 过滤 + 分页，走 `GET /internal/orders`），详情（`GET /internal/orders/{id}` + 明细），PAID→发货（`POST /internal/orders/{id}/ship`）、PAID→退款（`POST /internal/orders/{id}/refund`）。

## 8. 状态管理

- `stores/auth`：JWT + 用户 + 权限（persist）。
- `stores/cart`：勾选/数量等 UI 态（不持久化服务端未支持的部分）；商品数据以各请求结果为准，不做全局缓存（简洁优先，不引 react-query）。
- 列表页数据用 axios + 组件内 state；分页/筛选参数进 URL searchParams（可分享/刷新保持）。

## 9. 错误处理 / 加载 / 安全

- 表单：react-hook-form + zod（对齐后端 `@Valid`：订单行数≤50、数量 1-999、skuId 必填、name≤200 等）。
- 请求错误：sonner toast；401 → 刷新重放或跳登录。
- 加载：skeleton；全局 ErrorBoundary；空态文案。
- 安全：token 仅存 localStorage（沿用既有模式）；内部端点不经浏览器可直连（网关 gate + Token）；前端权限守卫仅为 UX，服务端为唯一权威。

## 10. 测试策略

- **单元/组件**：vitest + RTL，覆盖率 ≥ 80%（CLAUDE.md 指标）。覆盖：API 层（axios mock 401 刷新/重放）、stores（auth 持久化/cart 勾选逻辑）、关键组件（商品卡、数量步进、订单状态徽章、结算表单校验）、权限守卫。
- **e2e**：playwright，关键闭环 `浏览 → 加购 → 下单 → 支付 → 我的订单` + 后台 `登录 → 商品管理 → 发货`。本地依赖：三服务 + 网关 + 数据（`scripts/test-data`）。
- **后端前置改动测试**：order-service 列表/明细/内部端点单测（含 SecurityFilter）；网关路由与 admin gate（`@WebMvcTest`/过滤器测试，沿用既有 `@Profile("!test")` 与测试基建）。

## 11. 实施顺序（供 plan 阶段参考）

1. 后端前置：order-service 列表+明细+internal 端点+Token filter+测试 → 网关路由扩展 + admin gate + 测试 → 网关纳入 compose。
2. 前端骨架：脚手架（对齐 user-service/front-end 基线）→ API 层 → auth/路由守卫。
3. 商城：列表/详情/购物车/下单/订单。
4. 后台：商品/分类/品牌/库存/订单管理。
5. 测试补全 + e2e。

## 12. 待确认项（落地时确认，非阻塞）

- 管理端各页面对应的权限 code 具体值（从 user-service 权限表取，网关 gate 与前端守卫共用）。
- 登录/注册/刷新端点路径（复用 user-service/front-end 既有实现，路径照搬）。
- 网关纳入根 compose 的方式（镜像构建 vs 本地 mvn 运行）。
