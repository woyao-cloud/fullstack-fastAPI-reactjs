package com.inventory.event;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderEvent(
        UUID eventId, UUID orderId, String orderNo, EventType type,
        List<Item> items, Instant timestamp) {
    public enum EventType { PAID, CLOSED, CANCELLED, REFUNDED }
    public record Item(UUID skuId, int quantity) {}
}
