package com.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderStatus;
import com.order.event.OrderEvent;
import com.order.repository.CartRepository;
import com.order.repository.OrderRepository;
import com.order.repository.PaymentRepository;
import com.order.service.CartService;
import com.order.service.OrderService;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.ConsumerRecords;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.KafkaContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Testcontainers
class FullFlowIntegrationTest {

    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16").withDatabaseName("order_service");

    @Container
    static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));

    // MockWebServer must be started BEFORE the Spring context is created (@DynamicPropertySource resolves during context init),
    // so start them in a static initializer, not @BeforeAll.
    static MockWebServer productServer;
    static MockWebServer inventoryServer;
    static {
        try {
            productServer = new MockWebServer(); productServer.start();
            inventoryServer = new MockWebServer(); inventoryServer.start();
        } catch (IOException e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    @Autowired OrderService orderService;
    @Autowired CartService cartService;
    @Autowired OrderRepository orderRepository;
    @Autowired CartRepository cartRepository;
    @Autowired PaymentRepository paymentRepository;
    @Autowired ObjectMapper objectMapper;

    static KafkaConsumer<String, String> kafkaConsumer;
    static BlockingQueue<ConsumerRecord<String, String>> events = new LinkedBlockingQueue<>();
    static volatile boolean consumerRunning = true;
    static Thread consumerThread;

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
        r.add("spring.kafka.bootstrap-servers", kafka::getBootstrapServers);
        r.add("product.service.url", () -> productServer.url("/").toString());
        r.add("inventory.service.url", () -> inventoryServer.url("/").toString());
    }

    @BeforeAll
    static void startKafkaConsumer() {
        Properties props = new Properties();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, kafka.getBootstrapServers());
        props.put(ConsumerConfig.GROUP_ID_CONFIG, "integration-test-" + UUID.randomUUID());
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class.getName());
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "true");
        kafkaConsumer = new KafkaConsumer<>(props);
        kafkaConsumer.subscribe(List.of("order-events"));
        consumerThread = new Thread(() -> {
            while (consumerRunning) {
                ConsumerRecords<String, String> records = kafkaConsumer.poll(Duration.ofMillis(200));
                records.forEach(events::offer);
            }
            kafkaConsumer.close();
        }, "order-events-test-consumer");
        consumerThread.setDaemon(true);
        consumerThread.start();
    }

    @AfterAll
    static void tearDown() throws IOException {
        consumerRunning = false;
        if (consumerThread != null) consumerThread.interrupt();
        if (productServer != null) productServer.shutdown();
        if (inventoryServer != null) inventoryServer.shutdown();
    }

    @BeforeEach
    void drainEvents() {
        events.clear();
    }

    private OrderEvent consumeEvent(Duration timeout, Predicate<OrderEvent> predicate) throws InterruptedException {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            ConsumerRecord<String, String> rec = events.poll(200, TimeUnit.MILLISECONDS);
            if (rec == null) continue;
            try {
                OrderEvent evt = objectMapper.readValue(rec.value(), OrderEvent.class);
                if (predicate.test(evt)) return evt;
            } catch (IOException e) {
                throw new RuntimeException("failed to parse kafka event: " + rec.value(), e);
            }
        }
        throw new AssertionError("no matching order event within " + timeout);
    }

    private void enqueueProduct(UUID skuId) {
        productServer.enqueue(new MockResponse().setBody(
                "[{\"id\":\"" + skuId + "\",\"productName\":\"iPhone 16\",\"skuSpec\":\"黑\",\"price\":5999.00}]")
                .addHeader("Content-Type", "application/json"));
    }

    private void enqueueReserve(UUID skuId) {
        inventoryServer.enqueue(new MockResponse().setBody(
                "{\"success\":true,\"available\":{\"" + skuId + "\":10}}")
                .addHeader("Content-Type", "application/json"));
    }

    private UUID createPendingOrder(UUID userId, UUID skuId) {
        enqueueProduct(skuId);
        enqueueReserve(skuId);
        var resp = orderService.createOrder(userId,
                new OrderService.CreateOrderRequest(List.of(new OrderService.OrderLine(skuId, 1))));
        assertThat(resp.status()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        return resp.id();
    }

    @Test
    void fullFlow_placePayRefund() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID skuId = UUID.randomUUID();
        enqueueProduct(skuId);
        enqueueReserve(skuId);

        cartService.add(userId, new CartService.AddItemRequest(skuId, 1));
        assertThat(cartRepository.findByUserIdAndCheckedTrue(userId)).hasSize(1);

        var resp = orderService.createOrder(userId,
                new OrderService.CreateOrderRequest(List.of(new OrderService.OrderLine(skuId, 1))));
        assertThat(resp.id()).isNotNull();
        assertThat(resp.status()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(resp.totalAmount().compareTo(new BigDecimal("5999.00"))).isZero();

        // order placement clears the checked cart
        assertThat(cartRepository.findByUserIdAndCheckedTrue(userId)).isEmpty();

        orderService.pay(resp.id(), userId);
        Order paid = orderRepository.findById(resp.id()).orElseThrow();
        assertThat(paid.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(paid.getPaidAt()).isNotNull();

        assertThat(paymentRepository.findAll().stream().anyMatch(p -> p.getOrderId().equals(resp.id()))).isTrue();

        OrderEvent paidEvt = consumeEvent(Duration.ofSeconds(15), e ->
                e.type() == OrderEvent.EventType.PAID && e.orderId().equals(resp.id()));
        assertThat(paidEvt.items()).contains(new OrderEvent.Item(skuId, 1));

        // re-pay is illegal once PAID
        assertThatThrownBy(() -> orderService.pay(resp.id(), userId))
                .isInstanceOf(IllegalStateException.class);

        orderService.refund(resp.id(), userId);
        assertThat(orderRepository.findById(resp.id()).orElseThrow().getStatus()).isEqualTo(OrderStatus.REFUNDED);

        consumeEvent(Duration.ofSeconds(15), e ->
                e.type() == OrderEvent.EventType.REFUNDED && e.orderId().equals(resp.id()));

        // verify the cross-service calls hit the expected endpoints
        assertThat(productServer.takeRequest().getPath()).isEqualTo("/internal/skus/batch");
        assertThat(inventoryServer.takeRequest().getPath()).isEqualTo("/internal/inventory/reserve");
    }

    @Test
    void timeoutClose_persistsAndPublishesEvent() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID skuId = UUID.randomUUID();
        UUID orderId = createPendingOrder(userId, skuId);

        // backdate the order so it is older than the 15-minute timeout window
        Order order = orderRepository.findById(orderId).orElseThrow();
        order.setCreatedAt(Instant.now().minus(Duration.ofMinutes(20)));
        orderRepository.save(order);

        orderService.closeTimeoutOrders();

        // state change must have been committed (transactional through the Spring proxy)
        Order closed = orderRepository.findById(orderId).orElseThrow();
        assertThat(closed.getStatus()).isEqualTo(OrderStatus.CLOSED);
        assertThat(closed.getClosedAt()).isNotNull();

        OrderEvent closedEvt = consumeEvent(Duration.ofSeconds(15), e ->
                e.type() == OrderEvent.EventType.CLOSED && e.orderId().equals(orderId));
        assertThat(closedEvt.items()).contains(new OrderEvent.Item(skuId, 1));
    }

    @Test
    void illegalStateTransitionsThrow() throws Exception {
        UUID userId = UUID.randomUUID();
        UUID skuId = UUID.randomUUID();
        UUID orderId = createPendingOrder(userId, skuId);

        // ship requires PAID
        assertThatThrownBy(() -> orderService.ship(orderId, userId))
                .isInstanceOf(IllegalStateException.class);

        orderService.pay(orderId, userId);

        // cancel requires PENDING_PAYMENT
        assertThatThrownBy(() -> orderService.cancel(orderId, userId))
                .isInstanceOf(IllegalStateException.class);
    }
}
