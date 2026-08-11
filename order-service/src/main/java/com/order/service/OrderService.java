package com.order.service;

import com.order.client.InventoryClient;
import com.order.client.ProductClient;
import com.order.client.SkuSnapshot;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
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

    public OrderResponse createOrder(UUID userId, CreateOrderRequest req) {
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

    private static OrderResponse toResponse(Order order) {
        return new OrderResponse(order.getId(), order.getOrderNo(), order.getStatus(),
                order.getTotalAmount(), order.getPaidAt(), order.getClosedAt());
    }

    public record CreateOrderRequest(List<OrderLine> lines) {}
    public record OrderLine(UUID skuId, int quantity) {}
}
