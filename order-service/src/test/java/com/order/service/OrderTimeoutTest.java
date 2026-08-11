package com.order.service;

import com.order.client.InventoryClient;
import com.order.client.ProductClient;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderStatus;
import com.order.event.OrderEvent;
import com.order.event.OrderEventPublisher;
import com.order.repository.CartRepository;
import com.order.repository.OrderItemRepository;
import com.order.repository.OrderRepository;
import com.order.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderTimeoutTest {
    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock CartRepository cartRepository;
    @Mock InventoryClient inventoryClient;
    @Mock ProductClient productClient;
    @Mock OrderEventPublisher publisher;
    @Mock PaymentRepository paymentRepository;
    OrderService service;

    @BeforeEach
    void setUp() {
        service = new OrderService(orderRepository, orderItemRepository, cartRepository,
                inventoryClient, productClient, publisher, paymentRepository);
    }

    @Test
    void shouldClosePendingOrdersOlderThanTimeout() {
        Order pending = new Order(); pending.setId(UUID.randomUUID());
        pending.setStatus(OrderStatus.PENDING_PAYMENT);
        when(orderRepository.findByStatusAndCreatedAtBefore(eq(OrderStatus.PENDING_PAYMENT), any()))
                .thenReturn(List.of(pending));
        service.closeTimeoutOrders();
        assertThat(pending.getStatus()).isEqualTo(OrderStatus.CLOSED);
        verify(publisher).publish(eq(OrderEvent.EventType.CLOSED), eq(pending.getId()), any(), any());
    }
}
