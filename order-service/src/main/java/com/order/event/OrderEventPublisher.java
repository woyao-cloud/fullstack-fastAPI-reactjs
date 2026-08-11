package com.order.event;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

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
        kafkaTemplate.send("order-events", new OrderEvent(UUID.randomUUID(), orderId, orderNo, type, items, Instant.now()));
    }
}
