# 测试数据加载说明

为商品 / 库存 / 订单三模块的本地 compose 测试环境生成一套自洽的真实感测试数据，
并提供幂等加载脚本。数据跨模块引用一致：`skuId` 贯穿 商品(SKU) → 库存 → 订单。

## 目录结构

```
scripts/test-data/
├── load-test-data.sh   # 加载脚本 (bash)
├── product.sql         # 商品模块: category / brand / spu / sku
├── inventory.sql       # 库存模块: inventory / inventory_event
├── order.sql           # 订单模块: cart / orders / order_item / payment
└── README.md           # 本文档
```

## 前置条件

- Docker Desktop 已启动，且已执行：

  ```bash
  docker compose up -d --build
  ```

  三个 postgres 服务（`postgres-product` / `postgres-inventory` / `postgres-order`）
  均需处于运行状态。加载脚本会做前置检查，缺失时报错退出。

## 运行方法

```bash
bash scripts/test-data/load-test-data.sh
```

脚本按 `product → inventory → order` 顺序将三个 SQL 灌入对应数据库，并打印各表行数汇总。
本机无需安装 `psql`——脚本通过 `docker compose exec` 在容器内执行。

> Windows (Git Bash / WSL) 与 Linux / macOS 均可运行。
> PowerShell 用户可调用 `bash scripts/test-data/load-test-data.sh`。

## 加载内容

### 商品模块 `product_service`（:5433，user `product`）

| 表 | 行数 | 说明 |
|---|---|---|
| category | 9 | 3 顶级 + 5 子级 + 1 停用（`美妆个护` is_active=false） |
| brand | 6 | 华为 / Apple / 小米 / 戴尔 / 美的 / 海尔 |
| spu | 12 | **8 active / 2 draft / 2 inactive**（覆盖列表筛选），含 JSONB images / specs_template / tags |
| sku | 26 | 2~3 个规格/SPU，含 2 个 inactive；sku_code / bar_code 唯一，price / weight 真实 |

关键固定 SKU ID（`00000000-0000-0000-0000-0000000002XX`，XX 见下）：

| SKU | 商品 | 单价 | 库存(quantity/frozen) |
|---|---|---|---|
| 201 | 华为 Mate 70 Pro 曜石黑 12+512G | 6499 | 300 / **1** |
| 202 | 华为 Mate 70 Pro 星河银 12+512G | 6499 | 250 / 0 |
| 204 | iPhone 16 Pro 原色钛 256G | 8999 | 120 / **1** |
| 206 | 小米 15 黑色 12+256G | 3999 | 400 / **2** |
| 207 | 小米 15 白色 16+512G | 4499 | 350 / 0 |
| 214 | 戴尔 XPS 14 Ultra7 16G 1T | 11999 | 15 / 0 |
| 216 | 华为 MateBook X Pro 拂晓粉 | 10999 | 8（低库存） / 0 |
| 217 | 小米笔记本 Pro 16 深空灰 | 6499 | 5（低库存） / 0 |
| 226 | 戴尔 XPS 14 Ultra9 32G 1T 黑 | 14999 | **0（缺货）** / 0 |

其余 SKU（203/205/208~213/215/220~225）为常规库存。完整清单见 `product.sql`。

### 库存模块 `inventory_service`（:5434，user `inventory`）

| 表 | 行数 | 说明 |
|---|---|---|
| inventory | 24 | 对应全部 active SKU；`version=0`；覆盖 充足 / 低库存(216,217) / 缺货(226) |
| inventory_event | 0 | seed 不产生库存事件（见「一致性说明」） |

### 订单模块 `order_service`（:5435，user `order`）

| 表 | 行数 | 说明 |
|---|---|---|
| cart | 4 | 3 个测试用户的购物车（含 checked=false 一项） |
| orders | 8 | **状态全覆盖**：PENDING_PAYMENT×2 / PAID×2 / SHIPPED / COMPLETED / CLOSED / REFUNDED；`version=0` |
| order_item | 12 | 与订单金额精确一致 |
| payment | 5 | 仅 PAID+ 订单，`SUCCESS` / `MOCK` 渠道 |

**测试用户**（对应请求头 `X-User-Id`）：

| 用户 | UUID |
|---|---|
| A | `11111111-1111-1111-1111-111111111111` |
| B | `22222222-2222-2222-2222-222222222222` |
| C | `33333333-3333-3333-3333-333333333333` |

**订单状态覆盖矩阵**（订单号 `NO-TEST-0001`~`0008`）：

| 订单 | 用户 | 状态 | 金额 |
|---|---|---|---|
| NO-TEST-0001 | A | PENDING_PAYMENT | 14497.00 |
| NO-TEST-0002 | B | PENDING_PAYMENT | 8999.00 |
| NO-TEST-0003 | A | PAID | 5499.00 |
| NO-TEST-0004 | C | PAID | 11398.00 |
| NO-TEST-0005 | B | SHIPPED | 11999.00 |
| NO-TEST-0006 | A | COMPLETED | 11098.00 |
| NO-TEST-0007 | C | CLOSED | 6499.00 |
| NO-TEST-0008 | B | REFUNDED | 8498.00 |

## 幂等与重置

- 每个 SQL 开头 `TRUNCATE` 相关表后重新插入，**可反复执行**，结果始终一致。
- 想重置数据：直接重跑脚本即可，无需手动清库。
- 想同时重建表结构：`docker compose down -v`（删除数据卷，会清空全部数据）
  后重新 `docker compose up -d --build`——postgres 容器会在首次建卷时自动执行
  各模块的 Flyway 迁移脚本建表（见 `docker-compose.yml` 的
  `/docker-entrypoint-initdb.d` 挂载），**随后需重新运行本脚本加载测试数据**。

## 一致性说明

- **库存两阶段模型**：PENDING_PAYMENT 订单（0001/0002）对应 SKU 的 `frozen` = 订单量
  （已预扣待支付：201→1、204→1、206→2）；PAID/SHIPPED/COMPLETED/CLOSED/REFUNDED
  订单 `frozen` = 0（已确认 / 已释放）。
- **seed 订单不产生 kafka 事件**：状态直接预置为一致终态（如 PAID 订单的库存已视作
  确认完成）。在此基线上继续跑支付/退款/发货等业务流即可，状态流转正常。
- PENDING_PAYMENT 订单 `created_at` 为近 3~5 分钟，**不会被 15 分钟超时关单任务**立即关闭。
- `orders.version` 初始 0（乐观锁），并发修改冲突时按 409 处理，属预期行为。

## 验证方法

加载完成后，三服务健康且数据可查：

```bash
# 商品列表（/search 分页搜索，默认返回 active SPU）
curl -s "http://localhost:8081/api/v1/products/search" | head -c 500
# 商品详情
curl -s http://localhost:8081/api/v1/products/00000000-0000-0000-0000-000000000101 | head -c 500
# 库存查询
curl -s http://localhost:8082/api/v1/inventory/00000000-0000-0000-0000-000000000206
# 用户 A 的订单列表
curl -s -H "X-User-Id: 11111111-1111-1111-1111-111111111111" \
  http://localhost:8083/api/v1/orders
# 订单详情
curl -s -H "X-User-Id: 11111111-1111-1111-1111-111111111111" \
  http://localhost:8083/api/v1/orders/00000000-0000-0000-0000-000000000301
```

## 扩展方法

追加数据时沿用 **UUID 编号方案**，避免跨模块引用错乱：

- category `...001~009` / brand `...011~016` / spu `...101+` / sku `...201+`
- order `...301+` / order_item `...401+` / payment `...501+` / cart `...601+`
- 新增 SKU 后，若需库存/订单引用它，同步在 `inventory.sql` / `order.sql` 补对应行，
  并保持 frozen 规则（见「一致性说明」）。
