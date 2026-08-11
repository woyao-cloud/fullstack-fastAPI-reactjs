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
        InventoryEvent ie = new InventoryEvent();
        ie.setEventId(event.eventId());
        ie.setOrderId(event.orderId());
        ie.setType(event.type().name());
        ie.setCreatedAt(event.timestamp());
        eventRepository.save(ie);
    }
}
