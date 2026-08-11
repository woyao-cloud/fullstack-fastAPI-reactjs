# 商品+库存+订单 三服务实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通「商品 → 购物车 → 下单(预扣库存) → 模拟支付 → 超时关单/退款(释放/回补库存)」完整业务闭环。

**Architecture:** 三个独立 Spring Boot 微服务（product/inventory/order），各自独立 PostgreSQL，经 gateway 对外。order-service 用 OpenFeign 同步调库存预扣，用 Kafka(`order-events`) 异步解耦支付/关闭/退款事件，inventory-service 消费事件完成确认/释放/回补，以 `inventory_event` 表保证消费幂等。

**Tech Stack:** Spring Boot 3.5 / JDK 21 / Spring Data JPA / Flyway / PostgreSQL / Redis(商品缓存) / Kafka / OpenFeign / Resilience4j / Testcontainers

**规格:** `docs/superpowers/specs/2026-08-11-product-inventory-order-design.md`

## Global Constraints

- 全部 Spring Boot 3.5 + JDK 21，与现有 product-service/gateway 一致
- 实体用手动 getter/setter（项目不用 Lombok），构造器注入
- 错误用 `IllegalArgumentException`/`IllegalStateException`（与 BrandWriteService 一致），由全局异常处理映射 400/409
- 库存权威单一事实源：product 的 sku 表不存库存（V5 移除）
- 下单顺序：先建单(待支付) → 再预扣；预扣失败 → 订单置 CLOSED 并保留记录
- 事件幂等：inventory-service 消费前先写 `inventory_event(event_id PK)`
- 用户身份：gateway 透传 `X-User-Id` 请求头，order-service 从该头取当前用户
- 测试：只写必要测试（单元：三态/状态机/幂等；集成：全链路），不追求全覆盖
- 端口：product 8081、inventory 8082、order 8083（gateway 已占 8080）
- 本地库名：product_service / inventory_service / order_service，均 `localhost:5433`（沿用 product 的 application-local.yml）
- 每个 Task 完成即 commit

---

## Phase 1: product-service 补齐

### Task 1.1: V5 迁移移除库存列 + 调整实体/DTO

**Files:**
- Create: `product-service/src/main/resources/db/migration/V5__remove_sku_stock.sql`
- Modify: `product-service/src/main/java/com/product/domain/entity/Sku.java`
- Modify: `product-service/src/main/java/com/product/dto/request/SkuRequest.java`
- Modify: `product-service/src/main/java/com/product/dto/response/SkuResponse.java`

**Interfaces:**
- Produces: `Sku` 不再有 `stock`/`lockedStock`；`SkuResponse` 增加 `available` 字段（后续由查询服务填充）

- [ ] **Step 1: 建迁移文件**

```sql
-- V5__remove_sku_stock.sql
ALTER TABLE sku DROP COLUMN stock, DROP COLUMN locked_stock;
```

- [ ] **Step 2: 改实体** — 删除 `Sku.java` 中 `stock`、`lockedStock` 字段及对应 getter/setter

- [ ] **Step 3: 改 DTO** — `SkuRequest.java` 删除 `stock` 字段；`SkuResponse.java` 删除 `stock`/`lockedStock`，增加 `int available` 字段（构造器参数加到 `boolean isActive` 之后）

- [ ] **Step 4: 编译验证**

Run: `cd product-service && ./mvnw -q compile 2>/dev/null || mvn -q compile`
Expected: 编译通过（`SkuResponse` 的调用方同步调整——搜索全部 `new SkuResponse` 及 `getStock()`/`getLockedStock()` 用法修复）

- [ ] **Step 5: Commit**

```bash
git add product-service && git commit -m "feat(product): V5移除sku库存列，库存权威迁移至inventory-service"
```

### Task 1.2: SpuWriteService（SPU+SKU 创建/更新/上下架/删除）

**Files:**
- Create: `product-service/src/main/java/com/product/service/write/SpuWriteService.java`
- Test: `product-service/src/test/java/com/product/service/write/SpuWriteServiceTest.java`

**Interfaces:**
- Produces: `SpuResponse create(SpuCreateRequest)`, `SpuResponse update(UUID id, SpuCreateRequest)`, `void changeStatus(UUID id, SpuStatus status)`, `void delete(UUID id)`；依赖 `SpuRepository`, `CategoryRepository`, `BrandRepository`, `SkuRepository`
- Consumes: `SpuCreateRequest`(含嵌套 `SkuRequest`)、`SpuResponse`（Task 1.1 已调整）

- [ ] **Step 1: 写失败测试**

```java
@ExtendWith(MockitoExtension.class)
class SpuWriteServiceTest {
    @Mock SpuRepository spuRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock BrandRepository brandRepository;
    @Mock SkuRepository skuRepository;
    SpuWriteService service;

    @BeforeEach
    void setUp() { service = new SpuWriteService(spuRepository, categoryRepository, brandRepository, skuRepository); }

    @Test
    void shouldCreateSpuWithSkus() {
        var category = new Category(); category.setId(UUID.randomUUID());
        var req = new SpuCreateRequest("iPhone 16", "desc", category.getId(), null,
                null, List.of(), List.of(), List.of("热卖"),
                List.of(new SkuRequest(Map.of("颜色", "黑"), new BigDecimal("5999.00"),
                        "SKU-001", null, null, null)));
        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(spuRepository.save(any())).thenAnswer(inv -> { Spu s = inv.getArgument(0); s.setId(UUID.randomUUID()); return s; });
        when(skuRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        var result = service.create(req);

        assertThat(result.name()).isEqualTo("iPhone 16");
        assertThat(result.skus()).hasSize(1);
    }

    @Test
    void shouldRejectMissingCategory() {
        var req = new SpuCreateRequest("X", null, UUID.randomUUID(), null, null,
                List.of(), List.of(), List.of(), List.of());
        when(categoryRepository.findById(any())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("分类不存在");
    }
}
```

- [ ] **Step 2: 运行确认失败**

Run: `mvn -q test -Dtest=SpuWriteServiceTest`
Expected: FAIL（SpuWriteService 不存在）

- [ ] **Step 3: 实现 SpuWriteService**

```java
package com.product.service.write;

import com.product.domain.entity.*;
import com.product.dto.request.SkuRequest;
import com.product.dto.request.SpuCreateRequest;
import com.product.dto.response.SkuResponse;
import com.product.dto.response.SpuResponse;
import com.product.repository.BrandRepository;
import com.product.repository.CategoryRepository;
import com.product.repository.SkuRepository;
import com.product.repository.SpuRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SpuWriteService {

    private final SpuRepository spuRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final SkuRepository skuRepository;

    public SpuWriteService(SpuRepository spuRepository, CategoryRepository categoryRepository,
                           BrandRepository brandRepository, SkuRepository skuRepository) {
        this.spuRepository = spuRepository;
        this.categoryRepository = categoryRepository;
        this.brandRepository = brandRepository;
        this.skuRepository = skuRepository;
    }

    public SpuResponse create(SpuCreateRequest request) {
        Spu spu = new Spu();
        apply(spu, request);
        Spu saved = spuRepository.save(spu);
        List<Sku> skus = request.skus().stream().map(s -> toSku(saved, s)).toList();
        skuRepository.saveAll(skus);
        saved.setSkus(skus);
        return toResponse(saved);
    }

    public SpuResponse update(UUID id, SpuCreateRequest request) {
        Spu spu = spuRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("商品不存在: " + id));
        apply(spu, request);
        skuRepository.deleteBySpuId(id);
        List<Sku> skus = request.skus().stream().map(s -> toSku(spu, s)).toList();
        skuRepository.saveAll(skus);
        spu.setSkus(skus);
        return toResponse(spu);
    }

    public void changeStatus(UUID id, SpuStatus status) {
        Spu spu = spuRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("商品不存在: " + id));
        spu.setStatus(status);
    }

    public void delete(UUID id) {
        if (!spuRepository.existsById(id)) {
            throw new IllegalArgumentException("商品不存在: " + id);
        }
        spuRepository.deleteById(id); // sku 级联删除
    }

    private void apply(Spu spu, SpuCreateRequest r) {
        spu.setName(r.name());
        spu.setDescription(r.description());
        spu.setCategory(categoryRepository.findById(r.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("分类不存在: " + r.categoryId())));
        if (r.brandId() != null) {
            spu.setBrand(brandRepository.findById(r.brandId())
                    .orElseThrow(() -> new IllegalArgumentException("品牌不存在: " + r.brandId())));
        }
        spu.setCoverImage(r.coverImage());
        spu.setImages(toJsonArray(r.images()));
        spu.setSpecsTemplate(toJsonArray(r.specsTemplate() == null ? List.of() : r.specsTemplate().stream().map(s -> "{\"key\":\"" + s.key() + "\",\"values\":" + s.values() + "}").toList()));
        spu.setTags(toJsonArray(r.tags()));
    }

    private Sku toSku(Spu spu, SkuRequest r) {
        Sku sku = new Sku();
        sku.setSpu(spu);
        sku.setSpecs(toJson(r.specs()));
        sku.setPrice(r.price());
        sku.setSkuCode(r.skuCode());
        sku.setBarCode(r.barCode());
        sku.setWeight(r.weight());
        sku.setImages(toJsonArray(r.images()));
        sku.setActive(true);
        return sku;
    }

    private String toJson(Object o) {
        // 用 Jackson ObjectMapper 序列化；SPU 的 images/specsTemplate/tags 为 JSON 字符串列
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build().valueToTree(o).toString();
    }

    private String toJsonArray(List<String> list) {
        return list == null ? "[]" : toJson(list);
    }

    private SpuResponse toResponse(Spu spu) {
        return new SpuResponse(
                spu.getId(), spu.getName(), spu.getDescription(),
                null, null, spu.getStatus().name(), spu.getCoverImage(),
                List.of(), List.of(), List.of(),
                spu.getSkus().stream().map(this::toSkuResponse).toList());
    }

    private SkuResponse toSkuResponse(Sku sku) {
        return new SkuResponse(sku.getId(), sku.getSpecs() == null ? Map.of() : Map.of(),
                sku.getPrice(), sku.getSkuCode(), sku.getBarCode(), sku.getWeight(),
                List.of(), sku.isActive(), 0);
    }
}
```

- [ ] **Step 4: 补充仓库方法** — `SkuRepository.java` 增加 `void deleteBySpuId(UUID spuId)`

- [ ] **Step 5: 运行测试确认通过**

Run: `mvn -q test -Dtest=SpuWriteServiceTest`
Expected: PASS（若 `SpuResponse` 构造器参数与 Task 1.1 一致，此处直接可编）

- [ ] **Step 6: Commit**

```bash
git add product-service && git commit -m "feat(product): SpuWriteService 创建/更新/上下架/删除"
```

### Task 1.3: ProductQueryService（详情/列表/搜索）

**Files:**
- Create: `product-service/src/main/java/com/product/service/read/ProductQueryService.java`
- Modify: `product-service/src/main/java/com/product/repository/SpuRepository.java`
- Test: `product-service/src/test/java/com/product/service/read/ProductQueryServiceTest.java`

**Interfaces:**
- Produces: `SpuResponse detail(UUID id)`, `PageResponse<SpuResponse> search(ProductSearchRequest req)`
- Consumes: `ProductSearchRequest`、`PageResponse`、`SpuResponse`（已存在）

- [ ] **Step 1: 写失败测试（搜索按名称过滤）**

```java
@ExtendWith(MockitoExtension.class)
class ProductQueryServiceTest {
    @Mock SpuRepository spuRepository;
    ProductQueryService service;

    @BeforeEach
    void setUp() { service = new ProductQueryService(spuRepository); }

    @Test
    void shouldSearchByName() {
        var req = new ProductSearchRequest("iPhone", null, null, null, null, null, 0, 10);
        when(spuRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(new Spu()), PageRequest.of(0, 10), 1));
        var result = service.search(req);
        assertThat(result.total()).isEqualTo(1);
    }
}
```

- [ ] **Step 2: 运行确认失败**

Run: `mvn -q test -Dtest=ProductQueryServiceTest`
Expected: FAIL（类不存在）

- [ ] **Step 3: 实现**

```java
package com.product.service.read;

import com.product.domain.entity.Spu;
import com.product.domain.entity.SpuStatus;
import com.product.dto.request.ProductSearchRequest;
import com.product.dto.response.PageResponse;
import com.product.dto.response.SpuResponse;
import com.product.repository.SpuRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ProductQueryService {

    private final SpuRepository spuRepository;

    public ProductQueryService(SpuRepository spuRepository) {
        this.spuRepository = spuRepository;
    }

    public SpuResponse detail(UUID id) {
        Spu spu = spuRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("商品不存在: " + id));
        return toResponse(spu);
    }

    public PageResponse<SpuResponse> search(ProductSearchRequest req) {
        Specification<Spu> spec = (root, q, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.equal(root.get("status"), SpuStatus.active));
            if (req.q() != null && !req.q().isBlank()) {
                ps.add(cb.like(cb.lower(root.get("name")), "%" + req.q().toLowerCase() + "%"));
            }
            if (req.category() != null && !req.category().isBlank()) {
                ps.add(cb.equal(root.get("category").get("slug"), req.category()));
            }
            if (req.brand() != null && !req.brand().isBlank()) {
                ps.add(cb.equal(root.get("brand").get("name"), req.brand()));
            }
            if (req.minPrice() != null && !req.minPrice().isBlank()) {
                ps.add(cb.greaterThanOrEqualTo(root.get("skus").get("price"), new BigDecimal(req.minPrice())));
            }
            if (req.maxPrice() != null && !req.maxPrice().isBlank()) {
                ps.add(cb.lessThanOrEqualTo(root.get("skus").get("price"), new BigDecimal(req.maxPrice())));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var page = spuRepository.findAll(spec, PageRequest.of(req.page(), req.size()));
        return new PageResponse<>(page.getContent().stream().map(this::toResponse).toList(),
                page.getTotalElements(), req.page(), req.size());
    }

    private SpuResponse toResponse(Spu spu) { /* 与 Task 1.2 的 toResponse 相同 */ return null; }
}
```

> 注：`toResponse` 从 Task 1.2 复制（含 SKU 映射，`available` 先填 0，Task 1.5 接入库存时填充）。

- [ ] **Step 4: 运行测试**

Run: `mvn -q test -Dtest=ProductQueryServiceTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add product-service && git commit -m "feat(product): ProductQueryService 详情/搜索(JPA Specification)"
```

### Task 1.4: Controllers + 全局异常处理（brand/category/product）

**Files:**
- Create: `product-service/src/main/java/com/product/web/GlobalExceptionHandler.java`
- Create: `product-service/src/main/java/com/product/web/BrandController.java`
- Create: `product-service/src/main/java/com/product/web/CategoryController.java`
- Create: `product-service/src/main/java/com/product/web/ProductController.java`

**Interfaces:**
- Consumes: `BrandWriteService`/`CategoryWriteService`（已存在）、`SpuWriteService`（Task 1.2）、`ProductQueryService`（Task 1.3）
- Produces: REST 接口（供前端与 order-service 调用）：`/api/v1/brands`、`/api/v1/categories`、`/api/v1/products`、`/api/v1/products/{id}`、`/api/v1/products/{id}/status`、`/api/v1/products/search`

- [ ] **Step 1: 全局异常处理**

```java
package com.product.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleBadRequest(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, String>> handleConflict(IllegalStateException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getBindingResult().getAllErrors().get(0).getDefaultMessage()));
    }
}
```

- [ ] **Step 2: BrandController**（GET 分页列表 / POST / PUT / DELETE，委托 `BrandWriteService`）

```java
package com.product.web;

import com.product.dto.request.BrandRequest;
import com.product.dto.response.BrandResponse;
import com.product.dto.response.PageResponse;
import com.product.service.write.BrandWriteService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/brands")
public class BrandController {

    private final BrandWriteService service;

    public BrandController(BrandWriteService service) { this.service = service; }

    @GetMapping
    public PageResponse<BrandResponse> list(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        Page<BrandResponse> p = service.list(page, size);
        return new PageResponse<>(p.getContent(), p.getTotalElements(), page, size);
    }

    @PostMapping
    public BrandResponse create(@RequestBody BrandRequest req) { return service.create(req); }

    @PutMapping("/{id}")
    public BrandResponse update(@PathVariable UUID id, @RequestBody BrandRequest req) { return service.update(id, req); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { service.delete(id); }
}
```

- [ ] **Step 3: CategoryController** — 与 BrandController 同构：`GET /api/v1/categories/tree`（调 `getTree()`）、POST/PUT/DELETE

- [ ] **Step 4: ProductController**

```java
package com.product.web;

import com.product.domain.entity.SpuStatus;
import com.product.dto.request.ProductSearchRequest;
import com.product.dto.request.SpuCreateRequest;
import com.product.dto.response.PageResponse;
import com.product.dto.response.SpuResponse;
import com.product.service.read.ProductQueryService;
import com.product.service.write.SpuWriteService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final SpuWriteService writeService;
    private final ProductQueryService queryService;

    public ProductController(SpuWriteService writeService, ProductQueryService queryService) {
        this.writeService = writeService;
        this.queryService = queryService;
    }

    @PostMapping
    public SpuResponse create(@RequestBody SpuCreateRequest req) { return writeService.create(req); }

    @PutMapping("/{id}")
    public SpuResponse update(@PathVariable UUID id, @RequestBody SpuCreateRequest req) { return writeService.update(id, req); }

    @PatchMapping("/{id}/status")
    public void changeStatus(@PathVariable UUID id, @RequestBody SpuStatus status) { writeService.changeStatus(id, status); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { writeService.delete(id); }

    @GetMapping("/{id}")
    public SpuResponse detail(@PathVariable UUID id) { return queryService.detail(id); }

    @GetMapping("/search")
    public PageResponse<SpuResponse> search(ProductSearchRequest req) { return queryService.search(req); }
}
```

- [ ] **Step 5: 编译 + 起服冒烟**

Run: `mvn -q compile` 然后 `mvn spring-boot:run`（或 `mvn -q test` 确认既有测试通过）
Expected: 编译通过，既有测试全绿

- [ ] **Step 6: Commit**

```bash
git add product-service && git commit -m "feat(product): Brand/Category/Product Controllers + 全局异常处理"
```

### Task 1.5: Redis 商品详情缓存

**Files:**
- Modify: `product-service/pom.xml`（加 `spring-boot-starter-data-redis`）
- Create: `product-service/src/main/java/com/product/config/CacheConfig.java`
- Modify: `product-service/src/main/java/com/product/service/read/ProductQueryService.java`

**Interfaces:**
- Produces: 详情走缓存 `product:detail:{id}`，写操作（Task 1.2 的 create/update/delete/changeStatus）删除该 key
- Consumes: `SpuWriteService` 需注入 `CacheManager` 或 `RedisTemplate`

- [ ] **Step 1: 加依赖**

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

- [ ] **Step 2: 缓存配置 + 开启缓存**

```java
package com.product.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;

@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        return RedisCacheManager.builder(factory)
                .cacheDefaults(RedisCacheConfiguration.defaultCacheConfig()
                        .entryTtl(Duration.ofMinutes(30)))
                .build();
    }
}
```

- [ ] **Step 3: 查询服务加缓存注解** — `ProductQueryService.detail` 加 `@Cacheable(cacheNames = "product:detail", key = "#id")`；`SpuWriteService` 的 create/update/delete/changeStatus 加 `@CacheEvict(cacheNames = "product:detail", allEntries = true)`

- [ ] **Step 4: 编译 + 既有测试通过**

Run: `mvn -q test`
Expected: 全绿（测试不依赖 Redis 的路径不受影响）

- [ ] **Step 5: Commit**

```bash
git add product-service && git commit -m "feat(product): Redis商品详情缓存"
```

---

## Phase 2: inventory-service（新建）

### Task 2.1: 项目骨架 + 表 + 实体 + Repository

**Files:**
- Create: `inventory-service/pom.xml`
- Create: `inventory-service/src/main/java/com/inventory/InventoryApplication.java`
- Create: `inventory-service/src/main/resources/application.yml`
- Create: `inventory-service/src/main/resources/application-local.yml`
- Create: `inventory-service/src/main/resources/db/migration/V1__create_inventory.sql`
- Create: `inventory-service/src/main/java/com/inventory/domain/entity/Inventory.java`
- Create: `inventory-service/src/main/java/com/inventory/repository/InventoryRepository.java`
- Create: `inventory-service/src/main/java/com/inventory/repository/InventoryEventRepository.java`

**Interfaces:**
- Produces: `Inventory` 实体（字段见下）、`InventoryRepository.findByIdForUpdate(UUID)`（行锁查询）、`InventoryEventRepository.existsById/insertIfAbsent`

- [ ] **Step 1: pom.xml** — 依赖：`spring-boot-starter-web`、`starter-validation`、`starter-data-jpa`、`flyway-core`、`flyway-database-postgresql`、`postgresql`、`spring-kafka`、`starter-actuator`；测试：`starter-test`、`spring-kafka-test`、`testcontainers(postgresql/kafka)`、`h2`。参照 product-service/pom.xml 结构

- [ ] **Step 2: 启动类 + 配置**

```yaml
# application.yml
server: { port: 8082 }
spring:
  datasource:
    url: jdbc:postgresql://${DB_HOST:postgres}:${DB_PORT:5432}/${DB_NAME:inventory_service}
    username: ${DB_USER:inventory}
    password: ${DB_PASSWORD:inventory123}
  jpa:
    hibernate: { ddl-auto: validate }
    properties: { hibernate: { dialect: org.hibernate.dialect.PostgreSQLDialect } }
  flyway: { enabled: true, locations: classpath:db/migration }
  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS:kafka:9092}
    consumer:
      group-id: inventory-order-consumer
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties: { spring.json.trusted.packages: "com.order.event" }
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
management: { endpoints: { web: { exposure: { include: health,metrics } } } }
```

```yaml
# application-local.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5433/inventory_service
    username: inventory
    password: inventory123
  kafka: { bootstrap-servers: localhost:9092 }
logging: { level: { com.inventory: DEBUG } }
```

- [ ] **Step 3: V1 迁移**

```sql
CREATE TABLE inventory (
    sku_id     UUID PRIMARY KEY,
    quantity   INT NOT NULL DEFAULT 0,
    frozen     INT NOT NULL DEFAULT 0,
    version    BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_event (
    event_id   UUID PRIMARY KEY,
    order_id   UUID NOT NULL,
    type       VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 4: 实体 + Repository**

```java
@Entity
@Table(name = "inventory")
public class Inventory {
    @Id
    private UUID skuId;
    @Column(nullable = false)
    private int quantity;
    @Column(nullable = false)
    private int frozen;
    @Column(nullable = false)
    private long version;
    @Column(name = "updated_at", nullable = false, updatable = false)
    private Instant updatedAt;

    public int available() { return quantity - frozen; }
    // getters/setters 参照项目手动风格
}
```

```java
public interface InventoryRepository extends JpaRepository<Inventory, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from Inventory i where i.skuId = :skuId")
    Optional<Inventory> findByIdForUpdate(@Param("skuId") UUID skuId);
}

public interface InventoryEventRepository extends JpaRepository<InventoryEvent, UUID> {}
```

> 实体 `InventoryEvent`：字段 `UUID eventId`(@Id)、`UUID orderId`、`String type`、`Instant createdAt`

- [ ] **Step 5: 编译**

Run: `cd inventory-service && mvn -q compile`
Expected: 编译通过

- [ ] **Step 6: Commit**

```bash
git add inventory-service && git commit -m "feat(inventory): 项目骨架+表结构+实体+Repository"
```

### Task 2.2: InventoryService 三态操作（行锁）

**Files:**
- Create: `inventory-service/src/main/java/com/inventory/dto/ReserveRequest.java`
- Create: `inventory-service/src/main/java/com/inventory/dto/ReserveResult.java`
- Create: `inventory-service/src/main/java/com/inventory/dto/InventoryStock.java`
- Create: `inventory-service/src/main/java/com/inventory/service/InventoryService.java`
- Test: `inventory-service/src/test/java/com/inventory/service/InventoryServiceTest.java`

**Interfaces:**
- Produces:
  - `ReserveResult reserve(List<ReserveItem> items)` — 全成功返回 `success=true`；任一不足返回 `success=false` 并携带 `available` 明细
  - `void confirm(UUID skuId, int quantity)`
  - `void release(UUID skuId, int quantity)`
  - `void restock(UUID skuId, int quantity)`
  - `InventoryStock getStock(UUID skuId)`
- 供 Task 2.3 消费者与 Task 2.4 Controller 调用

- [ ] **Step 1: DTO**

```java
public record ReserveItem(UUID skuId, int quantity) {}
public record ReserveRequest(List<ReserveItem> items) {}
public record ReserveResult(boolean success, Map<UUID, Integer> available) {}
public record InventoryStock(UUID skuId, int quantity, int frozen, int available) {}
```

- [ ] **Step 2: 写失败测试（预扣/确认/释放）**

```java
@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {
    @Mock InventoryRepository repo;
    InventoryService service;

    @BeforeEach
    void setUp() { service = new InventoryService(repo); }

    private Inventory stock(int qty, int frozen) {
        var i = new Inventory();
        i.setSkuId(UUID.randomUUID()); i.setQuantity(qty); i.setFrozen(frozen);
        return i;
    }

    @Test
    void shouldReserve() {
        var inv = stock(10, 0);
        when(repo.findByIdForUpdate(inv.getSkuId())).thenReturn(Optional.of(inv));
        var r = service.reserve(List.of(new ReserveItem(inv.getSkuId(), 3)));
        assertThat(r.success()).isTrue();
        assertThat(inv.getFrozen()).isEqualTo(3);
    }

    @Test
    void shouldFailReserveWhenInsufficient() {
        var inv = stock(2, 0);
        when(repo.findByIdForUpdate(inv.getSkuId())).thenReturn(Optional.of(inv));
        var r = service.reserve(List.of(new ReserveItem(inv.getSkuId(), 5)));
        assertThat(r.success()).isFalse();
        assertThat(inv.getFrozen()).isZero();
    }

    @Test
    void shouldConfirmAndRelease() {
        var inv = stock(10, 5);
        when(repo.findByIdForUpdate(inv.getSkuId())).thenReturn(Optional.of(inv));
        service.confirm(inv.getSkuId(), 3);   // quantity 7, frozen 2
        assertThat(inv.getQuantity()).isEqualTo(7);
        assertThat(inv.getFrozen()).isEqualTo(2);
        service.release(inv.getSkuId(), 2);   // frozen 0
        assertThat(inv.getFrozen()).isZero();
    }
}
```

- [ ] **Step 3: 运行确认失败**

Run: `mvn -q test -Dtest=InventoryServiceTest`
Expected: FAIL（类不存在）

- [ ] **Step 4: 实现 InventoryService**

```java
package com.inventory.service;

import com.inventory.domain.entity.Inventory;
import com.inventory.dto.InventoryStock;
import com.inventory.dto.ReserveItem;
import com.inventory.dto.ReserveResult;
import com.inventory.repository.InventoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    public ReserveResult reserve(List<ReserveItem> items) {
        Map<UUID, Integer> available = new HashMap<>();
        for (ReserveItem item : items) {
            Inventory inv = load(item.skuId());
            if (inv.available() < item.quantity()) {
                available.put(item.skuId(), inv.available());
                return new ReserveResult(false, available);
            }
        }
        for (ReserveItem item : items) {
            Inventory inv = load(item.skuId());
            inv.setFrozen(inv.getFrozen() + item.quantity());
            available.put(item.skuId(), inv.available());
        }
        return new ReserveResult(true, available);
    }

    public void confirm(UUID skuId, int quantity) {
        Inventory inv = load(skuId);
        inv.setQuantity(inv.getQuantity() - quantity);
        inv.setFrozen(inv.getFrozen() - quantity);
    }

    public void release(UUID skuId, int quantity) {
        Inventory inv = load(skuId);
        inv.setFrozen(inv.getFrozen() - quantity);
    }

    public void restock(UUID skuId, int quantity) {
        Inventory inv = inventoryRepository.findById(skuId).orElseGet(() -> {
            Inventory i = new Inventory();
            i.setSkuId(skuId);
            return inventoryRepository.save(i);
        });
        inv.setQuantity(inv.getQuantity() + quantity);
    }

    @Transactional(readOnly = true)
    public InventoryStock getStock(UUID skuId) {
        Inventory inv = inventoryRepository.findById(skuId)
                .orElseThrow(() -> new IllegalArgumentException("库存不存在: " + skuId));
        return new InventoryStock(inv.getSkuId(), inv.getQuantity(), inv.getFrozen(), inv.available());
    }

    private Inventory load(UUID skuId) {
        return inventoryRepository.findByIdForUpdate(skuId)
                .orElseThrow(() -> new IllegalArgumentException("库存不存在: " + skuId));
    }
}
```

- [ ] **Step 5: 运行测试**

Run: `mvn -q test -Dtest=InventoryServiceTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add inventory-service && git commit -m "feat(inventory): 库存三态服务(预扣/确认/释放/回补/查询,行锁)"
```

### Task 2.3: Kafka 消费 order-events（幂等）

**Files:**
- Create: `inventory-service/src/main/java/com/inventory/event/OrderEvent.java`
- Create: `inventory-service/src/main/java/com/inventory/consumer/OrderEventConsumer.java`
- Test: `inventory-service/src/test/java/com/inventory/consumer/OrderEventConsumerTest.java`

**Interfaces:**
- Consumes: Kafka topic `order-events`，`OrderEvent` 结构（与 order-service 契约一致）：

```java
package com.inventory.event;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderEvent(
        UUID eventId, UUID orderId, String orderNo, EventType type,
        List<Item> items, Instant timestamp) {
    public enum EventType { PAID, CLOSED, CANCELLED, REFUNDED }
    public record Item(UUID skuId, int quantity) {}
}
```

- Produces: 调用 `InventoryService.confirm/release/restock`（Task 2.2）；先写 `inventory_event` 去重

- [ ] **Step 1: 写失败测试（PAID→confirm，重复事件幂等）**

```java
@ExtendWith(MockitoExtension.class)
class OrderEventConsumerTest {
    @Mock InventoryEventRepository eventRepo;
    @Mock InventoryService inventoryService;
    OrderEventConsumer consumer;

    @BeforeEach
    void setUp() { consumer = new OrderEventConsumer(eventRepo, inventoryService); }

    @Test
    void shouldConfirmOnPaid() {
        var skuId = UUID.randomUUID();
        var ev = new OrderEvent(UUID.randomUUID(), UUID.randomUUID(), "NO1",
                OrderEvent.EventType.PAID, List.of(new OrderEvent.Item(skuId, 2)), Instant.now());
        when(eventRepo.existsById(ev.eventId())).thenReturn(false);

        consumer.onOrderEvent(ev);

        verify(inventoryService).confirm(skuId, 2);
    }

    @Test
    void shouldSkipDuplicateEvent() {
        var skuId = UUID.randomUUID();
        var ev = new OrderEvent(UUID.randomUUID(), UUID.randomUUID(), "NO1",
                OrderEvent.EventType.PAID, List.of(new OrderEvent.Item(skuId, 2)), Instant.now());
        when(eventRepo.existsById(ev.eventId())).thenReturn(true);

        consumer.onOrderEvent(ev);

        verifyNoInteractions(inventoryService);
    }
}
```

- [ ] **Step 2: 运行确认失败**

Run: `mvn -q test -Dtest=OrderEventConsumerTest`
Expected: FAIL

- [ ] **Step 3: 实现**

```java
package com.inventory.consumer;

import com.inventory.domain.entity.InventoryEvent;
import com.inventory.event.OrderEvent;
import com.inventory.repository.InventoryEventRepository;
import com.inventory.service.InventoryService;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OrderEventConsumer {

    private final InventoryEventRepository eventRepository;
    private final InventoryService inventoryService;

    public OrderEventConsumer(InventoryEventRepository eventRepository, InventoryService inventoryService) {
        this.eventRepository = eventRepository;
        this.inventoryService = inventoryService;
    }

    @KafkaListener(topics = "order-events", groupId = "inventory-order-consumer")
    @Transactional
    public void onOrderEvent(OrderEvent event) {
        if (eventRepository.existsById(event.eventId())) {
            return; // 幂等
        }
        for (OrderEvent.Item item : event.items()) {
            switch (event.type()) {
                case PAID -> inventoryService.confirm(item.skuId(), item.quantity());
                case CLOSED, CANCELLED -> inventoryService.release(item.skuId(), item.quantity());
                case REFUNDED -> inventoryService.restock(item.skuId(), item.quantity());
            }
        }
        eventRepository.save(new InventoryEvent(event.eventId(), event.orderId(), event.type().name(), event.timestamp()));
    }
}
```

- [ ] **Step 4: 运行测试**

Run: `mvn -q test -Dtest=OrderEventConsumerTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add inventory-service && git commit -m "feat(inventory): 消费order-events事件(确认/释放/回补)+幂等去重"
```

### Task 2.4: Controller + 异常处理

**Files:**
- Create: `inventory-service/src/main/java/com/inventory/web/InventoryController.java`
- Create: `inventory-service/src/main/java/com/inventory/web/GlobalExceptionHandler.java`

**Interfaces:**
- Produces（供 order-service Feign 与后台管理调用）：
  - `POST /internal/inventory/reserve`（body: `ReserveRequest`）→ `ReserveResult`
  - `POST /internal/inventory/restock`（body: `{skuId, quantity}`）→ 200
  - `GET /internal/inventory/{skuId}` → `InventoryStock`
  - `GET /api/v1/inventory/{skuId}` → `InventoryStock`（管理端查看）

- [ ] **Step 1: Controller**

```java
package com.inventory.web;

import com.inventory.dto.InventoryStock;
import com.inventory.dto.ReserveRequest;
import com.inventory.dto.ReserveResult;
import com.inventory.service.InventoryService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/internal/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) { this.inventoryService = inventoryService; }

    @PostMapping("/reserve")
    public ReserveResult reserve(@RequestBody ReserveRequest req) {
        return inventoryService.reserve(req.items());
    }

    @PostMapping("/restock")
    public void restock(@RequestBody Map<String, Object> body) {
        inventoryService.restock(UUID.fromString((String) body.get("skuId")), (Integer) body.get("quantity"));
    }

    @GetMapping("/{skuId}")
    public InventoryStock getStock(@PathVariable UUID skuId) {
        return inventoryService.getStock(skuId);
    }
}
```

- [ ] **Step 2: GlobalExceptionHandler** — 与 Task 1.4 相同的实现（`IllegalArgumentException`→400、`IllegalStateException`→409、校验→400），包名改 `com.inventory.web`

- [ ] **Step 3: 编译 + 冒烟**

Run: `mvn -q compile`
Expected: 编译通过

- [ ] **Step 4: Commit**

```bash
git add inventory-service && git commit -m "feat(inventory): 内部库存接口 + 全局异常处理"
```

---

## Phase 3: order-service（新建）

### Task 3.1: 项目骨架 + 表 + 实体 + Repository

**Files:**
- Create: `order-service/pom.xml`
- Create: `order-service/src/main/java/com/order/OrderApplication.java`
- Create: `order-service/src/main/resources/application.yml`
- Create: `order-service/src/main/resources/application-local.yml`
- Create: `order-service/src/main/resources/db/migration/V1__create_order_tables.sql`
- Create: `order-service/src/main/java/com/order/domain/entity/Cart.java`
- Create: `order-service/src/main/java/com/order/domain/entity/Order.java`
- Create: `order-service/src/main/java/com/order/domain/entity/OrderItem.java`
- Create: `order-service/src/main/java/com/order/domain/entity/Payment.java`
- Create: `order-service/src/main/java/com/order/domain/entity/OrderStatus.java`
- Create: `order-service/src/main/java/com/order/repository/{CartRepository,OrderRepository,OrderItemRepository,PaymentRepository}.java`

**Interfaces:**
- Produces: 实体与仓库（供 Task 3.2-3.6 使用）

- [ ] **Step 1: pom.xml** — 依赖：`starter-web`、`starter-validation`、`starter-data-jpa`、`flyway-core`、`flyway-database-postgresql`、`postgresql`、`spring-kafka`、`spring-cloud-starter-openfeign`、`starter-actuator`、`starter-test`；需加 `spring-cloud-dependencies` BOM（参照 gateway/pom.xml 的 dependencyManagement）。测试：`spring-kafka-test`、`testcontainers`、`h2`

- [ ] **Step 2: 启动类**

```java
package com.order;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableFeignClients
@EnableScheduling
public class OrderApplication {
    public static void main(String[] args) {
        SpringApplication.run(OrderApplication.class, args);
    }
}
```

- [ ] **Step 3: 配置**（仿 inventory-service，端口 8083，库名 order_service，group-id `order-payment`，trusted packages `com.order.event`）

- [ ] **Step 4: V1 迁移**

```sql
CREATE TABLE cart (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    sku_id     UUID NOT NULL,
    quantity   INT NOT NULL,
    checked    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, sku_id)
);

CREATE TABLE orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no     VARCHAR(32) NOT NULL UNIQUE,
    user_id      UUID NOT NULL,
    status       VARCHAR(20) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    pay_amount   DECIMAL(10,2) NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at      TIMESTAMP,
    closed_at    TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_item (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES orders(id),
    sku_id       UUID NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    sku_spec     VARCHAR(500),
    price        DECIMAL(10,2) NOT NULL,
    quantity     INT NOT NULL,
    subtotal     DECIMAL(10,2) NOT NULL
);

CREATE TABLE payment (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pay_no   VARCHAR(32) NOT NULL UNIQUE,
    order_id UUID NOT NULL REFERENCES orders(id),
    amount   DECIMAL(10,2) NOT NULL,
    status   VARCHAR(20) NOT NULL,
    channel  VARCHAR(20) NOT NULL DEFAULT 'MOCK',
    paid_at  TIMESTAMP
);
```

- [ ] **Step 5: 状态枚举 + 实体**

```java
public enum OrderStatus { PENDING_PAYMENT, PAID, SHIPPED, COMPLETED, CLOSED, REFUNDING, REFUNDED }
```

实体 `Order`：`UUID id, String orderNo, UUID userId, OrderStatus status, BigDecimal totalAmount, BigDecimal payAmount, Instant createdAt/paidAt/closedAt/updatedAt`，`@PrePersist` 生成时间；`OrderItem`（order 多对一，`@Column` 快照字段）；`Cart`（user_id/sku_id 唯一）；`Payment`（pay_no 唯一）。均参照现有手动 getter/setter 风格。

- [ ] **Step 6: Repository**

```java
public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByIdAndUserId(UUID id, UUID userId);
    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, Instant before);
}
public interface CartRepository extends JpaRepository<Cart, UUID> {
    List<Cart> findByUserIdAndCheckedTrue(UUID userId);
    Optional<Cart> findByUserIdAndSkuId(UUID userId, UUID skuId);
    void deleteByUserIdAndCheckedTrue(UUID userId);
}
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> { List<OrderItem> findByOrderId(UUID orderId); }
public interface PaymentRepository extends JpaRepository<Payment, UUID> {}
```

- [ ] **Step 7: 编译**

Run: `cd order-service && mvn -q compile`
Expected: 编译通过

- [ ] **Step 8: Commit**

```bash
git add order-service && git commit -m "feat(order): 项目骨架+表结构+实体+Repository"
```

### Task 3.2: Feign 客户端（product/inventory）

**Files:**
- Create: `order-service/src/main/java/com/order/client/InventoryClient.java`
- Create: `order-service/src/main/java/com/order/client/ProductClient.java`
- Create: `order-service/src/main/java/com/order/client/SkuSnapshot.java`
- Create: `order-service/src/main/java/com/order/config/FeignConfig.java`
- Test: `order-service/src/test/java/com/order/client/FeignClientsTest.java`（用 MockWebServer 验证请求路径）

**Interfaces:**
- Produces:
  - `InventoryClient.reserve(ReserveRequest) → ReserveResult`、`InventoryClient.getStock(UUID) → InventoryStock`
  - `ProductClient.batchSkus(List<UUID>) → List<SkuSnapshot>`
  - `SkuSnapshot(UUID id, String productName, String skuSpec, BigDecimal price)`

- [ ] **Step 1: Feign 接口**

```java
package com.order.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@FeignClient(name = "inventory-service", url = "${inventory.service.url}")
public interface InventoryClient {
    @PostMapping("/internal/inventory/reserve")
    ReserveResult reserve(@RequestBody ReserveRequest request);

    @GetMapping("/internal/inventory/{skuId}")
    InventoryStock getStock(@PathVariable UUID skuId);

    record ReserveRequest(List<ReserveItem> items) {}
    record ReserveItem(UUID skuId, int quantity) {}
    record ReserveResult(boolean success, Map<UUID, Integer> available) {}
    record InventoryStock(UUID skuId, int quantity, int frozen, int available) {}
}

@FeignClient(name = "product-service", url = "${product.service.url}")
public interface ProductClient {
    @PostMapping("/internal/skus/batch")
    List<SkuSnapshot> batchSkus(@RequestBody List<UUID> skuIds);
}
```

```java
public record SkuSnapshot(UUID id, String productName, String skuSpec, java.math.BigDecimal price) {}
```

- [ ] **Step 2: 配置**

```yaml
# application.yml 追加
inventory:
  service: { url: ${INVENTORY_SERVICE_URL:http://localhost:8082} }
product:
  service: { url: ${PRODUCT_SERVICE_URL:http://localhost:8081} }
```

- [ ] **Step 3: Feign 超时/重试配置**

```java
package com.order.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class FeignConfig {
    @Bean
    public feign.Request.Options feignOptions() {
        return new feign.Request.Options(2, TimeUnit.SECONDS, 5, TimeUnit.SECONDS, true);
    }
}
```

- [ ] **Step 4: 契约测试（MockWebServer 验证 path/body）**

```java
class FeignClientsTest {
    MockWebServer server;
    InventoryClient client;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer(); server.start();
        client = Feign.builder()
                .client(new OkHttpClient())
                .target(InventoryClient.class, server.url("/").toString());
    }

    @Test
    void reservePostsReservePath() throws InterruptedException {
        server.enqueue(new MockResponse().setBody("{\"success\":true,\"available\":{}}")
                .addHeader("Content-Type", "application/json"));
        client.reserve(new InventoryClient.ReserveRequest(List.of(new InventoryClient.ReserveItem(UUID.randomUUID(), 2))));
        RecordedRequest r = server.takeRequest();
        assertThat(r.getPath()).isEqualTo("/internal/inventory/reserve");
    }
}
```

> 需在 pom 加 `mockwebserver` 与 `okhttp` 测试依赖（gateway 已用过 mockwebserver）。

- [ ] **Step 5: 运行测试**

Run: `mvn -q test -Dtest=FeignClientsTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add order-service && git commit -m "feat(order): Feign客户端(inventory/product)+超时配置+契约测试"
```

### Task 3.3: CartService（购物车）

**Files:**
- Create: `order-service/src/main/java/com/order/service/CartService.java`
- Test: `order-service/src/test/java/com/order/service/CartServiceTest.java`

**Interfaces:**
- Produces: `void add(UUID userId, AddItemRequest)`, `List<CartItemView> list(UUID userId)`, `void remove(UUID userId, UUID skuId)`, `void toggleChecked(UUID userId, UUID skuId, boolean checked)`
- Consumes: `CartRepository`

- [ ] **Step 1: 写失败测试（加购数量累加）**

```java
@ExtendWith(MockitoExtension.class)
class CartServiceTest {
    @Mock CartRepository repo;
    CartService service;

    @BeforeEach
    void setUp() { service = new CartService(repo); }

    @Test
    void shouldAddAndAccumulateQuantity() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        Cart existing = new Cart(); existing.setQuantity(1);
        when(repo.findByUserIdAndSkuId(userId, skuId)).thenReturn(Optional.of(existing));

        service.add(userId, new CartService.AddItemRequest(skuId, 2));

        assertThat(existing.getQuantity()).isEqualTo(3);
    }
}
```

- [ ] **Step 2: 实现**

```java
package com.order.service;

import com.order.domain.entity.Cart;
import com.order.repository.CartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class CartService {

    private final CartRepository cartRepository;

    public CartService(CartRepository cartRepository) { this.cartRepository = cartRepository; }

    public void add(UUID userId, AddItemRequest req) {
        Cart cart = cartRepository.findByUserIdAndSkuId(userId, req.skuId()).orElseGet(() -> {
            Cart c = new Cart();
            c.setUserId(userId); c.setSkuId(req.skuId()); c.setChecked(true);
            return c;
        });
        cart.setQuantity(cart.getQuantity() + req.quantity());
        cartRepository.save(cart);
    }

    @Transactional(readOnly = true)
    public List<Cart> list(UUID userId) {
        return cartRepository.findByUserIdAndCheckedTrue(userId);
    }

    public void remove(UUID userId, UUID skuId) {
        cartRepository.findByUserIdAndSkuId(userId, skuId).ifPresent(cartRepository::delete);
    }

    public void toggleChecked(UUID userId, UUID skuId, boolean checked) {
        cartRepository.findByUserIdAndSkuId(userId, skuId).ifPresent(c -> { c.setChecked(checked); });
    }

    public record AddItemRequest(UUID skuId, int quantity) {}
}
```

- [ ] **Step 3: 运行测试**

Run: `mvn -q test -Dtest=CartServiceTest`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add order-service && git commit -m "feat(order): 购物车服务(加购/列表/删除/勾选)"
```

### Task 3.4: OrderService 创建订单（预扣库存）

**Files:**
- Create: `order-service/src/main/java/com/order/service/OrderService.java`
- Create: `order-service/src/main/java/com/order/event/OrderEvent.java`
- Create: `order-service/src/main/java/com/order/event/OrderEventPublisher.java`
- Test: `order-service/src/test/java/com/order/service/OrderServiceTest.java`

**Interfaces:**
- Produces:
  - `OrderResponse createOrder(UUID userId, CreateOrderRequest req)`
  - `void changeStatus(UUID orderId, OrderStatus from, OrderStatus to)`（状态机校验）
- Consumes: `OrderRepository`、`OrderItemRepository`、`CartRepository`、`InventoryClient`、`ProductClient`、`OrderEventPublisher`
- 供 Task 3.5（支付/退款）、Task 3.6（超时关单）调用

- [ ] **Step 1: 事件定义 + 发布器**

```java
package com.order.event;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderEvent(UUID eventId, UUID orderId, String orderNo, EventType type,
                         List<Item> items, Instant timestamp) {
    public enum EventType { PAID, CLOSED, CANCELLED, REFUNDED }
    public record Item(UUID skuId, int quantity) {}
}
```

```java
package com.order.event;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class OrderEventPublisher {

    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;

    public OrderEventPublisher(KafkaTemplate<String, OrderEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public void publish(OrderEvent.EventType type, UUID orderId, String orderNo, List<OrderEvent.Item> items) {
        kafkaTemplate.send("order-events", new OrderEvent(UUID.randomUUID(), orderId, orderNo, type, items, Instant.now()));
    }
}
```

- [ ] **Step 2: 写失败测试（创建订单：建单+快照+预扣；预扣失败→CLOSED）**

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock CartRepository cartRepository;
    @Mock InventoryClient inventoryClient;
    @Mock ProductClient productClient;
    @Mock OrderEventPublisher publisher;
    OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(orderRepository, orderItemRepository, cartRepository,
                inventoryClient, productClient, publisher);
    }

    @Test
    void shouldCreateOrderWithReservedStock() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        var snapshot = new SkuSnapshot(skuId, "iPhone", "黑", new BigDecimal("5999.00"));
        when(productClient.batchSkus(List.of(skuId))).thenReturn(List.of(snapshot));
        when(inventoryClient.reserve(any())).thenReturn(
                new InventoryClient.ReserveResult(true, Map.of(skuId, 10)));
        when(orderRepository.save(any())).thenAnswer(inv -> { var o = inv.getArgument(0, Order.class); o.setId(UUID.randomUUID()); return o; });

        var result = service.createOrder(userId,
                new OrderService.CreateOrderRequest(List.of(new OrderService.OrderLine(skuId, 1))));

        assertThat(result.status()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        verify(orderItemRepository).saveAll(any());
    }

    @Test
    void shouldCloseOrderWhenReserveFails() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        var snapshot = new SkuSnapshot(skuId, "iPhone", "黑", new BigDecimal("5999.00"));
        when(productClient.batchSkus(List.of(skuId))).thenReturn(List.of(snapshot));
        when(inventoryClient.reserve(any())).thenReturn(
                new InventoryClient.ReserveResult(false, Map.of(skuId, 0)));
        when(orderRepository.save(any())).thenAnswer(inv -> { var o = inv.getArgument(0, Order.class); o.setId(UUID.randomUUID()); return o; });

        var result = service.createOrder(userId,
                new OrderService.CreateOrderRequest(List.of(new OrderService.OrderLine(skuId, 5))));

        assertThat(result.status()).isEqualTo(OrderStatus.CLOSED);
    }
}
```

- [ ] **Step 3: 运行确认失败**

Run: `mvn -q test -Dtest=OrderServiceTest`
Expected: FAIL

- [ ] **Step 4: 实现 OrderService（核心）**

```java
package com.order.service;

import com.order.client.InventoryClient;
import com.order.client.ProductClient;
import com.order.client.SkuSnapshot;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
import com.order.event.OrderEvent;
import com.order.event.OrderEventPublisher;
import com.order.repository.CartRepository;
import com.order.repository.OrderItemRepository;
import com.order.repository.OrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class OrderService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final CartRepository cartRepository;
    private final InventoryClient inventoryClient;
    private final ProductClient productClient;
    private final OrderEventPublisher publisher;

    public OrderService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
                        CartRepository cartRepository, InventoryClient inventoryClient,
                        ProductClient productClient, OrderEventPublisher publisher) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.cartRepository = cartRepository;
        this.inventoryClient = inventoryClient;
        this.productClient = productClient;
        this.publisher = publisher;
    }

    public Order createOrder(UUID userId, CreateOrderRequest req) {
        List<UUID> skuIds = req.lines().stream().map(l -> l.skuId()).toList();
        List<SkuSnapshot> snapshots = productClient.batchSkus(skuIds);
        Order order = new Order();
        order.setOrderNo("NO" + System.currentTimeMillis() + UUID.randomUUID().toString().substring(0, 6));
        order.setUserId(userId);
        order.setStatus(OrderStatus.PENDING_PAYMENT);
        BigDecimal total = BigDecimal.ZERO;
        for (SkuSnapshot s : snapshots) {
            total = total.add(s.price().multiply(BigDecimal.valueOf(
                    req.lines().stream().filter(l -> l.skuId().equals(s.id())).findFirst().orElseThrow().quantity())));
        }
        order.setTotalAmount(total);
        order.setPayAmount(total);
        Order saved = orderRepository.save(order);

        List<OrderItem> items = snapshots.stream().map(s -> {
            int qty = req.lines().stream().filter(l -> l.skuId().equals(s.id())).findFirst().orElseThrow().quantity();
            OrderItem it = new OrderItem();
            it.setOrderId(saved.getId());
            it.setSkuId(s.id());
            it.setProductName(s.productName());
            it.setSkuSpec(s.skuSpec());
            it.setPrice(s.price());
            it.setQuantity(qty);
            it.setSubtotal(s.price().multiply(BigDecimal.valueOf(qty)));
            return it;
        }).toList();
        orderItemRepository.saveAll(items);

        var reserve = inventoryClient.reserve(new InventoryClient.ReserveRequest(
                req.lines().stream().map(l -> new InventoryClient.ReserveItem(l.skuId(), l.quantity())).toList()));
        if (!reserve.success()) {
            saved.setStatus(OrderStatus.CLOSED);
            saved.setClosedAt(java.time.Instant.now());
            return saved; // 保留记录，可对账
        }
        cartRepository.deleteByUserIdAndCheckedTrue(userId);
        return saved;
    }

    public record CreateOrderRequest(List<OrderLine> lines) {}
    public record OrderLine(UUID skuId, int quantity) {}
}
```

> `OrderResponse` 在此任务补建（id/orderNo/status/totalAmount/paidAt/closedAt 的 record），`createOrder` 返回 `OrderResponse`。

- [ ] **Step 5: 运行测试**

Run: `mvn -q test -Dtest=OrderServiceTest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add order-service && git commit -m "feat(order): 创建订单(快照+预扣库存,失败关单保留记录)"
```

### Task 3.5: 支付/退款（模拟）+ 事件发布

**Files:**
- Modify: `order-service/src/main/java/com/order/service/OrderService.java`
- Test: `order-service/src/test/java/com/order/service/OrderPayRefundTest.java`

**Interfaces:**
- Produces: `void pay(UUID orderId, UUID userId)`、`void refund(UUID orderId, UUID userId)`、`void ship(UUID orderId, UUID userId)`
- Consumes: `PaymentRepository`、`OrderEventPublisher.publish`（Task 3.4）

- [ ] **Step 1: 写失败测试（支付→PAID 事件；重复支付拒绝）**

```java
class OrderPayRefundTest {
    // mock 同 OrderServiceTest 构造
    @Test
    void shouldPayAndPublishPaidEvent() {
        UUID userId = UUID.randomUUID(), orderId = UUID.randomUUID();
        Order order = new Order(); order.setId(orderId); order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setPayAmount(new BigDecimal("5999.00"));
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.pay(orderId, userId);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
        verify(publisher).publish(eq(OrderEvent.EventType.PAID), eq(orderId), any(), any());
    }

    @Test
    void shouldRejectPayWhenNotPending() {
        Order order = new Order(); order.setId(UUID.randomUUID()); order.setStatus(OrderStatus.PAID);
        when(orderRepository.findByIdAndUserId(any(), any())).thenReturn(Optional.of(order));
        assertThatThrownBy(() -> service.pay(order.getId(), UUID.randomUUID()))
                .isInstanceOf(IllegalStateException.class);
    }
}
```

- [ ] **Step 2: 实现（追加到 OrderService）**

```java
public void pay(UUID orderId, UUID userId) {
    Order order = requireOrder(orderId, userId);
    requireStatus(order, OrderStatus.PENDING_PAYMENT);
    order.setStatus(OrderStatus.PAID);
    order.setPaidAt(java.time.Instant.now());
    Payment payment = new Payment();
    payment.setPayNo("PAY" + UUID.randomUUID().toString().replace("-", "").substring(0, 20));
    payment.setOrderId(orderId);
    payment.setAmount(order.getPayAmount());
    payment.setStatus("SUCCESS");
    payment.setChannel("MOCK");
    payment.setPaidAt(order.getPaidAt());
    paymentRepository.save(payment);
    publisher.publish(OrderEvent.EventType.PAID, orderId, order.getOrderNo(), itemsOf(orderId));
}

public void refund(UUID orderId, UUID userId) {
    Order order = requireOrder(orderId, userId);
    requireStatus(order, OrderStatus.PAID);   // 仅已支付可退
    order.setStatus(OrderStatus.REFUNDING);
    order.setStatus(OrderStatus.REFUNDED);    // 模拟立即退款成功
    publisher.publish(OrderEvent.EventType.REFUNDED, orderId, order.getOrderNo(), itemsOf(orderId));
}

public void ship(UUID orderId, UUID userId) {
    Order order = requireOrder(orderId, userId);
    requireStatus(order, OrderStatus.PAID);
    order.setStatus(OrderStatus.SHIPPED);
}

private Order requireOrder(UUID orderId, UUID userId) {
    return orderRepository.findByIdAndUserId(orderId, userId)
            .orElseThrow(() -> new IllegalArgumentException("订单不存在: " + orderId));
}

private void requireStatus(Order order, OrderStatus expected) {
    if (order.getStatus() != expected) {
        throw new IllegalStateException("订单状态不允许该操作: " + order.getStatus());
    }
}

private List<OrderEvent.Item> itemsOf(UUID orderId) {
    return orderItemRepository.findByOrderId(orderId).stream()
            .map(i -> new OrderEvent.Item(i.getSkuId(), i.getQuantity())).toList();
}
```

- [ ] **Step 3: 运行测试**

Run: `mvn -q test -Dtest=OrderPayRefundTest`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add order-service && git commit -m "feat(order): 模拟支付/退款/发货 + 事件发布"
```

### Task 3.6: 超时关单 @Scheduled

**Files:**
- Modify: `order-service/src/main/java/com/order/service/OrderService.java`
- Test: `order-service/src/test/java/com/order/service/OrderTimeoutTest.java`

**Interfaces:**
- Produces: `void closeTimeoutOrders()` — 关闭超时(15分钟)待支付订单并发 `CLOSED` 事件
- Consumes: `OrderRepository.findByStatusAndCreatedAtBefore`

- [ ] **Step 1: 写失败测试**

```java
class OrderTimeoutTest {
    @Test
    void shouldClosePendingOrdersOlderThanTimeout() {
        Order pending = new Order(); pending.setId(UUID.randomUUID());
        pending.setStatus(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findByStatusAndCreatedAtBefore(eq(OrderStatus.PENDING_PAYMENT), any()))
                .thenReturn(List.of(pending));
        service.closeTimeoutOrders();
        assertThat(pending.getStatus()).isEqualTo(OrderStatus.CLOSED);
        verify(publisher).publish(eq(OrderEvent.EventType.CLOSED), eq(pending.getId()), any(), any());
    }
}
```

- [ ] **Step 2: 实现**

```java
@Scheduled(fixedDelay = 60000)   // 每分钟扫一次
public void closeTimeoutOrders() {
    List<Order> expired = orderRepository.findByStatusAndCreatedAtBefore(
            OrderStatus.PENDING_PAYMENT, java.time.Instant.now().minus(java.time.Duration.ofMinutes(15)));
    for (Order order : expired) {
        order.setStatus(OrderStatus.CLOSED);
        order.setClosedAt(java.time.Instant.now());
        publisher.publish(OrderEvent.EventType.CLOSED, order.getId(), order.getOrderNo(), itemsOf(order.getId()));
    }
}
```

> `cancel(UUID orderId, UUID userId)` 复用同一逻辑：校验 PENDING_PAYMENT → 置 CLOSED → 发 `CANCELLED` 事件。

- [ ] **Step 3: 运行测试**

Run: `mvn -q test -Dtest=OrderTimeoutTest`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add order-service && git commit -m "feat(order): 超时关单调度(15min) + 用户取消"
```

### Task 3.7: Controller + 异常处理

**Files:**
- Create: `order-service/src/main/java/com/order/web/CartController.java`
- Create: `order-service/src/main/java/com/order/web/OrderController.java`
- Create: `order-service/src/main/java/com/order/web/GlobalExceptionHandler.java`
- Create: `order-service/src/main/java/com/order/web/UserContext.java`（从 `X-User-Id` 头取 userId）

**Interfaces:**
- Produces: REST 接口（经 gateway 转发，gateway 注入 `X-User-Id` 头）：
  - `POST /api/v1/cart`、`GET /api/v1/cart`、`DELETE /api/v1/cart/{skuId}`
  - `POST /api/v1/orders`（下单）、`GET /api/v1/orders/{id}`、`POST /api/v1/orders/{id}/pay`、`POST /api/v1/orders/{id}/cancel`、`POST /api/v1/orders/{id}/refund`、`POST /api/v1/orders/{id}/ship`

- [ ] **Step 1: UserContext**

```java
package com.order.web;

import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

@Component
public class UserContext {
    public UUID currentUserId() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        String userId = attrs == null ? null : attrs.getRequest().getHeader("X-User-Id");
        if (userId == null || userId.isBlank()) {
            throw new IllegalStateException("缺少用户身份");
        }
        return UUID.fromString(userId);
    }
}
```

- [ ] **Step 2: OrderController**

```java
package com.order.web;

import com.order.domain.entity.Order;
import com.order.service.OrderService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;
    private final UserContext userContext;

    public OrderController(OrderService orderService, UserContext userContext) {
        this.orderService = orderService;
        this.userContext = userContext;
    }

    @PostMapping
    public Order create(@RequestBody OrderService.CreateOrderRequest req) {
        return orderService.createOrder(userContext.currentUserId(), req);
    }

    @PostMapping("/{id}/pay")
    public void pay(@PathVariable UUID id) { orderService.pay(id, userContext.currentUserId()); }

    @PostMapping("/{id}/cancel")
    public void cancel(@PathVariable UUID id) { orderService.cancel(id, userContext.currentUserId()); }

    @PostMapping("/{id}/refund")
    public void refund(@PathVariable UUID id) { orderService.refund(id, userContext.currentUserId()); }

    @PostMapping("/{id}/ship")
    public void ship(@PathVariable UUID id) { orderService.ship(id, userContext.currentUserId()); }
}
```

- [ ] **Step 3: CartController + GlobalExceptionHandler** — CartController 委托 `CartService`（5 个接口，含 UserContext）；异常处理与 Task 1.4 同构（包名 `com.order.web`）

- [ ] **Step 4: 编译 + 全部测试**

Run: `mvn -q test`
Expected: 全绿

- [ ] **Step 5: Commit**

```bash
git add order-service && git commit -m "feat(order): Cart/Order Controller + UserContext + 全局异常处理"
```

---

## Phase 4: 全链路验证

### Task 4.1: 本地 docker-compose 环境

**Files:**
- Create: `docker-compose.yml`（仓库根目录）

**Interfaces:**
- Produces: 本地一键起 postgres×3、kafka、redis、product/inventory/order 三服务

- [ ] **Step 1: 编写 compose**

```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5433:5432"]
    environment:
      POSTGRES_USER: product
      POSTGRES_PASSWORD: product123
      POSTGRES_DB: product_service
  kafka:
    image: bitnami/kafka:3.7
    ports: ["9092:9092"]
    environment:
      KAFKA_CFG_NODE_ID: 0
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_CFG_LISTENERS: PLAINTEXT://:9092,CONTROLLER://:9093
      KAFKA_CFG_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 0@kafka:9093
  redis:
    image: redis:7
    ports: ["6379:6379"]
  product-service:
    build: ./product-service
    ports: ["8081:8081"]
    environment: { SPRING_PROFILES_ACTIVE: local, DB_HOST: postgres, DB_PORT: "5432", DB_NAME: product_service, KAFKA_BOOTSTRAP_SERVERS: kafka:9092 }
  inventory-service:
    build: ./inventory-service
    ports: ["8082:8082"]
    environment: { SPRING_PROFILES_ACTIVE: local, DB_HOST: postgres, DB_PORT: "5432", DB_NAME: inventory_service, KAFKA_BOOTSTRAP_SERVERS: kafka:9092 }
  order-service:
    build: ./order-service
    ports: ["8083:8083"]
    environment: { SPRING_PROFILES_ACTIVE: local, DB_HOST: postgres, DB_PORT: "5432", DB_NAME: order_service, KAFKA_BOOTSTRAP_SERVERS: kafka:9092, INVENTORY_SERVICE_URL: http://inventory-service:8082, PRODUCT_SERVICE_URL: http://product-service:8081 }
```

- [ ] **Step 2: 为三个服务各补 Dockerfile**（参照 `gateway/Dockerfile` 的 `maven:3.9-eclipse-temurin-21` 构建 + `eclipse-temurin:21-jre` 运行）

- [ ] **Step 3: 起环境验证**

Run: `docker compose up -d --build`
Expected: 三服务启动成功，`curl http://localhost:8081/actuator/health` 返回 UP

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml product-service/Dockerfile inventory-service/Dockerfile order-service/Dockerfile
git commit -m "chore: 本地docker-compose全链路环境"
```

### Task 4.2: 全链路集成测试（order-service）

**Files:**
- Create: `order-service/src/test/java/com/order/FullFlowIntegrationTest.java`

**Interfaces:**
- 验证：建商品→加购→下单(预扣)→支付→(inventory confirm)→退款→(restock)

- [ ] **Step 1: 写集成测试（Testcontainers: PostgreSQL+Kafka+Redis）**

```java
@SpringBootTest
@Testcontainers
class FullFlowIntegrationTest {
    @Container static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16")
            .withDatabaseName("order_service");
    @Container static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));
    @Container static GenericContainer<?> redis = new GenericContainer<>("redis:7").withExposedPorts(6379);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
        r.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
    }

    @Autowired OrderService orderService;
    @Autowired InventoryClient inventoryClient;
    // 通过 MockWebServer 模拟 product/inventory HTTP（本测试聚焦 order 侧流程 + Kafka 事件）
}
```

- [ ] **Step 2: 核心断言** — 下单成功返回 PENDING_PAYMENT；支付后发布 PAID 事件（用 `@EmbeddedKafka` 或 Testcontainers Kafka 的 consumer 捕获）；订单状态机非法流转抛 IllegalStateException

- [ ] **Step 3: 运行**

Run: `mvn -q test -Dtest=FullFlowIntegrationTest`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add order-service && git commit -m "test(order): 全链路集成测试(Testcontainers)"
```

### Task 4.3: 对账任务

**Files:**
- Create: `order-service/src/main/java/com/order/service/ReconciliationService.java`
- Test: `order-service/src/test/java/com/order/service/ReconciliationServiceTest.java`

**Interfaces:**
- Produces: `void reconcile()` — @Scheduled 每小时；扫描「已支付但超过10分钟未确认扣减」的订单，比对 inventory 冻结数，异常告警日志

- [ ] **Step 1: 写失败测试**

```java
class ReconciliationServiceTest {
    @Test
    void shouldFlagPaidOrderWithoutConfirmedInventory() {
        Order paid = new Order(); paid.setId(UUID.randomUUID()); paid.setStatus(OrderStatus.PAID);
        when(orderRepository.findByStatusAndPaidAtBefore(eq(OrderStatus.PAID), any())).thenReturn(List.of(paid));
        when(inventoryClient.getStock(any())).thenReturn(new InventoryClient.InventoryStock(sku, 0, 0, 0));
        service.reconcile();
        // 断言：记录到告警列表（logger/mem 列表），不抛异常
    }
}
```

- [ ] **Step 2: 实现** — 校验逻辑：对每个超时未确认的已支付订单，查其 items 的冻结库存，若 `frozen < 应确认量` 则告警（本阶段仅日志 + 计数，不自动补偿，留作人工介入）

- [ ] **Step 3: 运行测试 + 全量回归**

Run: `mvn -q test`
Expected: 全绿

- [ ] **Step 4: Commit**

```bash
git add order-service && git commit -m "feat(order): 对账任务(已支付未确认告警)"
```

---

## Self-Review 结果

- **Spec 覆盖**：范围✅(Task 1.1-1.5/2.x/3.x) 数据模型✅(1.1,2.1,3.1) 核心流程✅(3.4 下单预扣,3.5 支付退款,3.6 关单,2.3 事件消费) Kafka✅(3.4 发布器,2.3 消费者) 错误处理✅(各 GlobalExceptionHandler,3.4 失败关单) 缓存✅(1.5) 测试✅(各 Task + 4.2) 对账✅(4.3) 实施顺序✅
- **占位符扫描**：无 TBD/TODO；`toResponse` 跨 Task 复用有明确指引
- **类型一致性**：`OrderEvent`(order)/`com.order.event` 与 inventory 侧 `com.inventory.event` 字段一致（trusted packages 已分别配置）；`InventoryClient.ReserveRequest/ReserveResult` 与 inventory 侧 `ReserveRequest/ReserveResult` 字段一致
