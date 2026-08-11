package com.order.service;

import com.order.client.InventoryClient;
import com.order.client.ProductClient;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
import com.order.domain.entity.Payment;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderPayRefundTest {
    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock CartRepository cartRepository;
    @Mock InventoryClient inventoryClient;
    @Mock ProductClient productClient;
    @Mock OrderEventPublisher publisher;
    @Mock PaymentRepository paymentRepository;
    OrderService service;
    OrderItem item;

    @BeforeEach
    void setUp() {
        OrderItem it = new OrderItem();
        it.setSkuId(UUID.randomUUID());
        it.setQuantity(2);
        item = it;
        service = new OrderService(orderRepository, orderItemRepository, cartRepository,
                inventoryClient, productClient, publisher, paymentRepository);
    }

    @Test
    void shouldPayAndPublishPaidEvent() {
        UUID userId = UUID.randomUUID(), orderId = UUID.randomUUID();
        Order order = new Order(); order.setId(orderId); order.setStatus(OrderStatus.PENDING_PAYMENT);
        order.setPayAmount(new BigDecimal("5999.00"));
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));
        when(paymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.pay(orderId, userId);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.PAID);
        verify(publisher).publish(eq(OrderEvent.EventType.PAID), eq(orderId), any(), any());
    }

    @Test
    void shouldRejectPayWhenNotPending() {
        Order order = new Order(); order.setId(UUID.randomUUID()); order.setStatus(OrderStatus.PAID);
        when(orderRepository.findByIdAndUserId(any(), any())).thenReturn(Optional.of(order));
        assertThatThrownBy(() -> service.pay(order.getId(), UUID.randomUUID()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void shouldRefundPaidOrderAndPublishRefundedEvent() {
        UUID userId = UUID.randomUUID(), orderId = UUID.randomUUID();
        Order order = new Order(); order.setId(orderId); order.setStatus(OrderStatus.PAID);
        when(orderRepository.findByIdAndUserId(orderId, userId)).thenReturn(Optional.of(order));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item));

        service.refund(orderId, userId);

        assertThat(order.getStatus()).isEqualTo(OrderStatus.REFUNDED);
        verify(publisher).publish(eq(OrderEvent.EventType.REFUNDED), eq(orderId), any(), any());
    }
}
