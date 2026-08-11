# 商品 + 库存 + 订单 三服务整体设计

- 日期：2026-08-11
- 状态：已批准
- 技术栈：全部 Spring Boot 3.5（与现有 product-service/gateway 一致）

## 1. 范围与目标

设计商品、库存、订单三个后端微服务的接口契约、数据流、存储与错误处理，打通「商品 → 购物车 → 下单 → 模拟支付 → 超时关单 → 退款」完整业务闭环。

- 不含前端页面（后续单独设计）
- 不含秒杀模块（second-kill 后续单独设计，本设计为其预留库存三态能力）

## 2. 总体架构

```
                    ┌─────────────────────────────────────────────┐
                    │              gateway (已有)                  │
                    │   JWT认证 / 限流 / 熔断 / 路由转发            │
                    └──────┬──────────┬──────────┬───────────────┘
                           │          │          │
                ┌──────────▼───┐ ┌────▼─────────┐ ┌▼──────────────┐
                │ product-svc  │ │ inventory-svc│ │  order-svc    │
                │ 商品/品牌/分类│ │ SKU库存三态   │ │ 购物车/订单   │
                │ SPU/SKU CRUD │ │ 预扣/确认/释放│ │ 支付/退款/关单 │
                │ 查询+搜索    │ │              │ │ 状态机        │
                └──────────┬───┘ └────┬─────────┘ └▲──────────────┘
                           │          │            │
                           └─── Redis(商品缓存)     │
                               PostgreSQL×3 ───────┴── Kafka(order-events)
```

### 服务边界与通信

- **product-service**（已有骨架，需补齐）：商品数据与查询。新增 Spu/Sku 写服务、查询/搜索 Controller、Redis 商品详情缓存
- **inventory-service**（新建）：只负责 SKU 库存，暴露 预扣/确认/释放/查询 接口；DB 行锁保证并发正确（Redis 预热/Lua 留给秒杀模块）
- **order-service**（新建）：购物车、订单、模拟支付、退款、超时关单；**OpenFeign 同步调库存预扣**，**Kafka 异步解耦**支付/关闭/退款事件
- 三服务各自独立 PostgreSQL 数据库，通过 gateway 对外

### 关键决策

- 库存预扣顺序：先建单（待支付）→ 再预扣 → 预扣失败则关单。订单永远有记录，可对账
- 单一事实源：库存权威数据在 inventory-service；product 的 sku 表通过 V5 迁移移除 `stock`/`locked_stock` 两列，避免双写不一致

## 3. 数据模型

### inventory-service 库

```sql
inventory(sku_id UUID PK, quantity INT, frozen INT DEFAULT 0, version BIGINT, updated_at)
-- 可售 available = quantity - frozen（计算列，不落库）
inventory_event(event_id UUID PK, order_id UUID, type VARCHAR, created_at)  -- 消费幂等去重
```

### product-service 库（已有 + V5 迁移）

- 新增 V5 迁移：移除 `sku.stock`、`sku.locked_stock`
- 商品详情接口联查 inventory-service 获取可售数展示

### order-service 库

```sql
cart(user_id, sku_id, quantity, checked, ...)              -- 唯一(user_id, sku_id)
orders(id, order_no UNIQUE, user_id, status, total_amount,
       pay_amount, created_at, paid_at, closed_at)
order_item(id, order_id, sku_id, product_name, sku_spec,
           price, quantity, subtotal)                      -- 下单时快照，历史不可变
payment(id, pay_no UNIQUE, order_id, amount, status,
        channel='MOCK', paid_at)
```

### 订单状态机

```
待支付 ──支付成功──▶ 已支付 ──发货──▶ 已发货 ──完成──▶ 已完成
  │                  │
  ├─超时/取消──▶ 已关闭       └─退款──▶ 退款中 ──▶ 已退款
```

### 库存三态流转（与订单状态对应）

| 动作 | SQL 语义 | 触发 |
|---|---|---|
| 预扣 | frozen += n | 下单（待支付） |
| 确认 | quantity -= n, frozen -= n | 支付成功 |
| 释放 | frozen -= n | 超时关单 / 取消 |
| 回补 | quantity += n | 退款完成 |

## 4. 核心流程

### 下单（同步预扣）

```
1. 提交订单（购物车选中 items）
2. order-svc 调 product-svc 批量取 sku 实时价格/名称 → 快照写入 order_item
3. 本地事务：建单(待支付) + 快照 + 清购物车选中项
4. Feign 调 inventory-svc 批量预扣库存
5. 成功 → 返回待支付订单；库存不足 → 订单置已关闭(保留记录)，返回明确错误
```

### 支付（模拟）+ 确认扣减（异步）

```
1. POST /orders/{id}/pay → 校验待支付
2. 事务：订单→已支付 + payment流水(成功)
3. 发 Kafka order.paid → inventory-svc 消费：quantity-=n, frozen-=n
4. 扣减失败(异常兜底) → 发 inventory.deduct-failed → order-svc 标记退款
```

### 超时关单 / 取消（都走释放冻结）

```
- @Scheduled 扫 待支付且超时(15分钟) 订单 → 关闭 → 发 order.closed
- 用户取消待支付 → 同流程，发 order.cancelled
- inventory-svc 消费：frozen -= n（释放）
```

### 发货 / 完成（管理员操作）

```
已支付 →(管理端发货)→ 已发货 →(用户确认/自动)→ 已完成
（后端仅提供状态流转接口，不含物流；发货/完成不触发库存变更）
```

### 退款（回补库存）

```
已支付→退款中→(mock退款)→已退款 → 发 order.refunded → inventory: quantity += n
```

## 5. Kafka 设计

- 单 topic `order-events`，事件结构：

```json
{ "eventId": "uuid", "orderId": "uuid", "orderNo": "NO20260811...",
  "type": "PAID|CLOSED|CANCELLED|REFUNDED", "items": [{"skuId":"uuid","quantity":2}] }
```

- 消费幂等：inventory-service 先插入 `inventory_event(event_id PK)` 去重，再执行库存变更

## 6. 错误处理 / 补偿 / 对账

| 场景 | 处理 |
|---|---|
| 预扣库存不足/超时 | 订单置已关闭（留记录），返回明确错误 |
| 支付成功但扣减失败 | `deduct-failed` 事件 → 订单触发退款 |
| Kafka 消费重复 | `inventory_event` 去重表 |
| 消息发送失败 | 先改库再发消息，失败定时重发；靠对账兜底（不引入 outbox） |
| 对账兜底 | 定时扫「已支付订单」↔「库存扣减记录」比对，缺失则重发/告警 |

## 7. 缓存策略

- product-svc：商品详情/分类列表 Redis 缓存，写操作删除对应 key
- 可售库存展示：详情接口联查 inventory，短 TTL(30s) 缓存

## 8. 测试策略

- 单元：库存三态、订单状态机、幂等去重
- 集成：Testcontainers(PostgreSQL + Kafka + Redis) 跑通「下单→支付→扣减→退款」全链路
- 契约：Feign 接口契约测试
- 覆盖率按项目指标（后端 ≥85%）

## 9. 实施顺序

```
阶段1 product-svc：补 Spu/Sku 写服务 + 查询/搜索 Controller + V5 移除库存列
阶段2 inventory-svc：表 + 三态接口 + 事件消费 + 幂等
阶段3 order-svc：购物车 + 订单 + 模拟支付 + 关单 + 退款 + Kafka
阶段4 全链路集成测试 + 对账任务
```
