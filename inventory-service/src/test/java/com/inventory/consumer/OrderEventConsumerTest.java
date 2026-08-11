package com.inventory.consumer;

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
}
