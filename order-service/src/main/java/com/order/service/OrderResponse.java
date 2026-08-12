package com.order.service;

import com.order.domain.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(UUID id, String orderNo, OrderStatus status, BigDecimal totalAmount,
                            Instant paidAt, Instant closedAt, List<OrderItemResponse> items) {
    public record OrderItemResponse(UUID skuId, String productName, String skuSpec,
                                    BigDecimal price, int quantity, BigDecimal subtotal) {}
}
