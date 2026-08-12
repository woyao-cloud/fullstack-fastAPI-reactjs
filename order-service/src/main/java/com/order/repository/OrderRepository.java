package com.order.repository;

import com.order.domain.entity.Order;
import com.order.domain.entity.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByIdAndUserId(UUID id, UUID userId);
    Page<Order> findByUserId(UUID userId, Pageable pageable);
    Page<Order> findByUserIdAndStatus(UUID userId, OrderStatus status, Pageable pageable);
    Page<Order> findByStatus(OrderStatus status, Pageable pageable);
    List<Order> findByStatusAndCreatedAtBefore(OrderStatus status, Instant before);
    List<Order> findByStatusAndPaidAtBefore(OrderStatus status, Instant before);
}
