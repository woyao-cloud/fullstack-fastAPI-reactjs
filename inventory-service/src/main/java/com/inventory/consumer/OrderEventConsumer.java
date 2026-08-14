package com.inventory.consumer;

import com.inventory.domain.entity.InventoryEvent;
import com.inventory.event.OrderEvent;
import com.inventory.repository.InventoryEventRepository;
import com.inventory.service.InventoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OrderEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(OrderEventConsumer.class);

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
            try {
                switch (event.type()) {
                    case PAID -> inventoryService.confirm(item.skuId(), item.quantity());
                    case CLOSED, CANCELLED -> inventoryService.release(item.skuId(), item.quantity());
                    case REFUNDED -> inventoryService.restock(item.skuId(), item.quantity());
                }
            } catch (IllegalArgumentException | IllegalStateException e) {
                // 单条毒 item(如 SKU 不存在、数量非法、库存状态不一致): 记录后跳过该条, 继续处理其余 items,
                // 避免一条失败导致整单后续 item 永不应用(review: 多行事件部分应用后永久去重); 异常写日志供运维排查
                log.error("跳过不可处理的订单事件 item eventId={} type={} orderId={} skuId={}: {}",
                        event.eventId(), event.type(), event.orderId(), item.skuId(), e.getMessage());
            }
        }
        // 无论处理成败都落幂等记录, 确保同一 eventId 不重复投递
        InventoryEvent ie = new InventoryEvent();
        ie.setEventId(event.eventId());
        ie.setOrderId(event.orderId());
        ie.setType(event.type().name());
        ie.setCreatedAt(event.timestamp());
        eventRepository.save(ie);
    }
}
