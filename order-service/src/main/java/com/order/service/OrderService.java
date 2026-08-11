package com.order.service;

import com.order.client.InventoryClient;
import com.order.client.ProductClient;
import com.order.client.SkuSnapshot;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
import com.order.domain.entity.Payment;
import com.order.event.OrderEvent;
import com.order.event.OrderEventPublisher;
import com.order.repository.CartRepository;
import com.order.repository.OrderItemRepository;
import com.order.repository.OrderRepository;
import com.order.repository.PaymentRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
    private final PaymentRepository paymentRepository;

    public OrderService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
                        CartRepository cartRepository, InventoryClient inventoryClient,
                        ProductClient productClient, OrderEventPublisher publisher,
                        PaymentRepository paymentRepository) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.cartRepository = cartRepository;
        this.inventoryClient = inventoryClient;
        this.productClient = productClient;
        this.publisher = publisher;
        this.paymentRepository = paymentRepository;
    }

    public OrderResponse createOrder(UUID userId, CreateOrderRequest req) {
        if (req.lines().isEmpty()) {
            throw new IllegalArgumentException("订单至少包含一个商品");
        }
        for (OrderLine line : req.lines()) {
            if (line.quantity() < 1) {
                throw new IllegalArgumentException("购买数量必须大于0");
            }
        }
        List<UUID> skuIds = req.lines().stream().map(l -> l.skuId()).toList();
        if (skuIds.stream().distinct().count() != skuIds.size()) {
            throw new IllegalArgumentException("订单行存在重复SKU");
        }
        List<SkuSnapshot> snapshots = productClient.batchSkus(skuIds);
        Set<UUID> snapshotIds = new HashSet<>();
        for (SkuSnapshot s : snapshots) {
            snapshotIds.add(s.id());
        }
        for (OrderLine line : req.lines()) {
            if (!snapshotIds.contains(line.skuId())) {
                throw new IllegalArgumentException("商品不存在: " + line.skuId());
            }
        }
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
            it.setOrder(saved);
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
            return toResponse(saved); // 保留记录，可对账
        }
        cartRepository.deleteByUserIdAndCheckedTrue(userId);
        return toResponse(saved);
    }

    public OrderResponse getOrder(UUID orderId, UUID userId) {
        return orderRepository.findByIdAndUserId(orderId, userId).map(OrderService::toResponse)
                .orElseThrow(() -> new IllegalArgumentException("订单不存在: " + orderId));
    }

    private static OrderResponse toResponse(Order order) {
        return new OrderResponse(order.getId(), order.getOrderNo(), order.getStatus(),
                order.getTotalAmount(), order.getPaidAt(), order.getClosedAt());
    }

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

    public void cancel(UUID orderId, UUID userId) {
        Order order = requireOrder(orderId, userId);
        requireStatus(order, OrderStatus.PENDING_PAYMENT);
        order.setStatus(OrderStatus.CLOSED);
        order.setClosedAt(java.time.Instant.now());
        publisher.publish(OrderEvent.EventType.CANCELLED, orderId, order.getOrderNo(), itemsOf(orderId));
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

    public record CreateOrderRequest(@NotEmpty(message = "订单至少包含一个商品") List<@Valid OrderLine> lines) {}
    public record OrderLine(UUID skuId, @Min(value = 1, message = "购买数量必须大于0") int quantity) {}
}
