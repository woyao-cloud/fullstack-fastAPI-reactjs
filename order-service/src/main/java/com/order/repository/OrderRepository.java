package com.order.repository;

import com.order.domain.entity.Order;
import com.order.domain.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByIdAndUserId(UUID id, UUID userId);
    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, Instant before);
}
