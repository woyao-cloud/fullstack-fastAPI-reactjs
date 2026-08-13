# 商品/库存/订单前端（商城 + 管理后台）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 product/inventory/order 三服务构建一个 Next.js 前端（用户商城 + 管理后台），全部请求经 Spring Cloud Gateway（JWT）转发，并补齐支撑它的后端前置改动（order 列表/明细/内部端点、网关路由扩展与管理端 gate、compose 纳入网关与 user-service、权限种子）。

**Architecture:** 方案 A（网关直连 + 客户端 token）：浏览器持有 JWT，axios 拦截器加 `Authorization: Bearer`，Next rewrites 把 `/api/v1/*` 与 `/internal/*` 转发到网关 `:8080`；网关校验 JWT 后注入 `X-User-Id/X-User-Permissions` 并按前缀分发三服务；`/internal/orders/**` 额外要求 `order:manage` 权限并注入 `X-Internal-Token`。商城浏览为匿名 GET（网关放行只读路径），购物车/订单需登录。

**Tech Stack:** Next.js 16.2.10（App Router）+ React 19 + TS 5 + Tailwind 4 + shadcn/ui + Zustand 5 + react-hook-form + zod + axios + sonner + vitest 4 + RTL + playwright；后端 Spring Boot 3.5 + Spring Security（order-service 新增 starter）、Spring Cloud Gateway。

## Global Constraints

- 技术基线、依赖版本、Next 16 破坏性变更说明以 `user-service/front-end` 为参照（`node_modules/next/dist/docs/` 为准）。
- `OrderResponse` 结构（含明细 items）：`id, orderNo, status, totalAmount, paidAt, closedAt, items[OrderItemResponse{skuId,productName,skuSpec,price,quantity,subtotal}]`。
- 分页响应统一 `PageResponse<T>{items,total,page,size}`（非 Spring Page 结构）。
- 状态机：`PENDING_PAYMENT → PAID → SHIPPED → COMPLETED`；`PENDING_PAYMENT → CLOSED`（取消/15 分钟超时自动）；`PAID → REFUNDING → REFUNDED`（MOCK 立即）。
- 内部端点守卫：`/internal/**` 校验 `X-Internal-Token`，值 `dev-internal-token`（compose 环境变量 `INTERNAL_API_TOKEN`，与 product/inventory 一致）。
- 权限 code 约定 `module:action`：本迭代新增 `product:manage`、`inventory:manage`、`order:manage`；前端 `hasPermission` 与网关 gate 均兼容 `*:*` 通配。
- `SpuStatus` 枚举**小写**：`draft|active|inactive`（PATCH body 即枚举值）。
- `product-service` 的 `SkuResponse.available` 恒为 `0`（勿信）；商城详情库存必须查 `GET /api/v1/inventory/{skuId}`。
- `Cart.checked` 后端无写接口：勾选态存前端 Zustand（UI 态），下单传选中行的 `skuId+quantity`。
- 后端不用 Lombok（手动 getter/setter）；构造器注入；git 只 add 精确路径（绝不 `git add -A`）。
- 分页/筛选参数进 URL searchParams（可分享、刷新保持）。
- 后端测试沿用现有 JUnit 5 基建（h2/mockwebserver/feign-okhttp 已在 pom）；网关测试用 `MockServerWebExchange` + `StepVerifier`（参照 `AuthGlobalFilterTest`）。

---

## Phase A — 后端前置

### Task 1: order-service 订单列表 + 明细扩展

**Files:**
- Modify: `order-service/src/main/java/com/order/repository/OrderRepository.java`
- Modify: `order-service/src/main/java/com/order/service/OrderResponse.java`
- Modify: `order-service/src/main/java/com/order/service/OrderService.java`
- Modify: `order-service/src/main/java/com/order/web/OrderController.java`
- Create: `order-service/src/main/java/com/order/web/PageResponse.java`
- Test: `order-service/src/test/java/com/order/service/OrderServiceListTest.java`

**Interfaces:**
- Consumes: `OrderResponse`（现有字段）、`OrderItem`（getSkuId/getProductName/getSkuSpec/getPrice/getQuantity/getSubtotal）、`OrderRepository.findByIdAndUserId`
- Produces: `OrderResponse(UUID id, String orderNo, OrderStatus status, BigDecimal totalAmount, Instant paidAt, Instant closedAt, List<OrderItemResponse> items)`；`OrderItemResponse(UUID skuId, String productName, String skuSpec, BigDecimal price, int quantity, BigDecimal subtotal)`；`PageResponse<T>(List<T> items, long total, int page, int size)`；`OrderService.listOrders(UUID userId, OrderStatus status, int page, int size)`；`OrderRepository.findByUserId(UUID, Pageable)`、`findByUserIdAndStatus(UUID, OrderStatus, Pageable)`

- [ ] **Step 1: 改 `OrderResponse.java` 增加明细**

```java
package com.order.service;

import com.order.domain.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(UUID id, String orderNo, OrderStatus status, BigDecimal totalAmount,
                            Instant paidAt, Instant closedAt, List<OrderItemResponse> items) {
    public record OrderItemResponse(UUID skuId, String productName, String skuSpec,
                                    BigDecimal price, int quantity, BigDecimal subtotal) {}
}
```

- [ ] **Step 2: 新建 `PageResponse.java`**

```java
package com.order.web;

import java.util.List;

public record PageResponse<T>(List<T> items, long total, int page, int size) {}
```

- [ ] **Step 3: 扩展 `OrderRepository.java`**

```java
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByIdAndUserId(UUID id, UUID userId);
    Page<Order> findByUserId(UUID userId, Pageable pageable);
    Page<Order> findByUserIdAndStatus(UUID userId, OrderStatus status, Pageable pageable);
    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, Instant before);
    List<Order> findByStatusAndPaidAtBefore(OrderStatus status, Instant before);
}
```

- [ ] **Step 4: 写失败测试 `OrderServiceListTest.java`**

```java
package com.order.service;

import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
import com.order.repository.OrderItemRepository;
import com.order.repository.OrderRepository;
import com.order.web.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OrderServiceListTest {

    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
    private final OrderService orderService = new OrderService(orderRepository, orderItemRepository,
            mock(com.order.repository.CartRepository.class), mock(com.order.client.InventoryClient.class),
            mock(com.order.client.ProductClient.class), mock(com.order.event.OrderEventPublisher.class),
            mock(com.order.repository.PaymentRepository.class));

    private Order order(UUID id, String no) {
        Order o = new Order();
        o.setId(id);
        o.setOrderNo(no);
        o.setUserId(UUID.randomUUID());
        o.setStatus(OrderStatus.PENDING_PAYMENT);
        o.setTotalAmount(new BigDecimal("99.00"));
        o.setPayAmount(new BigDecimal("99.00"));
        return o;
    }

    @Test
    void listOrdersReturnsPageWithItems() {
        UUID userId = UUID.randomUUID();
        Order o = order(UUID.randomUUID(), "NO1");
        when(orderRepository.findByUserId(eq(userId), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(o)));
        OrderItem item = new OrderItem();
        item.setSkuId(UUID.randomUUID());
        item.setProductName("商品A");
        item.setSkuSpec("红色");
        item.setPrice(new BigDecimal("99.00"));
        item.setQuantity(1);
        item.setSubtotal(new BigDecimal("99.00"));
        when(orderItemRepository.findByOrderId(o.getId())).thenReturn(List.of(item));

        PageResponse<OrderResponse> result = orderService.listOrders(userId, null, 0, 20);

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items().get(0).items()).hasSize(1);
        assertThat(result.items().get(0).items().get(0).productName()).isEqualTo("商品A");
        verify(orderRepository).findByUserId(eq(userId), any(Pageable.class));
    }

    @Test
    void listOrdersFiltersByStatus() {
        UUID userId = UUID.randomUUID();
        when(orderRepository.findByUserIdAndStatus(eq(userId), eq(OrderStatus.PAID), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(order(UUID.randomUUID(), "NO2"))));
        when(orderItemRepository.findByOrderId(any())).thenReturn(List.of());

        PageResponse<OrderResponse> result = orderService.listOrders(userId, OrderStatus.PAID, 0, 20);

        assertThat(result.total()).isEqualTo(1);
        verify(orderRepository).findByUserIdAndStatus(eq(userId), eq(OrderStatus.PAID), any(Pageable.class));
    }
}
```

- [ ] **Step 5: 运行确认失败**

Run: `cd order-service && mvn -q -Dtest=OrderServiceListTest test`
Expected: 编译失败（`OrderResponse` 无 items 字段、`listOrders` 方法不存在）。

- [ ] **Step 6: 实现 `OrderService.listOrders` 并修复 `toResponse`/`getOrder`**

```java
// 新增 import
import com.order.web.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public PageResponse<OrderResponse> listOrders(UUID userId, OrderStatus status, int page, int size) {
    Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    Page<Order> p = (status == null)
            ? orderRepository.findByUserId(userId, pageable)
            : orderRepository.findByUserIdAndStatus(userId, status, pageable);
    return new PageResponse<>(p.getContent().stream()
            .map(o -> toResponse(o, itemsOf(o.getId()))).toList(),
            p.getTotalElements(), page, size);
}

// 修改既有私有方法（两处调用一并更新：createOrder 与 getOrder）
private static OrderResponse toResponse(Order order, List<OrderItem> items) {
    return new OrderResponse(order.getId(), order.getOrderNo(), order.getStatus(),
            order.getTotalAmount(), order.getPaidAt(), order.getClosedAt(),
            items.stream().map(i -> new OrderResponse.OrderItemResponse(
                    i.getSkuId(), i.getProductName(), i.getSkuSpec(),
                    i.getPrice(), i.getQuantity(), i.getSubtotal())).toList());
}

private static OrderResponse.OrderItemResponse toItem(OrderItem i) {
    return new OrderResponse.OrderItemResponse(
            i.getSkuId(), i.getProductName(), i.getSkuSpec(),
            i.getPrice(), i.getQuantity(), i.getSubtotal());
}
```

`createOrder` 末尾返回处（当前 `return toResponse(saved);` 两处）改为传入已保存的 `items`：
```java
return toResponse(saved, items);
```
`getOrder` 改为：
```java
public OrderResponse getOrder(UUID orderId, UUID userId) {
    return orderRepository.findByIdAndUserId(orderId, userId)
            .map(o -> toResponse(o, orderItemRepository.findByOrderId(orderId)))
            .orElseThrow(() -> new IllegalArgumentException("订单不存在: " + orderId));
}
```

- [ ] **Step 7: 新增 `OrderController` 列表端点**

```java
import org.springframework.web.bind.annotation.RequestParam;

@GetMapping
public PageResponse<OrderResponse> list(
        @RequestParam(required = false) OrderStatus status,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    return orderService.listOrders(userContext.currentUserId(), status, page, size);
}
```

- [ ] **Step 8: 运行全部测试确认通过**

Run: `cd order-service && mvn -q test`
Expected: 全绿（含既有 19 个测试——若既有测试直接构造 `OrderResponse`，一并更新其构造参数补 `items` 字段；若 `OrderService` 构造器参数与本任务测试中 mock 的 7 个依赖不完全一致，以实际构造器为准调整 mock 列表）。

- [ ] **Step 9: Commit**

```bash
git add order-service/src/main/java/com/order/repository/OrderRepository.java \
        order-service/src/main/java/com/order/service/OrderResponse.java \
        order-service/src/main/java/com/order/service/OrderService.java \
        order-service/src/main/java/com/order/web/OrderController.java \
        order-service/src/main/java/com/order/web/PageResponse.java \
        order-service/src/test/java/com/order/service/OrderServiceListTest.java
git commit -m "feat(order): 订单分页列表接口 + OrderResponse 明细扩展"
```

### Task 2: order-service 内部端点 + X-Internal-Token 守卫

**Files:**
- Modify: `order-service/pom.xml`（加 `spring-boot-starter-security`）
- Create: `order-service/src/main/java/com/order/config/SecurityConfig.java`
- Create: `order-service/src/main/java/com/order/web/InternalOrderController.java`
- Modify: `order-service/src/main/java/com/order/service/OrderService.java`
- Test: `order-service/src/test/java/com/order/web/InternalOrderControllerTest.java`
- Test: `order-service/src/test/java/com/order/config/SecurityConfigTest.java`

**Interfaces:**
- Consumes: `OrderService`（`PageResponse<OrderResponse>`、`OrderResponse`、`itemsOf(UUID)`、`requireStatus`）、`internal.api.token`（已在 application.yml，值 `${INTERNAL_API_TOKEN:dev-internal-token}`）
- Produces: `OrderService.listAllOrders(OrderStatus status, int page, int size)`、`getOrderAdmin(UUID id)`、`shipAdmin(UUID id)`、`refundAdmin(UUID id)`；`InternalOrderController`（`GET /internal/orders`、`GET /internal/orders/{id}`、`POST /internal/orders/{id}/ship`、`POST /internal/orders/{id}/refund`）

- [ ] **Step 1: pom.xml 加 security starter（参照 product-service）**

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

- [ ] **Step 2: 新建 `SecurityConfig.java`（镜像 product-service 版，仅包名注释差异）**

```java
package com.order.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Configuration
public class SecurityConfig {

    private final String internalToken;

    public SecurityConfig(@Value("${internal.api.token}") String internalToken) {
        this.internalToken = internalToken;
    }

    // /internal/** 服务间接口要求共享 token; /api/v1/** 由网关统一鉴权, 服务本身不校验
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .addFilterBefore(internalTokenFilter(), UsernamePasswordAuthenticationFilter.class)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/actuator/**", "/error").permitAll()
                .anyRequest().permitAll())
            .httpBasic(b -> b.disable())
            .formLogin(f -> f.disable());
        return http.build();
    }

    private OncePerRequestFilter internalTokenFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
                    throws ServletException, IOException {
                if (request.getRequestURI().startsWith("/internal/")
                        && !internalToken.equals(request.getHeader("X-Internal-Token"))) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN, "forbidden");
                    return;
                }
                chain.doFilter(request, response);
            }
        };
    }
}
```

- [ ] **Step 3: `OrderService` 增加管理端方法**

```java
public PageResponse<OrderResponse> listAllOrders(OrderStatus status, int page, int size) {
    Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
    Page<Order> p = (status == null)
            ? orderRepository.findAll(pageable)
            : orderRepository.findByStatus(status, pageable);
    return new PageResponse<>(p.getContent().stream()
            .map(o -> toResponse(o, itemsOf(o.getId()))).toList(),
            p.getTotalElements(), page, size);
}

public OrderResponse getOrderAdmin(UUID orderId) {
    Order order = requireOrderById(orderId);
    return toResponse(order, itemsOf(orderId));
}

public void shipAdmin(UUID orderId) {
    Order order = requireOrderById(orderId);
    requireStatus(order, OrderStatus.PAID);
    order.setStatus(OrderStatus.SHIPPED);
}

public void refundAdmin(UUID orderId) {
    Order order = requireOrderById(orderId);
    requireStatus(order, OrderStatus.PAID);   // 仅已支付可退
    order.setStatus(OrderStatus.REFUNDING);
    order.setStatus(OrderStatus.REFUNDED);    // 模拟立即退款成功
    publishAfterCommit(OrderEvent.EventType.REFUNDED, order, itemsOf(orderId));
}

private Order requireOrderById(UUID orderId) {
    return orderRepository.findById(orderId)
            .orElseThrow(() -> new IllegalArgumentException("订单不存在: " + orderId));
}
```

`OrderRepository` 补充：
```java
Page<Order> findByStatus(OrderStatus status, Pageable pageable);
```

- [ ] **Step 4: 新建 `InternalOrderController.java`**

```java
package com.order.web;

import com.order.domain.entity.OrderStatus;
import com.order.service.OrderResponse;
import com.order.service.OrderService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/internal/orders")
public class InternalOrderController {

    private final OrderService orderService;

    public InternalOrderController(OrderService orderService) { this.orderService = orderService; }

    @GetMapping
    public PageResponse<OrderResponse> list(@RequestParam(required = false) OrderStatus status,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return orderService.listAllOrders(status, page, size);
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable UUID id) { return orderService.getOrderAdmin(id); }

    @PostMapping("/{id}/ship")
    public void ship(@PathVariable UUID id) { orderService.shipAdmin(id); }

    @PostMapping("/{id}/refund")
    public void refund(@PathVariable UUID id) { orderService.refundAdmin(id); }
}
```

- [ ] **Step 5: 写失败测试 `InternalOrderControllerTest.java`（MockMvc + security）**

```java
package com.order.web;

import com.order.domain.entity.OrderStatus;
import com.order.service.OrderResponse;
import com.order.service.OrderService;
import com.order.web.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import com.order.config.SecurityConfig;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InternalOrderController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "internal.api.token=test-token")
class InternalOrderControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean OrderService orderService;

    @Test
    void rejectsMissingToken() throws Exception {
        mockMvc.perform(get("/internal/orders"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsWrongToken() throws Exception {
        mockMvc.perform(get("/internal/orders").header("X-Internal-Token", "wrong"))
                .andExpect(status().isForbidden());
    }

    @Test
    void listsOrdersWithToken() throws Exception {
        when(orderService.listAllOrders(isNull(), eq(0), eq(20)))
                .thenReturn(new PageResponse<>(List.of(
                        new OrderResponse(UUID.randomUUID(), "NO1", OrderStatus.PAID,
                                new BigDecimal("10"), null, null, List.of())), 1, 0, 20));
        mockMvc.perform(get("/internal/orders").header("X-Internal-Token", "test-token"))
                .andExpect(status().isOk());
    }

    @Test
    void shipsWithToken() throws Exception {
        mockMvc.perform(post("/internal/orders/{id}/ship", UUID.randomUUID())
                        .header("X-Internal-Token", "test-token"))
                .andExpect(status().isOk());
        verify(orderService).shipAdmin(any(UUID.class));
    }
}
```

- [ ] **Step 6: 运行确认失败**

Run: `cd order-service && mvn -q -Dtest=InternalOrderControllerTest test`
Expected: 失败（`listAllOrders`/`shipAdmin` 未定义、security 未生效）。

- [ ] **Step 7: 实现并运行全部测试**

Run: `cd order-service && mvn -q test`
Expected: 全绿（若 `@MockitoBean` 与既有测试基建版本不兼容，改用 Spring Boot 3.5 支持的方式，如 `org.springframework.boot.test.mock.mockito.MockBean` 或 `@MockBean`）。

- [ ] **Step 8: Commit**

```bash
git add order-service/pom.xml \
        order-service/src/main/java/com/order/config/SecurityConfig.java \
        order-service/src/main/java/com/order/web/InternalOrderController.java \
        order-service/src/main/java/com/order/service/OrderService.java \
        order-service/src/main/java/com/order/repository/OrderRepository.java \
        order-service/src/test/java/com/order/web/InternalOrderControllerTest.java
git commit -m "feat(order): /internal/orders 管理端点 + X-Internal-Token 守卫"
```

### Task 3: 网关路由扩展 + 管理端 gate + 匿名只读放行

**Files:**
- Modify: `gateway/src/main/java/com/gateway/config/RouteConfig.java`
- Create: `gateway/src/main/java/com/gateway/filter/AdminInternalFilter.java`
- Modify: `gateway/src/main/java/com/gateway/filter/AuthGlobalFilter.java`（匿名只读 GET 放行）
- Modify: `gateway/src/main/java/com/gateway/filter/AuthProperties.java`（加只读路径列表）
- Modify: `gateway/src/main/resources/application.yml`（加 `gateway.internal.token`、只读路径）
- Modify: `gateway/src/test/java/com/gateway/filter/AuthGlobalFilterTest.java`
- Create: `gateway/src/test/java/com/gateway/filter/AdminInternalFilterTest.java`

**Interfaces:**
- Consumes: `UserInfo.permissions()`、`AuthGlobalFilter` 注入的 `X-User-Permissions`
- Produces: `AdminInternalFilter`（`@Order(HIGHEST_PRECEDENCE+5)`，`/internal/**` 校验 `order:manage` 或 `*:*` → 注入 `X-Internal-Token`，否则 403）；`AuthProperties.publicReadPaths`；路由 `product-service/inventory-service/order-service/order-internal/user-service`

- [ ] **Step 1: `AuthProperties.java` 增加只读路径列表**

```java
public record AuthProperties(String jwtSecretKey, String jwtAlgorithm, List<String> excludePaths,
                             Blacklist blacklist, List<String> publicReadPaths) {
    public record Blacklist(java.time.Duration redisTimeout, boolean degradeOnFailure) {}
}
```

- [ ] **Step 2: `application.yml` 配置**

```yaml
gateway:
  auth:
    jwt-secret-key: ${JWT_SECRET_KEY}
    jwt-algorithm: HS256
    exclude-paths:
      - /api/v1/auth/login
      - /api/v1/auth/register
      - /api/v1/auth/refresh
      - /api/v1/auth/login/oauth
    public-read-paths:
      - /api/v1/products/**
      - /api/v1/categories/**
      - /api/v1/brands/**
      - /api/v1/inventory/**
    blacklist:
      redis-timeout: 50ms
      degrade-on-failure: true
  internal:
    token: ${INTERNAL_API_TOKEN:dev-internal-token}
```

- [ ] **Step 3: `AuthGlobalFilter` 放行匿名只读 GET**

```java
// filter() 开头, isExcluded 判断之后:
if (isPublicRead(path, exchange.getRequest().getMethod().name())) {
    return chain.filter(exchange);
}

// 新增方法:
private boolean isPublicRead(String path, String method) {
    if (!"GET".equals(method)) return false;
    return props.publicReadPaths().stream().anyMatch(p -> matcher.match(p, path));
}
```

注意：`AuthProperties` 构造参数新增 `publicReadPaths`，更新既有测试中 `new AuthProperties(...)` 的调用（见 Step 6）。

- [ ] **Step 4: 新建 `AdminInternalFilter.java`**

```java
package com.gateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Arrays;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)   // 在 AuthGlobalFilter(+3) 之后运行, 此时 X-User-Permissions 已注入
public class AdminInternalFilter implements GlobalFilter {

    private static final String ADMIN_PERMISSION = "order:manage";
    private static final String WILDCARD = "*:*";
    private final String internalToken;

    public AdminInternalFilter(@Value("${gateway.internal.token}") String internalToken) {
        this.internalToken = internalToken;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (!path.startsWith("/internal/")) {
            return chain.filter(exchange);
        }
        String perms = exchange.getRequest().getHeaders().getFirst("X-User-Permissions");
        boolean admin = perms != null && Arrays.stream(perms.split(","))
                .map(String::trim)
                .anyMatch(p -> p.equals(ADMIN_PERMISSION) || p.equals(WILDCARD));
        if (!admin) {
            exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
            return exchange.getResponse().setComplete();
        }
        var req = exchange.getRequest().mutate().header("X-Internal-Token", internalToken).build();
        return chain.filter(exchange.mutate().request(req).build());
    }
}
```

- [ ] **Step 5: `RouteConfig.java` 扩展路由**

```java
@Bean
public RouteLocator routes(RouteLocatorBuilder builder) {
    return builder.routes()
            .route("product-service", r -> r
                    .path("/api/v1/products/**", "/api/v1/categories/**", "/api/v1/brands/**")
                    .uri("http://product-service:8081"))
            .route("inventory-service", r -> r
                    .path("/api/v1/inventory/**")
                    .uri("http://inventory-service:8082"))
            .route("order-service", r -> r
                    .path("/api/v1/cart/**", "/api/v1/orders/**")
                    .uri("http://order-service:8083"))
            .route("order-internal", r -> r
                    .path("/internal/orders/**")
                    .filters(f -> f.circuitBreaker(c -> c
                            .setName("order-internal")
                            .setFallbackUri("forward:/fallback/order-internal")))
                    .uri("http://order-service:8083"))
            .route("user-service", r -> r
                    .path("/api/v1/**")
                    .filters(f -> f.circuitBreaker(c -> c
                            .setName("user-service")
                            .setFallbackUri("forward:/fallback/user-service")))
                    .uri("http://user-service:8000"))
            .build();
}
```

（具体前缀路由必须先于 `user-service` 的 `/api/v1/**` 兜底声明。）

- [ ] **Step 6: 写失败测试**

`AdminInternalFilterTest.java`（镜像 `AuthGlobalFilterTest` 的 `MockServerWebExchange` + `StepVerifier` 模式）：

```java
package com.gateway.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminInternalFilterTest {

    private final AdminInternalFilter filter = new AdminInternalFilter("dev-token");
    private final GatewayFilterChain chain = mock(GatewayFilterChain.class);

    @BeforeEach
    void setUp() {
        when(chain.filter(org.mockito.ArgumentMatchers.any())).thenReturn(Mono.empty());
    }

    @Test
    void passesThroughNonInternalPaths() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/products/search").build());
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    void rejectsInternalWithoutAdminPermission() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/internal/orders")
                        .header("X-User-Permissions", "user:read"));
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void injectsInternalTokenForAdmin() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/internal/orders")
                        .header("X-User-Permissions", "user:read,order:manage"));
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(exchange.getRequest().getHeaders().getFirst("X-Internal-Token")).isEqualTo("dev-token");
    }

    @Test
    void acceptsWildcardPermission() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/internal/orders")
                        .header("X-User-Permissions", "*:*"));
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(exchange.getRequest().getHeaders().getFirst("X-Internal-Token")).isEqualTo("dev-token");
    }
}
```

`AuthGlobalFilterTest` 追加（并修复既有 `new AuthProperties(...)` 构造——新增第 5 参 `List.of("/api/v1/products/**")` 等）：

```java
@Test
void allowsAnonymousGetOnPublicReadPaths() {
    var exchange = MockServerWebExchange.from(
            MockServerHttpRequest.get("/api/v1/products/search").build());
    StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
    assertThat(exchange.getResponse().getStatusCode()).isNull();
}

@Test
void stillRequiresAuthForPublicReadWrites() {
    var exchange = MockServerWebExchange.from(
            MockServerHttpRequest.post("/api/v1/products").build());
    filter.filter(exchange, chain).subscribe();
    assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
}
```

- [ ] **Step 7: 运行确认失败**

Run: `cd gateway && mvn -q -Dtest=AdminInternalFilterTest,AuthGlobalFilterTest test`
Expected: 失败（`AdminInternalFilter` 不存在、`AuthProperties` 构造参数不匹配）。

- [ ] **Step 8: 运行全部网关测试通过**

Run: `cd gateway && mvn -q test`
Expected: 全绿。

- [ ] **Step 9: Commit**

```bash
git add gateway/src/main/java/com/gateway/config/RouteConfig.java \
        gateway/src/main/java/com/gateway/filter/AdminInternalFilter.java \
        gateway/src/main/java/com/gateway/filter/AuthGlobalFilter.java \
        gateway/src/main/java/com/gateway/filter/AuthProperties.java \
        gateway/src/main/resources/application.yml \
        gateway/src/test/java/com/gateway/filter/AuthGlobalFilterTest.java \
        gateway/src/test/java/com/gateway/filter/AdminInternalFilterTest.java
git commit -m "feat(gateway): 三服务路由分发 + 管理端 /internal gate + 匿名只读放行"
```

### Task 4: 根 compose 纳入网关+user-service+redis 健康检查 + 权限种子

**Files:**
- Modify: `docker-compose.yml`（redis 加 healthcheck；新增 user-service、gateway 服务）
- Create: `user-service/back-end/scripts/seed_module_permissions.py`（幂等）
- Modify: `scripts/test-data/README.md`（可选：加网关/前端验证说明）

**Interfaces:**
- Consumes: `gateway` 的 Dockerfile（`gateway/Dockerfile`）、`user-service` 的 Dockerfile（`user-service/back-end/Dockerfile`）、`INTERNAL_API_TOKEN=dev-internal-token`、`JWT_SECRET_KEY=dev-secret-key-change-in-production`
- Produces: 根 compose 含 `gateway:8080`、`user-service:8000`；权限种子脚本幂等可重跑

- [ ] **Step 1: root `docker-compose.yml` 修改**

`redis` 服务加 healthcheck：
```yaml
  redis:
    image: redis:latest
    container_name: redis
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

文件末尾追加（三服务之后）：
```yaml
  user-service:
    build: ./user-service/back-end
    container_name: user-service
    # 仅回环绑定
    ports: ["127.0.0.1:8000:8000"]
    environment:
      DATABASE_URL: sqlite+aiosqlite:///./user_service.db
      JWT_SECRET_KEY: dev-secret-key-change-in-production
      REDIS_URL: redis://redis:6379/0
      CACHE_ENABLED: "true"
    depends_on:
      redis:
        condition: service_healthy
  gateway:
    build: ./gateway
    container_name: gateway
    # 仅回环绑定
    ports: ["127.0.0.1:8080:8080"]
    environment:
      JWT_SECRET_KEY: dev-secret-key-change-in-production
      SPRING_PROFILES_ACTIVE: local
      SPRING_DATA_REDIS_HOST: redis
      SPRING_DATA_REDIS_PORT: "6379"
      INTERNAL_API_TOKEN: dev-internal-token
    depends_on:
      redis:
        condition: service_healthy
      user-service:
        condition: service_started
```

- [ ] **Step 2: 新建权限种子脚本 `seed_module_permissions.py`**

```python
"""幂等地为 user-service(sqlite) 注入三模块权限并赋给 SUPER_ADMIN。

用法: python scripts/seed_module_permissions.py
     或 docker compose exec user-service python scripts/seed_module_permissions.py
"""
import sqlite3
import os

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "user_service.db")
PERMISSIONS = ["product:manage", "inventory:manage", "order:manage"]


def main() -> None:
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    admin_role = cur.execute(
        "SELECT id FROM role WHERE code='SUPER_ADMIN'"
    ).fetchone()
    if admin_role is None:
        print("SUPER_ADMIN role not found; skip")
        return
    role_id = admin_role[0]
    for code in PERMISSIONS:
        cur.execute("INSERT OR IGNORE INTO permission (id, code, name, type, sort_order) "
                    "VALUES (lower(hex(randomblob(16))), ?, ?, 'ACTION', 0)", (code, code))
        pid = cur.execute("SELECT id FROM permission WHERE code=?", (code,)).fetchone()[0]
        cur.execute("INSERT OR IGNORE INTO role_permission (role_id, permission_id) VALUES (?, ?)",
                    (role_id, pid))
    conn.commit()
    print("seeded:", PERMISSIONS)
    conn.close()


if __name__ == "__main__":
    main()
```

> 注意：`permission` 表结构以 `user-service/back-end/app/domain/models/role.py` 为准；如列名（`name/type/sort_order`）不同，以实际模型为准调整 INSERT。执行前先 `python -c "import sqlite3;c=sqlite3.connect('user_service.db');print([r[1] for r in c.execute('PRAGMA table_info(permission)')])"` 核对列名。

- [ ] **Step 3: 运行种子并验证**

Run: `cd user-service/back-end && python scripts/seed_module_permissions.py`
验证：
```bash
python -c "import sqlite3;c=sqlite3.connect('user_service.db');print(c.execute(\"SELECT code FROM permission WHERE code LIKE '%:manage'\").fetchall())"
```
Expected: `[('product:manage',), ('inventory:manage',), ('order:manage',)]`

- [ ] **Step 4: 验证 compose 语法**

Run: `docker compose config --quiet`
Expected: 无输出（exit 0）。

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml user-service/back-end/scripts/seed_module_permissions.py
git commit -m "feat(compose): 网关+user-service 入根 compose、redis 健康检查、三模块权限种子"
```

---

## Phase B — 前端

### Task 5: `frontend/` 脚手架（对齐 user-service/front-end 基线）

**Files:**
- Create: `frontend/package.json`、`frontend/tsconfig.json`、`frontend/next.config.ts`、`frontend/postcss.config.mjs`、`frontend/eslint.config.mjs`、`frontend/vitest.config.ts`、`frontend/vitest.setup.ts`、`frontend/playwright.config.ts`、`frontend/components.json`、`frontend/app/globals.css`、`frontend/app/layout.tsx`、`frontend/app/page.tsx`、`frontend/.gitignore`

**Interfaces:**
- Produces: 可 `npm run dev` 的 Next 16 App Router 应用；rewrites `/api/v1/:path*` 与 `/internal/:path*` → `http://localhost:8080`（网关）

- [ ] **Step 1: 复制 `user-service/front-end` 的基线依赖版本**

`package.json`（版本与既有 front-end 一致）：
```json
{
  "name": "frontend",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "next": "16.2.10",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "zustand": "5.0.14",
    "axios": "1.18.1",
    "react-hook-form": "7.81.0",
    "zod": "4.4.3",
    "@hookform/resolvers": "^5.0.0",
    "sonner": "^2.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.0",
    "lucide-react": "^0.475.0",
    "@radix-ui/react-slot": "^1.1.1"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "shadcn": "4.13.0",
    "vitest": "4.1.10",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.6.0",
    "jsdom": "^25.0.0",
    "@playwright/test": "^1.49.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "16.2.10"
  }
}
```

- [ ] **Step 2: `next.config.ts` rewrites → 网关**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/v1/:path*", destination: "http://localhost:8080/api/v1/:path*" },
      { source: "/internal/:path*", destination: "http://localhost:8080/internal/:path*" },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 3: 基础配置文件**

`tsconfig.json`（paths `@/*` → `./*`，继承既有 front-end 的 compilerOptions，含 `"strict": true`、`"plugins": [{"name": "next"}]`、`jsx: preserve`）。`postcss.config.mjs`：
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```
`vitest.config.ts`：
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    coverage: { reporter: ["text", "html"], thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } },
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```
`vitest.setup.ts`：`import "@testing-library/jest-dom/vitest";`

- [ ] **Step 4: 根布局 + 入口页**

`app/globals.css`：`@import "tailwindcss";` + shadcn 主题变量（复制既有 front-end 的 globals.css 前半，含 `:root`/`.dark` token）。
`app/layout.tsx`：
```tsx
import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = { title: "电商商城", description: "商品 / 库存 / 订单" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
```
`app/page.tsx`：最小占位页（**不要** redirect —— 商城首页在 Task 8 落在 `/` 的 `(storefront)/page.tsx`，届时本占位页被其取代）：
```tsx
export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      商城加载中…
    </main>
  );
}
```

- [ ] **Step 5: 初始化 shadcn/ui 与基础组件**

Run: `cd frontend && npx shadcn@4.13.0 init`（选择 Tailwind v4 + CSS variables），然后 `npx shadcn add button input label card select table checkbox dialog form textarea skeleton badge tabs separator`
Expected: `components/ui/*` 生成；`npm run dev` 可启动。

- [ ] **Step 6: 运行验证**

Run: `cd frontend && npm install && npm run build`
Expected: 构建成功。

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/next.config.ts frontend/postcss.config.mjs frontend/eslint.config.mjs frontend/vitest.config.ts frontend/vitest.setup.ts frontend/playwright.config.ts frontend/components.json frontend/app/globals.css frontend/app/layout.tsx frontend/app/page.tsx frontend/.gitignore
git commit -m "feat(frontend): Next.js 16 脚手架 + rewrites 到网关"
```

### Task 6: API 层 + 类型定义

**Files:**
- Create: `frontend/types/api.ts`
- Create: `frontend/lib/api/client.ts`
- Create: `frontend/lib/api/products.ts`、`categories.ts`、`brands.ts`、`inventory.ts`、`cart.ts`、`orders.ts`
- Test: `frontend/__tests__/lib/api/client.test.ts`

**Interfaces:**
- Consumes: 三服务端点（Phase A 已扩展）、rewrites
- Produces: `api`（baseURL `/api/v1`）与 `internalApi`（baseURL `/internal`）两个 axios 实例（共享拦截器工厂）；各模块函数

- [ ] **Step 1: `types/api.ts`**

```ts
export type SpuStatus = "draft" | "active" | "inactive";
export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "SHIPPED" | "COMPLETED" | "CLOSED" | "REFUNDING" | "REFUNDED";

export interface PageResponse<T> { items: T[]; total: number; page: number; size: number; }

export interface CategoryResponse { id: string; name: string; slug: string; parentId: string | null; sortOrder: number; icon: string | null; isActive: boolean; children: CategoryResponse[]; }
export interface BrandResponse { id: string; name: string; logoUrl: string | null; description: string | null; sortOrder: number; }
export interface SkuResponse { id: string; specs: Record<string, string>; price: string; skuCode: string; barCode: string | null; weight: string | null; images: string[]; isActive: boolean; available: number; }
export interface SpuResponse { id: string; name: string; description: string | null; category: CategoryResponse | null; brand: BrandResponse | null; status: SpuStatus; coverImage: string | null; images: string[]; specsTemplate: { key: string; values: string[] }[]; tags: string[]; skus: SkuResponse[]; }
export interface SpuCreateRequest { name: string; description?: string | null; categoryId: string; brandId?: string | null; coverImage?: string | null; images?: string[]; specsTemplate?: { key: string; values: string[] }[]; tags?: string[]; skus: { specs: Record<string, string>; price: string; skuCode: string; barCode?: string | null; weight?: string | null; images?: string[]; isActive: boolean }[]; }
export interface CategoryRequest { name: string; slug: string; parentId?: string | null; sortOrder: number; icon?: string | null; isActive: boolean; }
export interface BrandRequest { name: string; logoUrl?: string | null; description?: string | null; sortOrder: number; }
export interface InventoryStock { skuId: string; quantity: number; frozen: number; available: number; }
export interface CartItem { id: string; userId: string; skuId: string; quantity: number; checked: boolean; createdAt: string; updatedAt: string; }
export interface OrderItemResponse { skuId: string; productName: string; skuSpec: string; price: string; quantity: number; subtotal: string; }
export interface OrderResponse { id: string; orderNo: string; status: OrderStatus; totalAmount: string; paidAt: string | null; closedAt: string | null; items: OrderItemResponse[]; }
export interface CreateOrderRequest { lines: { skuId: string; quantity: number }[]; }
```

- [ ] **Step 2: `lib/api/client.ts`（工厂 + 双实例）**

```ts
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { useAuthStore } from "@/stores/auth";

function createClient(baseURL: string): AxiosInstance {
  const instance = axios.create({ baseURL, headers: { "Content-Type": "application/json" } });

  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  let isRefreshing = false;
  let failedQueue: Array<{ resolve: (token: string | null) => void; reject: (err: unknown) => void }> = [];
  const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token)));
    failedQueue = [];
  };

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise<string | null>((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            if (token) originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${token}` };
            return instance(originalRequest);
          });
        }
        originalRequest._retry = true;
        isRefreshing = true;
        try {
          const newToken = await useAuthStore.getState().refreshAccessToken();
          if (newToken) {
            processQueue(null, newToken);
            originalRequest.headers = { ...originalRequest.headers, Authorization: `Bearer ${newToken}` };
            return instance(originalRequest);
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
  return instance;
}

export const api = createClient("/api/v1");
export const internalApi = createClient("/internal");
```

- [ ] **Step 3: 各模块 API**

```ts
// lib/api/products.ts
import { api } from "./client";
import type { PageResponse, SpuCreateRequest, SpuResponse, SpuStatus } from "@/types/api";

export interface ProductSearchParams { q?: string; category?: string; brand?: string; minPrice?: string; maxPrice?: string; sort?: string; page?: number; size?: number; }

export const productsApi = {
  search: (params: ProductSearchParams) =>
    api.get<PageResponse<SpuResponse>>("/products/search", { params }),
  detail: (id: string) => api.get<SpuResponse>(`/products/${id}`),
  create: (req: SpuCreateRequest) => api.post<SpuResponse>("/products", req),
  update: (id: string, req: SpuCreateRequest) => api.put<SpuResponse>(`/products/${id}`, req),
  changeStatus: (id: string, status: SpuStatus) => api.patch<void>(`/products/${id}/status`, status),
  remove: (id: string) => api.delete<void>(`/products/${id}`),
};

// lib/api/categories.ts
import { api } from "./client";
import type { CategoryRequest, CategoryResponse } from "@/types/api";

export const categoriesApi = {
  tree: () => api.get<CategoryResponse[]>("/categories/tree"),
  create: (req: CategoryRequest) => api.post<CategoryResponse>("/categories", req),
  update: (id: string, req: CategoryRequest) => api.put<CategoryResponse>(`/categories/${id}`, req),
  remove: (id: string) => api.delete<void>(`/categories/${id}`),
};

// lib/api/brands.ts
import { api } from "./client";
import type { BrandRequest, BrandResponse, PageResponse } from "@/types/api";

export const brandsApi = {
  list: (page = 0, size = 20) => api.get<PageResponse<BrandResponse>>("/brands", { params: { page, size } }),
  create: (req: BrandRequest) => api.post<BrandResponse>("/brands", req),
  update: (id: string, req: BrandRequest) => api.put<BrandResponse>(`/brands/${id}`, req),
  remove: (id: string) => api.delete<void>(`/brands/${id}`),
};

// lib/api/inventory.ts
import { api } from "./client";
import type { InventoryStock } from "@/types/api";

export const inventoryApi = {
  get: (skuId: string) => api.get<InventoryStock>(`/inventory/${skuId}`),
};

// lib/api/cart.ts
import { api } from "./client";
import type { CartItem } from "@/types/api";

export const cartApi = {
  list: () => api.get<CartItem[]>("/cart"),
  add: (skuId: string, quantity: number) => api.post<void>("/cart", { skuId, quantity }),
  remove: (skuId: string) => api.delete<void>(`/cart/${skuId}`),
};

// lib/api/orders.ts
import { api, internalApi } from "./client";
import type { CreateOrderRequest, OrderResponse, OrderStatus, PageResponse } from "@/types/api";

export const ordersApi = {
  create: (req: CreateOrderRequest) => api.post<OrderResponse>("/orders", req),
  list: (status?: OrderStatus, page = 0, size = 20) =>
    api.get<PageResponse<OrderResponse>>("/orders", { params: { status, page, size } }),
  get: (id: string) => api.get<OrderResponse>(`/orders/${id}`),
  pay: (id: string) => api.post<void>(`/orders/${id}/pay`),
  cancel: (id: string) => api.post<void>(`/orders/${id}/cancel`),
  refund: (id: string) => api.post<void>(`/orders/${id}/refund`),
};

export const adminOrdersApi = {
  list: (status?: OrderStatus, page = 0, size = 20) =>
    internalApi.get<PageResponse<OrderResponse>>("/orders", { params: { status, page, size } }),
  get: (id: string) => internalApi.get<OrderResponse>(`/orders/${id}`),
  ship: (id: string) => internalApi.post<void>(`/orders/${id}/ship`),
  refund: (id: string) => internalApi.post<void>(`/orders/${id}/refund`),
};
```

- [ ] **Step 4: 写失败测试 `__tests__/lib/api/client.test.ts`（401 刷新重放）**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth";

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: vi.fn() },
}));

describe("api client", () => {
  beforeEach(() => {
    (useAuthStore.getState as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      accessToken: "token-1",
      refreshAccessToken: vi.fn().mockResolvedValue("token-2"),
      logout: vi.fn(),
    });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("attaches bearer token", async () => {
    const adapter = vi.fn().mockResolvedValue({ data: {}, status: 200, statusText: "OK", headers: {}, config: {} });
    const resp = await api.get("/products/search", { adapter });
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer token-1");
  });

  it("refreshes and replays on 401 once", async () => {
    let calls = 0;
    const adapter = vi.fn().mockImplementation(async (config: any) => {
      calls++;
      if (calls === 1) {
        const err: any = new Error("Unauthorized");
        err.response = { status: 401, data: {} }; err.config = config;
        throw err;
      }
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    });
    const resp = await api.get("/cart", { adapter });
    expect(resp.data).toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe("Bearer token-2");
  });
});
```

- [ ] **Step 5: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/lib/api/client.test.ts`
Expected: 失败（`client.ts` 不存在 / `useAuthStore` 未实现 —— 本任务先建 `stores/auth.ts` 空壳导出 `useAuthStore` 满足编译，Task 7 实现完整逻辑）。

- [ ] **Step 6: 运行通过**

Run: `cd frontend && npx vitest run`
Expected: 通过。

- [ ] **Step 7: Commit**

```bash
git add frontend/types/api.ts frontend/lib/api/client.ts frontend/lib/api/products.ts frontend/lib/api/categories.ts frontend/lib/api/brands.ts frontend/lib/api/inventory.ts frontend/lib/api/cart.ts frontend/lib/api/orders.ts frontend/__tests__/lib/api/client.test.ts
git commit -m "feat(frontend): API 层 + DTO 类型 + 401 并发刷新"
```

### Task 7: 认证（auth store + 登录页 + 管理端守卫）

**Files:**
- Create: `frontend/stores/auth.ts`
- Create: `frontend/app/(auth)/login/page.tsx`
- Create: `frontend/components/shared/permission-guard.tsx`
- Create: `frontend/app/admin/layout.tsx`
- Test: `frontend/__tests__/stores/auth.test.ts`

**Interfaces:**
- Consumes: `useAuthStore`（Task 6 已引用）、`/auth/login|refresh|me`（经网关 → user-service）、`hasPermission`（含 `*:*`）
- Produces: `useAuthStore`（`accessToken/user/permissions/isAuthenticated/isLoading` + `login/logout/hydrate/refreshAccessToken/hasPermission/hasAnyPermission`）、`PermissionGuard`、`admin` 路由守卫

**后端前置（plan-fix `b5c3a511` 后核验，缺失即登录/管理端全断）:** user-service 当前签发 access token 仅含 `sub/type/iat/exp/jti`，网关 `JwtParser` 读取的 `email`/`permissions` claim 恒为空 → `X-User-Permissions` 为空 → `AdminInternalFilter` 对所有 `/internal/**` 返回 403（管理端死）；且 user-service 无 `/auth/me` 路由。修复（backend 前置，随本 Task 一并实施）：
1. `user-service/back-end/app/core/security.py`：`create_access_token(user_id, email, permissions)` 在 payload 增加 `"email"` 与 `"permissions"` claim（`_create_token` 加可选 claims 参数）。
2. `user-service/back-end/app/application/services/auth_service.py`：`login()`/`refresh()` 调 `create_access_token(user.id, user.email, list(await user.permission_codes()))`。
3. 新增 `GET /api/v1/auth/me`（`auth.py`，`response_model=MeResponse`，`Depends(get_current_user)`）：返回 `{id, email, name: user.full_name 或 None, permissions: list(await user.permission_codes())}`。`MeResponse` schema 建于 `app/application/schemas/auth.py`。
4. 测试：`tests/test_auth.py` 补 ①登录后 access token 含 `permissions`/`email` claim（`decode_token` 断言）②`GET /auth/me` 带 Bearer 返回 id/email/name/permissions ③无 token 401。

- [ ] **Step 1: `stores/auth.ts`（移植既有，补 module 权限；`/auth/me` 调用必须带 `Authorization: Bearer <accessToken>` 头）**

```ts
import { create } from "zustand";
import { api } from "@/lib/api/client";

const REFRESH_KEY = "refresh_token";

export interface UserOut { id: string; email: string; name?: string; }
export interface TokenResponse { access_token: string; refresh_token: string; }

interface AuthState {
  accessToken: string | null;
  user: UserOut | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

async function apiCall<T>(url: string, init?: { method?: string; body?: unknown; token?: string }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", ...(init?.token ? { Authorization: `Bearer ${init.token}` } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
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
  permissions: [],
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const data = await apiCall<TokenResponse>("/api/v1/auth/login", { method: "POST", body: { email, password } });
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    const me = await apiCall<{ permissions: string[] } & UserOut>("/api/v1/auth/me", { method: "GET", token: data.access_token });
    set({ accessToken: data.access_token, user: me, permissions: me.permissions, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, user: null, permissions: [], isAuthenticated: false, isLoading: false });
  },

  hydrate: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) { set({ isLoading: false }); return; }
    try {
      const t = await get().refreshAccessToken();
      if (!t) return;
      const me = await apiCall<{ permissions: string[] } & UserOut>("/api/v1/auth/me", { method: "GET", token: get().accessToken ?? undefined });
      set({ user: me, permissions: me.permissions, isAuthenticated: true, isLoading: false });
    } catch {
      get().logout();
      set({ isLoading: false });
    }
  },

  refreshAccessToken: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return null;
    try {
      const data = await apiCall<TokenResponse>("/api/v1/auth/refresh", { method: "POST", body: { refresh_token: rt } });
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      set({ accessToken: data.access_token, isAuthenticated: true });
      return data.access_token;
    } catch {
      get().logout();
      return null;
    }
  },

  hasPermission: (code) => {
    const perms = get().permissions;
    return perms.includes("*:*") || perms.includes(code);
  },
  hasAnyPermission: (codes) => {
    const perms = get().permissions;
    return codes.some((c) => perms.includes("*:*") || perms.includes(c));
  },
}));
```

- [ ] **Step 2: 登录页 `app/(auth)/login/page.tsx`（react-hook-form + zod）**

```tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少 6 位"),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success("登录成功");
      router.push("/admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>进入管理后台或商城</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" {...register("password")} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "登录中…" : "登录"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: `PermissionGuard` + `admin/layout.tsx`**

```tsx
// components/shared/permission-guard.tsx
"use client";
import { useAuthStore } from "@/stores/auth";

export function PermissionGuard({ code, children }: { code: string; children: React.ReactNode }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(code)) {
    return <p className="p-8 text-center text-muted-foreground">无权限访问该功能（需要 {code}）</p>;
  }
  return <>{children}</>;
}
```

```tsx
// app/admin/layout.tsx
"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Sidebar } from "@/components/admin/sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">加载中…</div>;
  }
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

`components/admin/sidebar.tsx`：navItems（仪表板/商品管理/分类管理/品牌管理/库存查询/订单管理 → `/admin/products` 等），含 `PermissionGuard` 或 `hasAnyPermission` 显隐商品/库存/订单三项（code：`product:manage` / `inventory:manage` / `order:manage`），底部登出按钮调用 `logout()` 后 `router.push("/")`。

- [ ] **Step 4: 写失败测试 `__tests__/stores/auth.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: "a1", refresh_token: "r1" }),
  });
  useAuthStore.setState({ accessToken: null, user: null, permissions: [], isAuthenticated: false, isLoading: false });
});
afterEach(() => { vi.resetAllMocks(); });

describe("auth store", () => {
  it("hasPermission supports wildcard", () => {
    useAuthStore.setState({ permissions: ["*:*"] });
    expect(useAuthStore.getState().hasPermission("order:manage")).toBe(true);
  });

  it("hasPermission matches exact code", () => {
    useAuthStore.setState({ permissions: ["order:manage", "user:read"] });
    expect(useAuthStore.getState().hasPermission("order:manage")).toBe(true);
    expect(useAuthStore.getState().hasPermission("inventory:manage")).toBe(false);
  });

  it("login stores token and calls /auth/me with Bearer header", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "a1", refresh_token: "r1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "u1", email: "a@b.c", permissions: ["order:manage"] }) });
    await useAuthStore.getState().login("a@b.c", "secret1");
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.permissions).toContain("order:manage");
    expect(localStorage.getItem("refresh_token")).toBe("r1");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer a1");
  });
});
```

- [ ] **Step 5: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/stores/auth.test.ts`
Expected: 失败（`stores/auth.ts` 未实现完整逻辑）。

- [ ] **Step 6: 运行全部测试通过**

Run: `cd frontend && npx vitest run`
Expected: 通过（含 Task 6 的 client 测试——注意 client 测试 mock 了 `@/stores/auth`，与真实实现兼容）。

- [ ] **Step 7: Commit**

```bash
git add frontend/stores/auth.ts frontend/app/'(auth)'/login/page.tsx frontend/components/shared/permission-guard.tsx frontend/app/'admin'/layout.tsx frontend/components/admin/sidebar.tsx frontend/__tests__/stores/auth.test.ts
git commit -m "feat(frontend): auth store + 登录页 + 管理端权限守卫"
```

### Task 8: 商城商品列表页

**Files:**
- Delete: `frontend/app/page.tsx`（Task 5 占位页，改由本任务 `/` 商城首页取代）
- Create: `frontend/app/(storefront)/layout.tsx`
- Create: `frontend/app/(storefront)/page.tsx`（URL `/`，取代 Task 5 的根占位页）
- Create: `frontend/components/storefront/product-card.tsx`
- Create: `frontend/lib/schemas/product.ts`（搜索参数校验，可后续复用于表单）
- Test: `frontend/__tests__/components/storefront/product-card.test.tsx`

**Interfaces:**
- Consumes: `productsApi.search`、`categoriesApi.tree`、`brandsApi.list`、`PageResponse<SpuResponse>`、`SpuStatus`（active 可购）
- Produces: 商城首页（URL searchParams 驱动筛选/分页）；`ProductCard` 组件

- [ ] **Step 1: `(storefront)/layout.tsx`（顶栏 + 子布局）**

客户端组件：顶栏含 Logo（链接 `/`）、搜索框（提交跳 `/?q=...`）、`/cart` 图标入口（显示数量）、用户菜单（未登录 → 链接 `/login`；已登录 → 显示邮箱 + 下拉：我的订单/后台入口/登出）。`useAuthStore` 提供状态。

- [ ] **Step 2: `(storefront)/page.tsx` 商品列表**

```tsx
"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { productsApi } from "@/lib/api/products";
import { categoriesApi } from "@/lib/api/categories";
import { brandsApi } from "@/lib/api/brands";
import type { CategoryResponse, BrandResponse, PageResponse, SpuResponse } from "@/types/api";
import { ProductCard } from "@/components/storefront/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function StorefrontHome() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Number(sp.get("page") ?? 0);
  const [data, setData] = useState<PageResponse<SpuResponse> | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [brands, setBrands] = useState<BrandResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { categoriesApi.tree().then((r) => setCategories(r.data)).catch(() => {}); }, []);
  useEffect(() => { brandsApi.list(0, 100).then((r) => setBrands(r.data.items)).catch(() => {}); }, []);

  const load = useCallback(() => {
    setLoading(true);
    productsApi.search({
      q: sp.get("q") ?? undefined,
      category: sp.get("category") ?? undefined,
      brand: sp.get("brand") ?? undefined,
      minPrice: sp.get("minPrice") ?? undefined,
      maxPrice: sp.get("maxPrice") ?? undefined,
      sort: sp.get("sort") ?? undefined,
      page,
      size: 12,
    }).then((r) => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [sp, page]);

  useEffect(() => { load(); }, [load]);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.set("page", "0");
    router.push(`/?${next.toString()}`);
  };
  const goPage = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set("page", String(p));
    router.push(`/?${next.toString()}`);
  };

  return (
    <div className="container mx-auto grid grid-cols-[220px_1fr] gap-6 p-6">
      <aside className="space-y-6">
        <div>
          <h3 className="mb-2 font-semibold">分类</h3>
          {categories.map((c) => (
            <button key={c.id} className="block text-sm hover:underline" onClick={() => push({ category: c.slug })}>
              {c.name}
            </button>
          ))}
        </div>
        <div>
          <h3 className="mb-2 font-semibold">品牌</h3>
          {brands.map((b) => (
            <button key={b.id} className="block text-sm hover:underline" onClick={() => push({ brand: b.name })}>
              {b.name}
            </button>
          ))}
        </div>
      </aside>
      <section>
        <div className="mb-4 flex items-center gap-4">
          <span className="text-sm text-muted-foreground">共 {data?.total ?? 0} 件</span>
          <select className="ml-auto text-sm" value={sp.get("sort") ?? ""}
            onChange={(e) => push({ sort: e.target.value || null })}>
            <option value="">默认</option>
            <option value="price_asc">价格升序</option>
            <option value="price_desc">价格降序</option>
          </select>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
        {data && data.total > data.size && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => goPage(page - 1)}>上一页</Button>
            <span className="text-sm text-muted-foreground">
              第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
            </span>
            <Button variant="outline" size="sm"
              disabled={(page + 1) * data.size >= data.total} onClick={() => goPage(page + 1)}>下一页</Button>
          </div>
        )}
      </section>
    </div>
  );
}
```

> 说明：`sort` 值语义以 `ProductQueryService.search` 支持为准（落地时核对 sort 支持的枚举；若不支持价格排序则去掉该下拉）。

- [ ] **Step 3: `ProductCard`**

```tsx
"use client";
import Link from "next/link";
import type { SpuResponse } from "@/types/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product }: { product: SpuResponse }) {
  const active = product.status === "active";
  const minPrice = product.skus.length
    ? Math.min(...product.skus.map((s) => Number(s.price)))
    : 0;
  return (
    <Link href={`/products/${product.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          {/* coverImage 或占位块 */}
          <CardTitle className="text-base">{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground line-clamp-2">{product.description}</CardContent>
        <CardFooter className="flex items-center justify-between">
          <span className="font-semibold text-primary">¥{minPrice.toFixed(2)} 起</span>
          <Badge variant={active ? "default" : "secondary"}>{active ? "在售" : "下架"}</Badge>
        </CardFooter>
      </Card>
    </Link>
  );
}
```

- [ ] **Step 4: 写失败测试 `product-card.test.tsx`**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/components/storefront/product-card";
import type { SpuResponse } from "@/types/api";

const spu: SpuResponse = {
  id: "s1", name: "测试商品", description: "描述", category: null, brand: null,
  status: "active", coverImage: null, images: [], specsTemplate: [], tags: [],
  skus: [{ id: "k1", specs: {}, price: "99.00", skuCode: "SKU1", barCode: null, weight: null, images: [], isActive: true, available: 0 }],
};

describe("ProductCard", () => {
  it("renders name, price and active badge", () => {
    render(<ProductCard product={spu} />);
    expect(screen.getByText("测试商品")).toBeInTheDocument();
    expect(screen.getByText(/¥99.00/)).toBeInTheDocument();
    expect(screen.getByText("在售")).toBeInTheDocument();
  });

  it("shows inactive badge for draft", () => {
    render(<ProductCard product={{ ...spu, status: "draft" }} />);
    expect(screen.getByText("下架")).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/components/storefront/product-card.test.tsx`
Expected: 失败（组件不存在）。

- [ ] **Step 6: 运行通过 + 手动冒烟**

Run: `cd frontend && npx vitest run`
Run: `cd frontend && npm run dev`（本机跑 compose + 网关后访问 `http://localhost:3000`，能看到 `scripts/test-data` 灌入的商品）
Expected: 列表/筛选/分页正常。

- [ ] **Step 7: Commit**

```bash
git add -A frontend/app/page.tsx frontend/app/'(storefront)'/layout.tsx frontend/app/'(storefront)'/page.tsx frontend/components/storefront/product-card.tsx frontend/__tests__/components/storefront/product-card.test.tsx
git commit -m "feat(frontend): 商城商品列表 + 搜索/筛选/分页 + ProductCard"
```

### Task 9: 商城商品详情页

**Files:**
- Create: `frontend/app/(storefront)/products/[id]/page.tsx`
- Create: `frontend/components/storefront/quantity-stepper.tsx`
- Test: `frontend/__tests__/components/storefront/quantity-stepper.test.tsx`

**Interfaces:**
- Consumes: `productsApi.detail(id)`、`inventoryApi.get(skuId)`（选中 SKU 懒加载）、`cartApi.add`、`SkuResponse`（`available` 恒 0，勿信）
- Produces: 详情页（规格选择 → 选中 SKU → 库存查询 → 可购数量上限 → 加购）

- [ ] **Step 1: `quantity-stepper.tsx`**

```tsx
"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function QuantityStepper({ value, onChange, min = 1, max = 999 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" onClick={() => onChange(clamp(value - 1))} disabled={value <= min}>−</Button>
      <Input className="w-20 text-center" value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || min))} inputMode="numeric" />
      <Button type="button" variant="outline" size="icon" onClick={() => onChange(clamp(value + 1))} disabled={value >= max}>+</Button>
    </div>
  );
}
```

- [ ] **Step 2: 详情页 `app/(storefront)/products/[id]/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { inventoryApi } from "@/lib/api/inventory";
import { cartApi } from "@/lib/api/cart";
import { useAuthStore } from "@/stores/auth";
import type { SkuResponse, SpuResponse } from "@/types/api";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [product, setProduct] = useState<SpuResponse | null>(null);
  const [selected, setSelected] = useState<SkuResponse | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productsApi.detail(id).then((r) => {
      setProduct(r.data);
      const first = r.data.skus.find((s) => s.isActive) ?? r.data.skus[0];
      setSelected(first ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // 选中 SKU 变化 -> 懒加载真实可售库存（product 的 available 恒 0）
  useEffect(() => {
    if (!selected) return;
    setAvailable(null);
    inventoryApi.get(selected.id).then((r) => setAvailable(r.data.available)).catch(() => setAvailable(0));
    setQty(1);
  }, [selected]);

  const addToCart = async () => {
    if (!selected) return;
    if (!isAuthenticated) { router.push(`/login?redirect=${encodeURIComponent(`/products/${id}`)}`); return; }
    try {
      await cartApi.add(selected.id, qty);
      toast.success("已加入购物车");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加购失败");
    }
  };

  if (loading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;
  if (!product) return <div className="container mx-auto p-6 text-muted-foreground">商品不存在</div>;

  const maxQty = available ?? 999;
  return (
    <div className="container mx-auto grid grid-cols-2 gap-8 p-6">
      <div className="space-y-2">
        {product.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.coverImage} alt={product.name}
            className="aspect-square w-full rounded-lg object-cover" />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">暂无图片</div>
        )}
        <div className="flex gap-2">
          {product.images.slice(0, 4).map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img} alt="" className="h-16 w-16 rounded border object-cover" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <Badge variant={product.status === "active" ? "default" : "secondary"}>
          {product.status === "active" ? "在售" : "已下架"}
        </Badge>
        <p className="text-muted-foreground">{product.description}</p>
        {/* 规格选择: 遍历 specsTemplate, 按选中组合匹配 sku; 简化为按 sku 列表单选 */}
        <div className="space-y-2">
          <h3 className="font-medium">规格</h3>
          {product.skus.filter((s) => s.isActive).map((s) => (
            <button key={s.id} onClick={() => setSelected(s)}
              className={`rounded border px-3 py-1 text-sm ${selected?.id === s.id ? "border-primary bg-primary/10" : ""}`}>
              {Object.values(s.specs).join(" / ") || s.skuCode}
            </button>
          ))}
        </div>
        <p className="text-xl font-semibold text-primary">
          ¥{selected ? Number(selected.price).toFixed(2) : "—"}
        </p>
        <p className="text-sm text-muted-foreground">
          {available === null ? "库存查询中…" : available > 0 ? `可售 ${available} 件` : "暂时缺货"}
        </p>
        {selected && available !== 0 && (
          <>
            <QuantityStepper value={qty} onChange={setQty} max={maxQty} />
            <Button onClick={addToCart}>加入购物车</Button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 写失败测试 `quantity-stepper.test.tsx`**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";

describe("QuantityStepper", () => {
  it("clamps to min/max", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} onChange={onChange} min={1} max={3} />);
    fireEvent.click(screen.getByText("+"));
    expect(onChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByText("−"));
    fireEvent.click(screen.getByText("−"));  // 已在 min, 按钮禁用
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/components/storefront/quantity-stepper.test.tsx`
Expected: 失败（组件不存在）。

- [ ] **Step 5: 运行通过 + 冒烟**

Run: `cd frontend && npx vitest run`
Expected: 通过。详情页可浏览、选中 SKU 显示真实可售库存、加购跳登录或成功 toast。

- [ ] **Step 6: Commit**

```bash
git add frontend/app/'(storefront)'/products/'[id]'/page.tsx frontend/components/storefront/quantity-stepper.tsx frontend/__tests__/components/storefront/quantity-stepper.test.tsx
git commit -m "feat(frontend): 商品详情 + 规格选择 + 库存懒加载 + 加购"
```

### Task 10: 购物车页

**Files:**
- Create: `frontend/app/(storefront)/cart/page.tsx`
- Create: `frontend/stores/cart.ts`（勾选/数量 UI 态）
- Create: `frontend/components/storefront/cart-line.tsx`
- Test: `frontend/__tests__/stores/cart.test.ts`

**Interfaces:**
- Consumes: `cartApi.list/add/remove`、`productsApi.detail`（每行商品名/价格）、`CartItem`（checked 仅作初始值）
- Produces: `useCartStore`（`checkedBySku: Record<string, boolean>`、`toggle/toggleAll`）、购物车页

- [ ] **Step 1: `stores/cart.ts`（勾选态 UI store）**

```ts
import { create } from "zustand";

interface CartUiState {
  checkedBySku: Record<string, boolean>;
  setInitial: (skuIds: string[], initialChecked: boolean[]) => void;
  toggle: (skuId: string) => void;
  toggleAll: (skuIds: string[], checked: boolean) => void;
}

export const useCartStore = create<CartUiState>((set) => ({
  checkedBySku: {},
  setInitial: (skuIds, initialChecked) =>
    set((s) => {
      const next = { ...s.checkedBySku };
      skuIds.forEach((id, i) => { next[id] = initialChecked[i]; });
      return { checkedBySku: next };
    }),
  toggle: (skuId) => set((s) => ({ checkedBySku: { ...s.checkedBySku, [skuId]: !s.checkedBySku[skuId] } })),
  toggleAll: (skuIds, checked) => {
    const next: Record<string, boolean> = {};
    skuIds.forEach((id) => { next[id] = checked; });
    set((s) => ({ checkedBySku: { ...s.checkedBySku, ...next } }));
  },
}));
```

- [ ] **Step 2: 购物车页 `app/(storefront)/cart/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cartApi } from "@/lib/api/cart";
import { productsApi } from "@/lib/api/products";
import { useCartStore } from "@/stores/cart";
import type { CartItem, SpuResponse } from "@/types/api";
import { CartLine } from "@/components/storefront/cart-line";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const router = useRouter();
  const { checkedBySku, setInitial, toggle, toggleAll } = useCartStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, SpuResponse>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cartApi.list().then(async (r) => {
      setItems(r.data);
      setInitial(r.data.map((c) => c.skuId), r.data.map((c) => c.checked));
      const map: Record<string, SpuResponse> = {};
      await Promise.all(r.data.map((c) => productsApi.detail(c.skuId).then((p) => { map[c.skuId] = p.data; }).catch(() => {})));
      setProducts(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [setInitial]);

  const checked = items.filter((c) => checkedBySku[c.skuId]);
  const total = checked.reduce((sum, c) => {
    const p = products[c.skuId];
    const sku = p?.skus.find((s) => s.id === c.skuId);
    return sum + (sku ? Number(sku.price) * c.quantity : 0);
  }, 0);

  const remove = async (skuId: string) => {
    await cartApi.remove(skuId);
    setItems((prev) => prev.filter((c) => c.skuId !== skuId));
  };

  const checkout = () => {
    if (checked.length === 0) { toast.info("请先勾选商品"); return; }
    router.push("/checkout");
  };

  if (loading) return <div className="container mx-auto p-6 text-muted-foreground">加载中…</div>;
  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">购物车</h1>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={items.length > 0 && checked.length === items.length}
          onChange={(e) => toggleAll(items.map((c) => c.skuId), e.target.checked)} />
        全选
      </label>
      {items.map((c) => (
        <CartLine key={c.skuId} item={c} product={products[c.skuId]} checked={!!checkedBySku[c.skuId]}
          onToggle={() => toggle(c.skuId)} onRemove={() => remove(c.skuId)} />
      ))}
      {items.length === 0 && <p className="text-muted-foreground">购物车是空的</p>}
      <div className="flex items-center justify-between border-t pt-4">
        <span>已选 {checked.length} 件，合计 <strong className="text-primary">¥{total.toFixed(2)}</strong></span>
        <Button onClick={checkout} disabled={checked.length === 0}>去结算</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `cart-line.tsx`**

```tsx
"use client";
import { cartApi } from "@/lib/api/cart";
import type { CartItem, SpuResponse } from "@/types/api";
import { Button } from "@/components/ui/button";

export function CartLine({ item, product, checked, onToggle, onRemove }: {
  item: CartItem; product?: SpuResponse; checked: boolean; onToggle: () => void; onRemove: () => void;
}) {
  const sku = product?.skus.find((s) => s.id === item.skuId);
  return (
    <div className="flex items-center gap-4 rounded border p-3">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <div className="flex-1">
        <p className="font-medium">{product?.name ?? "…"}</p>
        <p className="text-sm text-muted-foreground">
          {sku ? `${Object.values(sku.specs).join(" / ") || "默认规格"} · ¥${Number(sku.price).toFixed(2)} × ${item.quantity}` : ""}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>删除</Button>
    </div>
  );
}
```

- [ ] **Step 4: 写失败测试 `cart.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { useCartStore } from "@/stores/cart";

describe("cart store", () => {
  it("toggles checked state by sku", () => {
    useCartStore.setState({ checkedBySku: {} });
    useCartStore.getState().toggle("sku1");
    expect(useCartStore.getState().checkedBySku.sku1).toBe(true);
    useCartStore.getState().toggle("sku1");
    expect(useCartStore.getState().checkedBySku.sku1).toBe(false);
  });

  it("toggleAll sets all", () => {
    useCartStore.setState({ checkedBySku: {} });
    useCartStore.getState().toggleAll(["a", "b"], true);
    expect(useCartStore.getState().checkedBySku).toEqual({ a: true, b: true });
  });
});
```

- [ ] **Step 5: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/stores/cart.test.ts`
Expected: 失败（store 不存在）。

- [ ] **Step 6: 运行通过 + 冒烟**

Run: `cd frontend && npx vitest run`
Expected: 通过。勾选/改量/删除/合计正确。

- [ ] **Step 7: Commit**

```bash
git add frontend/app/'(storefront)'/cart/page.tsx frontend/stores/cart.ts frontend/components/storefront/cart-line.tsx frontend/__tests__/stores/cart.test.ts
git commit -m "feat(frontend): 购物车勾选/删除/合计"
```

### Task 11: 结算 + 下单 + 订单详情（支付/取消/退款）

**Files:**
- Create: `frontend/app/(storefront)/checkout/page.tsx`
- Create: `frontend/app/(storefront)/orders/[id]/page.tsx`
- Test: `frontend/__tests__/app/checkout.test.tsx`

**Interfaces:**
- Consumes: `useCartStore.checkedBySku`、`cartApi.list`、`ordersApi.create(lines)/get/pay/cancel/refund`、`CreateOrderRequest`（行数≤50、数量1-999、去重）、`OrderResponse.items`
- Produces: 结算页（提交 `lines` = 勾选行）、订单详情页（状态徽章 + 明细 + 按状态操作按钮）

- [ ] **Step 1: 结算页 `checkout/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cartApi } from "@/lib/api/cart";
import { ordersApi } from "@/lib/api/orders";
import { useCartStore } from "@/stores/cart";
import type { CartItem } from "@/types/api";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const router = useRouter();
  const { checkedBySku } = useCartStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cartApi.list().then((r) => setItems(r.data.filter((c) => checkedBySku[c.skuId])))
      .catch(() => setItems([]));
  }, [checkedBySku]);

  const submit = async () => {
    const lines = items.map((c) => ({ skuId: c.skuId, quantity: c.quantity }));
    if (lines.length === 0) { toast.info("没有可结算的商品"); return; }
    setSubmitting(true);
    try {
      const { data } = await ordersApi.create({ lines });
      toast.success("下单成功");
      router.push(`/orders/${data.id}`);
    } catch (e) {
      // 库存不足 -> 后端保留 CLOSED 订单, 前端提示
      toast.error(e instanceof Error ? e.message : "下单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">确认订单</h1>
      {items.map((c) => <p key={c.skuId} className="text-sm border-b py-2">SKU {c.skuId} × {c.quantity}</p>)}
      {items.length === 0 && <p className="text-muted-foreground">没有已勾选的商品</p>}
      <Button onClick={submit} disabled={submitting || items.length === 0}>
        {submitting ? "提交中…" : "提交订单"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: 订单详情 `orders/[id]/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ordersApi } from "@/lib/api/orders";
import type { OrderResponse, OrderStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "待支付", PAID: "已支付", SHIPPED: "已发货", COMPLETED: "已完成",
  CLOSED: "已关闭", REFUNDING: "退款中", REFUNDED: "已退款",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderResponse | null>(null);

  const load = useCallback(() => {
    ordersApi.get(id).then((r) => setOrder(r.data)).catch(() => setOrder(null));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
  };

  if (!order) return <div className="container mx-auto p-6 text-muted-foreground">订单不存在</div>;
  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">订单 {order.orderNo}</h1>
        <Badge>{STATUS_LABEL[order.status]}</Badge>
      </div>
      <div className="space-y-2">
        {order.items.map((it) => (
          <p key={it.skuId} className="text-sm border-b py-2">
            {it.productName} {it.skuSpec} × {it.quantity} — ¥{Number(it.subtotal).toFixed(2)}
          </p>
        ))}
      </div>
      <p className="font-semibold">合计 ¥{Number(order.totalAmount).toFixed(2)}</p>
      <div className="flex gap-2">
        {order.status === "PENDING_PAYMENT" && (
          <>
            <Button onClick={() => act(() => ordersApi.pay(id), "支付成功")}>支付</Button>
            <Button variant="outline" onClick={() => act(() => ordersApi.cancel(id), "已取消")}>取消订单</Button>
          </>
        )}
        {order.status === "PAID" && (
          <Button variant="outline" onClick={() => act(() => ordersApi.refund(id), "已发起退款")}>申请退款</Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 写失败测试 `checkout.test.tsx`（下单提交勾选行）**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckoutPage from "@/app/(storefront)/checkout/page";
import { cartApi } from "@/lib/api/cart";
import { ordersApi } from "@/lib/api/orders";
import { useCartStore } from "@/stores/cart";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { list: vi.fn() } }));
vi.mock("@/lib/api/orders", () => ({ ordersApi: { create: vi.fn() } }));

describe("CheckoutPage", () => {
  it("submits checked lines and navigates to order", async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: "o1" } });
    (ordersApi.create as unknown as ReturnType<typeof vi.fn>).mockImplementation(create);
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: "c1", skuId: "s1", quantity: 2, checked: true }],
    });
    useCartStore.setState({ checkedBySku: { s1: true } });

    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByText(/SKU s1 × 2/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("提交订单"));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ lines: [{ skuId: "s1", quantity: 2 }] }));
  });
});
```

- [ ] **Step 4: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/app/checkout.test.tsx`
Expected: 失败（页面不存在）。

- [ ] **Step 5: 运行通过 + 冒烟**

Run: `cd frontend && npx vitest run`
Expected: 通过。下单→跳详情→支付→状态变化正确。

- [ ] **Step 6: Commit**

```bash
git add frontend/app/'(storefront)'/checkout/page.tsx frontend/app/'(storefront)'/orders/'[id]'/page.tsx frontend/__tests__/app/checkout.test.tsx
git commit -m "feat(frontend): 结算下单 + 订单详情(支付/取消/退款)"
```

### Task 12: 我的订单列表

**Files:**
- Create: `frontend/app/(storefront)/orders/page.tsx`
- Create: `frontend/components/storefront/order-status-badge.tsx`
- Test: `frontend/__tests__/components/storefront/order-status-badge.test.tsx`

**Interfaces:**
- Consumes: `ordersApi.list(status?, page, size)`（`GET /api/v1/orders`，Task 1 提供）、`OrderResponse`
- Produces: 订单列表（状态过滤 tabs + 分页 + 链接详情）

- [ ] **Step 1: `order-status-badge.tsx`**

```tsx
import type { OrderStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";

const LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "待支付", PAID: "已支付", SHIPPED: "已发货", COMPLETED: "已完成",
  CLOSED: "已关闭", REFUNDING: "退款中", REFUNDED: "已退款",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant="outline">{LABEL[status]}</Badge>;
}
```

- [ ] **Step 2: 订单列表 `orders/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ordersApi } from "@/lib/api/orders";
import type { OrderResponse, OrderStatus, PageResponse } from "@/types/api";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const TABS: Array<{ key: OrderStatus | ""; label: string }> = [
  { key: "", label: "全部" },
  { key: "PENDING_PAYMENT", label: "待支付" },
  { key: "PAID", label: "已支付" },
  { key: "SHIPPED", label: "已发货" },
  { key: "COMPLETED", label: "已完成" },
  { key: "CLOSED", label: "已关闭" },
  { key: "REFUNDED", label: "已退款" },
];

export default function OrdersPage() {
  const [tab, setTab] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<OrderResponse> | null>(null);

  useEffect(() => { setPage(0); }, [tab]);
  useEffect(() => {
    ordersApi.list(tab === "" ? undefined : tab, page, 10)
      .then((r) => setData(r.data)).catch(() => setData(null));
  }, [tab, page]);

  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">我的订单</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-sm ${tab === t.key ? "border-primary bg-primary/10" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!data ? <Skeleton className="h-40" /> : (
        <div className="space-y-3">
          {data.items.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/50">
              <span>{o.orderNo}</span>
              <span className="font-semibold">¥{Number(o.totalAmount).toFixed(2)}</span>
              <OrderStatusBadge status={o.status} />
            </Link>
          ))}
          {data.items.length === 0 && <p className="text-muted-foreground">暂无订单</p>}
        </div>
      )}
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
          </span>
          <Button variant="outline" size="sm"
            disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 写失败测试 `order-status-badge.test.tsx`**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";

describe("OrderStatusBadge", () => {
  it("renders Chinese label", () => {
    render(<OrderStatusBadge status="PENDING_PAYMENT" />);
    expect(screen.getByText("待支付")).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/components/storefront/order-status-badge.test.tsx`
Expected: 失败（组件不存在）。

- [ ] **Step 5: 运行通过 + 冒烟**

Run: `cd frontend && npx vitest run`
Expected: 通过。状态过滤/分页正常。

- [ ] **Step 6: Commit**

```bash
git add frontend/app/'(storefront)'/orders/page.tsx frontend/components/storefront/order-status-badge.tsx frontend/__tests__/components/storefront/order-status-badge.test.tsx
git commit -m "feat(frontend): 我的订单列表 + 状态过滤"
```

### Task 13: 后台商品管理（列表 + 表单 + SKU 子表 + 启停）

**Files:**
- Create: `frontend/app/admin/page.tsx`（仪表板：重定向到商品）
- Create: `frontend/app/admin/products/page.tsx`
- Create: `frontend/app/admin/products/new/page.tsx`
- Create: `frontend/app/admin/products/[id]/page.tsx`
- Create: `frontend/components/admin/sku-editor.tsx`
- Create: `frontend/lib/schemas/spu.ts`（zod 对齐后端 `@Valid`）
- Test: `frontend/__tests__/lib/schemas/spu.test.ts`

**Interfaces:**
- Consumes: `productsApi.search/detail/create/update/changeStatus/remove`、`categoriesApi.tree`、`brandsApi.list`、`SpuCreateRequest`、`SpuStatus` 小写枚举
- Produces: 商品列表（搜索/状态筛选/分页 + 启停/删除按钮）、SPU 表单（基本信息 + SKU 动态子表）、zod schema

- [ ] **Step 1: `lib/schemas/spu.ts`**

```ts
import { z } from "zod";

export const skuSchema = z.object({
  specs: z.record(z.string(), z.string()),
  price: z.coerce.number().positive("价格必须大于 0"),
  skuCode: z.string().min(1, "SKU 编码必填"),
  barCode: z.string().optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const spuSchema = z.object({
  name: z.string().min(1, "商品名必填").max(200, "商品名最多 200 字"),
  description: z.string().optional().nullable(),
  categoryId: z.string().min(1, "请选择分类"),
  brandId: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  specsTemplate: z.array(z.object({ key: z.string().min(1), values: z.array(z.string()) })).default([]),
  tags: z.array(z.string()).default([]),
  skus: z.array(skuSchema).min(1, "至少一个 SKU"),
});

export type SpuFormValues = z.infer<typeof spuSchema>;
```

- [ ] **Step 2: 商品列表 `admin/products/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import type { ProductSearchParams } from "@/lib/api/products";
import type { PageResponse, SpuResponse, SpuStatus } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS: Array<{ key: SpuStatus | ""; label: string }> = [
  { key: "", label: "全部" }, { key: "active", label: "在售" },
  { key: "draft", label: "草稿" }, { key: "inactive", label: "下架" },
];
const STATUS_LABEL: Record<SpuStatus, string> = { draft: "草稿", active: "在售", inactive: "下架" };

function ProductListContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Number(sp.get("page") ?? 0);
  const q = sp.get("q") ?? "";
  const status = (sp.get("status") ?? "") as SpuStatus | "";
  const [data, setData] = useState<PageResponse<SpuResponse> | null>(null);

  useEffect(() => {
    // 注: 若 ProductQueryService.search 不支持 status 过滤, 后端返回全量, 此处按当前页客户端过滤
    const params: ProductSearchParams & { status?: SpuStatus } = {
      q: q || undefined, page, size: 10, ...(status ? { status } : {}),
    };
    productsApi.search(params).then((r) => setData(r.data)).catch(() => setData(null));
  }, [sp]);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.set("page", "0");
    router.push(`/admin/products?${next.toString()}`);
  };
  const goPage = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set("page", String(p));
    router.push(`/admin/products?${next.toString()}`);
  };

  const toggle = async (p: SpuResponse) => {
    const target: SpuStatus = p.status === "active" ? "inactive" : "active";
    await productsApi.changeStatus(p.id, target);
    toast.success(target === "active" ? "已上架" : "已下架");
    setData((d) => d ? { ...d, items: d.items.map((x) => x.id === p.id ? { ...x, status: target } : x) } : d);
  };
  const remove = async (p: SpuResponse) => {
    if (!window.confirm(`确定删除「${p.name}」？`)) return;
    await productsApi.remove(p.id);
    toast.success("已删除");
    go({});
  };

  const shown = status ? (data?.items.filter((p) => p.status === status) ?? []) : (data?.items ?? []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input defaultValue={q} placeholder="搜索商品名" className="max-w-xs"
          onKeyDown={(e) => { if (e.key === "Enter") go({ q: (e.target as HTMLInputElement).value || null }); }} />
        <select value={status} onChange={(e) => go({ status: e.target.value || null })}
          className="rounded border px-2 py-1 text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <Button asChild className="ml-auto"><Link href="/admin/products/new">新建商品</Link></Button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2">名称</th><th>分类</th><th>状态</th><th className="text-right">操作</th>
        </tr></thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2"><Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link></td>
              <td>{p.category?.name ?? "—"}</td>
              <td><Badge variant="outline">{STATUS_LABEL[p.status]}</Badge></td>
              <td className="space-x-2 text-right">
                <Button variant="outline" size="sm" onClick={() => toggle(p)}>
                  {p.status === "active" ? "下架" : "上架"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(p)}>删除</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {shown.length === 0 && <p className="text-muted-foreground">暂无商品</p>}
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => goPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
          </span>
          <Button variant="outline" size="sm"
            disabled={(page + 1) * data.size >= data.total} onClick={() => goPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <PermissionGuard code="product:manage">
      <h1 className="mb-4 text-xl font-semibold">商品管理</h1>
      <ProductListContent />
    </PermissionGuard>
  );
}
```

- [ ] **Step 3: SPU 表单 `products/new/page.tsx` 与 `products/[id]/page.tsx`**

共用 `SpuForm`（放 `components/admin/spu-form.tsx`）：react-hook-form + zodResolver(spuSchema)；字段：name、categoryId（select 来自 `categoriesApi.tree`）、brandId（select 来自 `brandsApi.list`）、coverImage、images（逗号分隔输入）、specsTemplate（key/values 动态行）、tags（逗号分隔）、SKU 子表（`sku-editor` 动态行：specs 键值对、price、skuCode、barCode、weight、isActive）。编辑模式加载 `productsApi.detail(id)` 预填；提交 `create` 或 `update(id, req)`。`[id]/page.tsx` 额外显示 SKU 列表与状态切换按钮。

- [ ] **Step 4: `components/admin/sku-editor.tsx`**

受控组件：`value: SkuRow[]`、`onChange`；每行 = specs（动态 key/value 行）、price、skuCode、barCode、weight、isActive checkbox、删除按钮；底部"添加 SKU"按钮。类型 `SkuRow = z.infer<typeof skuSchema>`。

- [ ] **Step 5: 写失败测试 `lib/schemas/spu.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { spuSchema, skuSchema } from "@/lib/schemas/spu";

describe("spu schema", () => {
  it("validates a valid spu", () => {
    const r = spuSchema.safeParse({
      name: "商品", categoryId: "uuid", skus: [{ specs: {}, price: 10, skuCode: "K1", isActive: true }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty name and no sku", () => {
    expect(spuSchema.safeParse({ name: "", categoryId: "x", skus: [] }).success).toBe(false);
  });

  it("rejects non-positive price", () => {
    expect(skuSchema.safeParse({ specs: {}, price: 0, skuCode: "K1", isActive: true }).success).toBe(false);
  });
});
```

- [ ] **Step 6: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/lib/schemas/spu.test.ts`
Expected: 失败（schema 不存在）。

- [ ] **Step 7: 运行通过 + 冒烟**

Run: `cd frontend && npx vitest run`
Expected: 通过。列表可搜/筛/启停/删除；表单新建/编辑可用。

- [ ] **Step 8: Commit**

```bash
git add frontend/app/'admin'/page.tsx frontend/app/'admin'/products/page.tsx frontend/app/'admin'/products/new/page.tsx frontend/app/'admin'/products/'[id]'/page.tsx frontend/components/admin/sku-editor.tsx frontend/components/admin/spu-form.tsx frontend/lib/schemas/spu.ts frontend/__tests__/lib/schemas/spu.test.ts
git commit -m "feat(frontend): 后台商品管理(列表/表单/SKU/启停)"
```

### Task 14: 后台分类树 + 品牌管理 + 库存查询

**Files:**
- Create: `frontend/app/admin/categories/page.tsx`
- Create: `frontend/components/admin/category-tree.tsx`
- Create: `frontend/app/admin/brands/page.tsx`
- Create: `frontend/app/admin/inventory/page.tsx`
- Create: `frontend/lib/schemas/admin.ts`（CategoryRequest/BrandRequest zod）
- Test: `frontend/__tests__/components/admin/category-tree.test.tsx`

**Interfaces:**
- Consumes: `categoriesApi.tree/create/update/remove`、`brandsApi.list/create/update/remove`、`inventoryApi.get`、`CategoryRequest`（name/slug 1-100）、`BrandRequest`（name 1-100）
- Produces: 分类树管理页、品牌分页 CRUD 页、库存查询页（均 `PermissionGuard` 包裹对应 code）

- [ ] **Step 1: `lib/schemas/admin.ts`**

```ts
import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1).max(100, "分类名最多 100 字"),
  slug: z.string().min(1).max(100),
  parentId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  icon: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;

export const brandSchema = z.object({
  name: z.string().min(1).max(100, "品牌名最多 100 字"),
  logoUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});
export type BrandFormValues = z.infer<typeof brandSchema>;
```

- [ ] **Step 2: 分类树 `components/admin/category-tree.tsx`**

```tsx
"use client";
import type { CategoryResponse } from "@/types/api";
import { Button } from "@/components/ui/button";

export function CategoryTree({ nodes, onEdit, onAdd, onRemove }: {
  nodes: CategoryResponse[];
  onEdit: (c: CategoryResponse) => void;
  onAdd: (c: CategoryResponse) => void;
  onRemove: (c: CategoryResponse) => void;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((c) => (
        <li key={c.id}>
          <div className="flex items-center gap-2 rounded border px-3 py-2">
            <span className="flex-1">
              {c.name}
              <span className="ml-2 text-xs text-muted-foreground">slug: {c.slug} · sort: {c.sortOrder}</span>
              {!c.isActive && <span className="ml-2 text-xs text-muted-foreground">(停用)</span>}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onAdd(c)}>加子级</Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>编辑</Button>
            <Button variant="ghost" size="sm" onClick={() => onRemove(c)}>删除</Button>
          </div>
          {c.children.length > 0 && (
            <div className="ml-6 mt-1"><CategoryTree nodes={c.children} onEdit={onEdit} onAdd={onAdd} onRemove={onRemove} /></div>
          )}
        </li>
      ))}
    </ul>
  );
}
```

分类页 `categories/page.tsx`（内联 `CategoryForm`，RHF+zod，父级 select 可选，含"新建顶级"按钮）：

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { categoriesApi } from "@/lib/api/categories";
import type { CategoryResponse } from "@/types/api";
import { categorySchema, type CategoryFormValues } from "@/lib/schemas/admin";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { CategoryTree } from "@/components/admin/category-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CategoriesContent() {
  const [tree, setTree] = useState<CategoryResponse[]>([]);
  const [editing, setEditing] = useState<CategoryResponse | null>(null);
  const [addingParent, setAddingParent] = useState<CategoryResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", slug: "", sortOrder: 0, isActive: true },
  });

  const load = useCallback(() => {
    categoriesApi.tree().then((r) => setTree(r.data)).catch(() => setTree([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = (parent: CategoryResponse | null) => {
    setEditing(null); setAddingParent(parent); setShowForm(true);
    reset({ name: "", slug: "", parentId: parent?.id ?? null, sortOrder: 0, isActive: true });
  };
  const openEdit = (c: CategoryResponse) => {
    setEditing(c); setAddingParent(null); setShowForm(true);
    reset({ name: c.name, slug: c.slug, parentId: c.parentId, sortOrder: c.sortOrder, isActive: c.isActive });
  };

  const save = async (values: CategoryFormValues) => {
    try {
      if (editing) await categoriesApi.update(editing.id, values);
      else await categoriesApi.create(values);
      toast.success("已保存"); setShowForm(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
  };

  const remove = async (c: CategoryResponse) => {
    if (!window.confirm(`确定删除「${c.name}」？`)) return;
    try { await categoriesApi.remove(c.id); toast.success("已删除"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "删除失败"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">顶级分类 {tree.length} 个（含子级递归）</p>
        <Button onClick={() => openCreate(null)}>新建顶级分类</Button>
      </div>
      <CategoryTree nodes={tree} onEdit={openEdit} onAdd={(c) => openCreate(c)} onRemove={remove} />
      {showForm && (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-base">
            {editing ? "编辑分类" : addingParent ? `在「${addingParent.name}」下添加子级` : "新建顶级分类"}
          </CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(save)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">名称</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="slug">slug</Label>
                <Input id="slug" {...register("slug")} />
                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sortOrder">排序</Label>
                <Input id="sortOrder" type="number" {...register("sortOrder")} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("isActive")} /> 启用
              </label>
              <div className="flex gap-2">
                <Button type="submit">保存</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <PermissionGuard code="product:manage">
      <h1 className="mb-4 text-xl font-semibold">分类管理</h1>
      <CategoriesContent />
    </PermissionGuard>
  );
}
```

- [ ] **Step 3: 品牌 `brands/page.tsx`（分页表格 + 新建/编辑 dialog + 删除）**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { brandsApi } from "@/lib/api/brands";
import type { BrandResponse, PageResponse } from "@/types/api";
import { brandSchema, type BrandFormValues } from "@/lib/schemas/admin";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EMPTY: BrandFormValues = { name: "", logoUrl: "", description: "", sortOrder: 0 };

function BrandsContent() {
  const [data, setData] = useState<PageResponse<BrandResponse> | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<BrandResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema), defaultValues: EMPTY,
  });

  const load = useCallback(() => {
    brandsApi.list(page, 10).then((r) => setData(r.data)).catch(() => setData(null));
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setShowForm(true); reset(EMPTY); };
  const openEdit = (b: BrandResponse) => {
    setEditing(b); setShowForm(true);
    reset({ name: b.name, logoUrl: b.logoUrl ?? "", description: b.description ?? "", sortOrder: b.sortOrder });
  };
  const save = async (values: BrandFormValues) => {
    const payload = { ...values, logoUrl: values.logoUrl || null, description: values.description || null };
    try {
      if (editing) await brandsApi.update(editing.id, payload);
      else await brandsApi.create(payload);
      toast.success("已保存"); setShowForm(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
  };
  const remove = async (b: BrandResponse) => {
    if (!window.confirm(`确定删除「${b.name}」？`)) return;
    try { await brandsApi.remove(b.id); toast.success("已删除"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "删除失败"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openCreate}>新建品牌</Button></div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2">名称</th><th>描述</th><th>排序</th><th className="text-right">操作</th>
        </tr></thead>
        <tbody>
          {(data?.items ?? []).map((b) => (
            <tr key={b.id} className="border-b">
              <td className="py-2">{b.name}</td>
              <td className="text-muted-foreground">{b.description ?? "—"}</td>
              <td>{b.sortOrder}</td>
              <td className="space-x-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>编辑</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(b)}>删除</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页</span>
          <Button variant="outline" size="sm"
            disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
      {showForm && (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-base">{editing ? "编辑品牌" : "新建品牌"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(save)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="bname">名称</Label>
                <Input id="bname" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="logo">Logo URL</Label>
                <Input id="logo" {...register("logoUrl")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="desc">描述</Label>
                <Input id="desc" {...register("description")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sort">排序</Label>
                <Input id="sort" type="number" {...register("sortOrder")} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">保存</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BrandsPage() {
  return (
    <PermissionGuard code="product:manage">
      <h1 className="mb-4 text-xl font-semibold">品牌管理</h1>
      <BrandsContent />
    </PermissionGuard>
  );
}
```

- [ ] **Step 4: 库存查询 `inventory/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { inventoryApi } from "@/lib/api/inventory";
import type { InventoryStock } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function InventoryContent() {
  const [skuId, setSkuId] = useState("");
  const [stock, setStock] = useState<InventoryStock | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = async () => {
    if (!skuId.trim()) return;
    setError(null);
    try { setStock((await inventoryApi.get(skuId.trim())).data); }
    catch { setStock(null); setError("查询失败，SKU 不存在或库存服务不可达"); }
  };

  return (
    <div className="max-w-md space-y-4">
      <div className="flex gap-2">
        <Input placeholder="输入 SKU id" value={skuId} onChange={(e) => setSkuId(e.target.value)} />
        <Button onClick={query}>查询</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {stock && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border p-3 text-center">
            <p className="text-2xl font-semibold">{stock.quantity}</p>
            <p className="text-sm text-muted-foreground">总库存</p>
          </div>
          <div className="rounded border p-3 text-center">
            <p className="text-2xl font-semibold">{stock.frozen}</p>
            <p className="text-sm text-muted-foreground">冻结</p>
          </div>
          <div className="rounded border p-3 text-center">
            <p className="text-2xl font-semibold">{stock.available}</p>
            <p className="text-sm text-muted-foreground">可售</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <PermissionGuard code="inventory:manage">
      <h1 className="mb-4 text-xl font-semibold">库存查询</h1>
      <InventoryContent />
    </PermissionGuard>
  );
}
```

- [ ] **Step 5: 写失败测试 `category-tree.test.tsx`**

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryTree } from "@/components/admin/category-tree";
import type { CategoryResponse } from "@/types/api";

const tree: CategoryResponse[] = [
  { id: "a", name: "父类", slug: "p", parentId: null, sortOrder: 0, icon: null, isActive: true,
    children: [{ id: "b", name: "子类", slug: "c", parentId: "a", sortOrder: 0, icon: null, isActive: true, children: [] }] },
];

describe("CategoryTree", () => {
  it("renders nested categories", () => {
    render(<CategoryTree nodes={tree} onEdit={() => {}} onAdd={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("父类")).toBeInTheDocument();
    expect(screen.getByText("子类")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/components/admin/category-tree.test.tsx`
Expected: 失败（组件不存在）。

- [ ] **Step 7: 运行通过 + 冒烟**

Run: `cd frontend && npx vitest run`
Expected: 通过。分类增删改、品牌 CRUD、库存查询可用。

- [ ] **Step 8: Commit**

```bash
git add frontend/app/'admin'/categories/page.tsx frontend/components/admin/category-tree.tsx frontend/app/'admin'/brands/page.tsx frontend/app/'admin'/inventory/page.tsx frontend/lib/schemas/admin.ts frontend/__tests__/components/admin/category-tree.test.tsx
git commit -m "feat(frontend): 后台分类树/品牌/库存查询"
```

### Task 15: 后台订单管理（内部端点 + 发货/退款）

**Files:**
- Create: `frontend/app/admin/orders/page.tsx`
- Create: `frontend/app/admin/orders/[id]/page.tsx`
- Create: `frontend/components/admin/order-table.tsx`
- Test: `frontend/__tests__/lib/api/orders.test.ts`

**Interfaces:**
- Consumes: `adminOrdersApi.list/get/ship/refund`（`internalApi`，Task 6）、`OrderResponse.items`、`STATUS_LABEL`（Task 11 定义，可提取复用）
- Produces: 全量订单列表（状态过滤 + 分页）、订单详情（发货/退款按钮）

- [ ] **Step 1: 订单列表 `admin/orders/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { adminOrdersApi } from "@/lib/api/orders";
import type { OrderResponse, OrderStatus, PageResponse } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { OrderTable } from "@/components/admin/order-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TABS: Array<{ key: OrderStatus | ""; label: string }> = [
  { key: "", label: "全部" }, { key: "PENDING_PAYMENT", label: "待支付" }, { key: "PAID", label: "已支付" },
  { key: "SHIPPED", label: "已发货" }, { key: "COMPLETED", label: "已完成" },
  { key: "CLOSED", label: "已关闭" }, { key: "REFUNDED", label: "已退款" },
];

function OrderManageContent() {
  const [tab, setTab] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<OrderResponse> | null>(null);

  useEffect(() => { setPage(0); }, [tab]);
  useEffect(() => {
    adminOrdersApi.list(tab === "" ? undefined : tab, page, 10)
      .then((r) => setData(r.data)).catch(() => setData(null));
  }, [tab, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-sm ${tab === t.key ? "border-primary bg-primary/10" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!data ? <Skeleton className="h-40" /> : (
        <>
          <OrderTable rows={data.items}
            onRowClick={(o) => { window.location.href = `/admin/orders/${o.id}`; }} />
          {data.items.length === 0 && <p className="text-muted-foreground">暂无订单</p>}
          {data.total > data.size && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="text-sm text-muted-foreground">
                第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
              </span>
              <Button variant="outline" size="sm"
                disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <PermissionGuard code="order:manage">
      <h1 className="mb-4 text-xl font-semibold">订单管理</h1>
      <OrderManageContent />
    </PermissionGuard>
  );
}
```

- [ ] **Step 2: 订单详情 `admin/orders/[id]/page.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { adminOrdersApi } from "@/lib/api/orders";
import type { OrderResponse } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { Button } from "@/components/ui/button";

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderResponse | null>(null);

  const load = useCallback(() => {
    adminOrdersApi.get(id).then((r) => setOrder(r.data)).catch(() => setOrder(null));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
  };

  if (!order) return <p className="text-muted-foreground">订单不存在</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">订单 {order.orderNo}</h2>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="space-y-2">
        {order.items.map((it) => (
          <p key={it.skuId} className="border-b py-2 text-sm">
            {it.productName} {it.skuSpec} × {it.quantity} — ¥{Number(it.subtotal).toFixed(2)}
          </p>
        ))}
      </div>
      <p className="font-semibold">合计 ¥{Number(order.totalAmount).toFixed(2)}</p>
      {order.status === "PAID" && (
        <div className="flex gap-2">
          <Button onClick={() => act(() => adminOrdersApi.ship(order.id), "已发货")}>发货</Button>
          <Button variant="outline" onClick={() => act(() => adminOrdersApi.refund(order.id), "已退款")}>退款</Button>
        </div>
      )}
    </div>
  );
}

export default function AdminOrderDetailPage() {
  return (
    <PermissionGuard code="order:manage">
      <h1 className="mb-4 text-xl font-semibold">订单详情</h1>
      <OrderDetailContent />
    </PermissionGuard>
  );
}
```

- [ ] **Step 3: `order-table.tsx`**

```tsx
"use client";
import type { OrderResponse } from "@/types/api";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";

export function OrderTable({ rows, onRowClick }: {
  rows: OrderResponse[]; onRowClick: (o: OrderResponse) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b text-left text-muted-foreground">
        <th className="py-2">订单号</th><th>状态</th><th className="text-right">金额</th>
      </tr></thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.id} className="cursor-pointer border-b hover:bg-muted/50" onClick={() => onRowClick(o)}>
            <td className="py-2">{o.orderNo}</td>
            <td><OrderStatusBadge status={o.status} /></td>
            <td className="text-right">¥{Number(o.totalAmount).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: 写失败测试 `__tests__/lib/api/orders.test.ts`**

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { internalApi } from "@/lib/api/client";
import { adminOrdersApi } from "@/lib/api/orders";

vi.mock("@/lib/api/client", () => ({ internalApi: { get: vi.fn(), post: vi.fn() } }));

afterEach(() => { vi.clearAllMocks(); });

describe("adminOrdersApi", () => {
  it("lists via internal endpoint", async () => {
    (internalApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });
    await adminOrdersApi.list("PAID", 1, 20);
    expect(internalApi.get).toHaveBeenCalledWith("/orders", { params: { status: "PAID", page: 1, size: 20 } });
  });

  it("ships via internal endpoint", async () => {
    (internalApi.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await adminOrdersApi.ship("o1");
    expect(internalApi.post).toHaveBeenCalledWith("/orders/o1/ship");
  });
});
```

- [ ] **Step 5: 运行确认失败**

Run: `cd frontend && npx vitest run __tests__/lib/api/orders.test.ts`
Expected: 失败（`adminOrdersApi` 未导出或结构不符）。

- [ ] **Step 6: 运行通过 + 冒烟**

Run: `cd frontend && npx vitest run`
Expected: 通过。管理员可看全量订单并对 PAID 单发货/退款。

- [ ] **Step 7: Commit**

```bash
git add frontend/app/'admin'/orders/page.tsx frontend/app/'admin'/orders/'[id]'/page.tsx frontend/components/admin/order-table.tsx frontend/__tests__/lib/api/orders.test.ts
git commit -m "feat(frontend): 后台订单管理(全量列表/发货/退款)"
```

### Task 16: 测试补全 + 覆盖率 + e2e 关键闭环

**Files:**
- Create: `frontend/e2e/storefront.spec.ts`
- Create: `frontend/e2e/admin.spec.ts`
- Create: `frontend/playwright.config.ts`（已含 webServer 启动）
- Modify: 补充各页组件测试至覆盖率 ≥80%

**Interfaces:**
- Consumes: 全部页面/组件、`scripts/test-data`（测试数据）、根 compose（网关+三服务+user-service）
- Produces: 单测覆盖率 ≥80%、playwright e2e 通过

- [ ] **Step 1: 补组件/页面测试至覆盖率 ≥80%**

对未覆盖分支（购物车页、结算页、订单列表、后台列表/表单、登录页、`(storefront)/layout` 顶栏、`admin/layout` 守卫）逐一补 RTL 测试（模式参照前序 Task 的测试）。Run: `cd frontend && npx vitest run --coverage` 直到 lines/functions/branches/statements ≥80%。

- [ ] **Step 2: e2e 商城闭环 `e2e/storefront.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("浏览→加购→下单→支付→我的订单", async ({ page }) => {
  // 前置: 本机已 docker compose up（三服务+网关+user-service）+ load-test-data.sh
  await page.goto("/");
  await expect(page.locator("h1, [data-testid=product-name]").first()).toBeVisible();
  await page.locator("a[href^='/products/']").first().click();
  await page.getByRole("button", { name: "加入购物车" }).click();   // 未登录 → 跳登录
  await page.waitForURL(/\/login/);
  await page.getByLabel("邮箱").fill("admin@example.com");           // 以测试数据中的用户登录
  await page.getByLabel("密码").fill("password");
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/products\//);
  await page.getByRole("button", { name: "加入购物车" }).click();
  await page.goto("/cart");
  await page.getByRole("button", { name: "去结算" }).click();
  await page.getByRole("button", { name: "提交订单" }).click();
  await page.waitForURL(/\/orders\//);
  await page.getByRole("button", { name: "支付" }).click();
  await expect(page.getByText("已支付")).toBeVisible();
});
```

- [ ] **Step 3: e2e 后台闭环 `e2e/admin.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test("后台登录→商品列表→发货", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForURL(/\/login/);
  await page.getByLabel("邮箱").fill("admin@example.com");
  await page.getByLabel("密码").fill("password");
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/admin/);
  await expect(page.getByText("商品管理")).toBeVisible();
  await page.goto("/admin/orders");
  await expect(page.getByText(/订单号|NO/).first()).toBeVisible();
});
```

> 说明：e2e 的登录账号与数据依赖 `scripts/test-data` 与 user-service 种子账号；若测试数据中无该账号，Task 4 的种子脚本与 user-service 种子数据需补充一个带 `order:manage` 的管理员账号（落地时在 user-service 中确认/创建，并写入本 e2e 的凭据）。

- [ ] **Step 4: 运行 e2e**

Run: `cd frontend && npx playwright install && npx playwright test`
Expected: 两个闭环通过（依赖本机 compose + 网关 + 测试数据已就绪）。

- [ ] **Step 5: 运行全部前端测试 + 构建**

Run: `cd frontend && npx vitest run --coverage && npm run build`
Expected: 覆盖率 ≥80%，构建成功。

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/storefront.spec.ts frontend/e2e/admin.spec.ts frontend/__tests__ frontend/playwright.config.ts
git commit -m "test(frontend): 覆盖率≥80% 补全 + 商城/后台 e2e 闭环"
```

---

## 全局收尾（Phase A 与 Phase B 之间执行验证）

- Phase A 完成后：`cd order-service && mvn -q test`、`cd gateway && mvn -q test` 全绿；`docker compose up -d --build` 后跑 `scripts/test-data/load-test-data.sh` 与 `python scripts/seed_module_permissions.py`，用 curl 验证：`GET :8080/api/v1/products/search`（匿名）、`GET :8080/api/v1/orders?page=0&size=5`（带 Bearer）、`GET :8080/internal/orders`（管理员 Bearer）、`POST :8080/internal/orders/{id}/ship`（管理员 Bearer），并验证匿名访问 `POST :8080/api/v1/products` 返回 401。
- Phase B 完成后：全栈冒烟（浏览→下单→发货）通过后提交整个 Phase B 收尾 commit。
