package com.order.event;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
public class OrderEventPublisher {

    private final KafkaTemplate<String, OrderEvent> kafkaTemplate;

    public OrderEventPublisher(KafkaTemplate<String, OrderEvent> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    // 投递语义: at-most-once —— publishAfterCommit 在事务提交后异步 kafkaTemplate.send(),
    // commit 与 send 之间的进程崩溃会丢失该事件(无重试/无 outbox)。
    // 损失有界: 下游按确定性 eventId 幂等(重发安全); PENDING_PAYMENT 超时关闭会兜底释放冻结库存。
    // 事务性 outbox 已记录为后续立项(Task #66 Fix ② 决策)。
    public void publish(OrderEvent.EventType type, UUID orderId, String orderNo, List<OrderEvent.Item> items) {
        // key=orderId 保证同一订单事件落在同一分区按序消费; eventId 由 (orderId,type) 确定性生成,
        // 下游可按 eventId 幂等去重(重发不产生新 id) (review C2)
        UUID eventId = UUID.nameUUIDFromBytes((orderId + ":" + type).getBytes(StandardCharsets.UTF_8));
        OrderEvent event = new OrderEvent(eventId, orderId, orderNo, type, items, Instant.now());
        kafkaTemplate.send("order-events", orderId.toString(), event);
    }
}
