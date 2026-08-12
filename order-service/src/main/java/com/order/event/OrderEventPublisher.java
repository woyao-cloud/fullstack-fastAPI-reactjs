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

    public void publish(OrderEvent.EventType type, UUID orderId, String orderNo, List<OrderEvent.Item> items) {
        // key=orderId 保证同一订单事件落在同一分区按序消费; eventId 由 (orderId,type) 确定性生成,
        // 下游可按 eventId 幂等去重(重发不产生新 id) (review C2)
        UUID eventId = UUID.nameUUIDFromBytes((orderId + ":" + type).getBytes(StandardCharsets.UTF_8));
        OrderEvent event = new OrderEvent(eventId, orderId, orderNo, type, items, Instant.now());
        kafkaTemplate.send("order-events", orderId.toString(), event);
    }
}
