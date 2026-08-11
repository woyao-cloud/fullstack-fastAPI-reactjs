package com.order.service;

import com.order.client.InventoryClient;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
import com.order.repository.OrderItemRepository;
import com.order.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * 对账任务：扫描「已支付但超过10分钟未确认扣减」的订单，
 * 比对 inventory 冻结数，异常仅告警（日志 + 计数），不自动补偿，留作人工介入。
 */
@Service
public class ReconciliationService {

    private static final Logger log = LoggerFactory.getLogger(ReconciliationService.class);

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final InventoryClient inventoryClient;
    private final AtomicLong alertCount = new AtomicLong();

    public ReconciliationService(OrderRepository orderRepository, OrderItemRepository orderItemRepository,
                                 InventoryClient inventoryClient) {
        this.orderRepository = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.inventoryClient = inventoryClient;
    }

    @Scheduled(cron = "0 0 * * * *")
    public void reconcile() {
        Instant before = Instant.now().minus(Duration.ofMinutes(10));
        List<Order> overdue = orderRepository.findByStatusAndPaidAtBefore(OrderStatus.PAID, before);
        for (Order order : overdue) {
            Map<UUID, Integer> expected = expectedQuantities(order.getId());
            for (Map.Entry<UUID, Integer> e : expected.entrySet()) {
                int frozen;
                try {
                    frozen = inventoryClient.getStock(e.getKey()).frozen();
                } catch (RuntimeException ex) {
                    log.warn("[对账] 查询库存失败，跳过 orderNo={} skuId={}: {}", order.getOrderNo(), e.getKey(), ex.getMessage());
                    continue;
                }
                // 订单下单时 reserve 使 frozen += 应确认量；PAID 事件被 inventory 消费 confirm 后 frozen 相应下降。
                // 故「已支付但未确认扣减」= frozen 仍 ≥ 应确认量（扣减未反映），此时才告警。
                if (frozen >= e.getValue()) {
                    long n = alertCount.incrementAndGet();
                    log.warn("[对账] 已支付超时未确认扣减 orderNo={} skuId={} 应确认量={} 冻结量={} (累计告警 {})",
                            order.getOrderNo(), e.getKey(), e.getValue(), frozen, n);
                }
            }
        }
    }

    private Map<UUID, Integer> expectedQuantities(UUID orderId) {
        Map<UUID, Integer> expected = new LinkedHashMap<>();
        for (OrderItem item : orderItemRepository.findByOrderId(orderId)) {
            expected.merge(item.getSkuId(), item.getQuantity(), Integer::sum);
        }
        return expected;
    }

    public long getAlertCount() {
        return alertCount.get();
    }
}
