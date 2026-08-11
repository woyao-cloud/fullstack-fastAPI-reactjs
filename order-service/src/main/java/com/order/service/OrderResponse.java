package com.order.service;

import com.order.domain.entity.OrderStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record OrderResponse(UUID id, String orderNo, OrderStatus status, BigDecimal totalAmount,
                            Instant paidAt, Instant closedAt) {}
