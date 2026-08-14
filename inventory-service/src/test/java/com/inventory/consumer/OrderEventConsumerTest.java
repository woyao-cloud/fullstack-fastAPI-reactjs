package com.inventory.consumer;

import com.inventory.domain.entity.InventoryEvent;
import com.inventory.event.OrderEvent;
import com.inventory.repository.InventoryEventRepository;
import com.inventory.service.InventoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

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

    @Test
    void shouldApplyAllItemsAndPersistDedupEvenWhenOneFails() {
        var sku1 = UUID.randomUUID();
        var sku2 = UUID.randomUUID();
        var ev = new OrderEvent(UUID.randomUUID(), UUID.randomUUID(), "NO1",
                OrderEvent.EventType.PAID,
                List.of(new OrderEvent.Item(sku1, 2), new OrderEvent.Item(sku2, 3)), Instant.now());
        when(eventRepo.existsById(ev.eventId())).thenReturn(false);
        // item2 为毒 item: confirm 抛 IAE, 应被吞掉并继续处理其余 items。
        // 用 lenient(): strict 模式下同一方法的其他实参调用(confirm(sku1,2))会触发 PotentialStubbingProblem
        lenient().doThrow(new IllegalArgumentException("sku not found")).when(inventoryService).confirm(sku2, 3);

        consumer.onOrderEvent(ev);

        // item1 已应用, item2 异常被吞(不中断循环), 幂等记录无条件落库
        verify(inventoryService).confirm(sku1, 2);
        verify(inventoryService).confirm(sku2, 3);
        verify(eventRepo).save(any(InventoryEvent.class));
    }
}
