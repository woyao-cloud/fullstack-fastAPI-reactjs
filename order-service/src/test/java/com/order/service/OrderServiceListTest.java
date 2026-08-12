package com.order.service;

import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
import com.order.repository.OrderItemRepository;
import com.order.repository.OrderRepository;
import com.order.web.PageResponse;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OrderServiceListTest {

    private final OrderRepository orderRepository = mock(OrderRepository.class);
    private final OrderItemRepository orderItemRepository = mock(OrderItemRepository.class);
    private final OrderService orderService = new OrderService(orderRepository, orderItemRepository,
            mock(com.order.repository.CartRepository.class), mock(com.order.client.InventoryClient.class),
            mock(com.order.client.ProductClient.class), mock(com.order.event.OrderEventPublisher.class),
            mock(com.order.repository.PaymentRepository.class));

    private Order order(UUID id, String no) {
        Order o = new Order();
        o.setId(id);
        o.setOrderNo(no);
        o.setUserId(UUID.randomUUID());
        o.setStatus(OrderStatus.PENDING_PAYMENT);
        o.setTotalAmount(new BigDecimal("99.00"));
        o.setPayAmount(new BigDecimal("99.00"));
        return o;
    }

    @Test
    void listOrdersReturnsPageWithItems() {
        UUID userId = UUID.randomUUID();
        Order o = order(UUID.randomUUID(), "NO1");
        when(orderRepository.findByUserId(eq(userId), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(o)));
        OrderItem item = new OrderItem();
        item.setSkuId(UUID.randomUUID());
        item.setProductName("商品A");
        item.setSkuSpec("红色");
        item.setPrice(new BigDecimal("99.00"));
        item.setQuantity(1);
        item.setSubtotal(new BigDecimal("99.00"));
        when(orderItemRepository.findByOrderId(o.getId())).thenReturn(List.of(item));

        PageResponse<OrderResponse> result = orderService.listOrders(userId, null, 0, 20);

        assertThat(result.total()).isEqualTo(1);
        assertThat(result.items().get(0).items()).hasSize(1);
        assertThat(result.items().get(0).items().get(0).productName()).isEqualTo("商品A");
        verify(orderRepository).findByUserId(eq(userId), any(Pageable.class));
    }

    @Test
    void listOrdersFiltersByStatus() {
        UUID userId = UUID.randomUUID();
        when(orderRepository.findByUserIdAndStatus(eq(userId), eq(OrderStatus.PAID), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(order(UUID.randomUUID(), "NO2"))));
        when(orderItemRepository.findByOrderId(any())).thenReturn(List.of());

        PageResponse<OrderResponse> result = orderService.listOrders(userId, OrderStatus.PAID, 0, 20);

        assertThat(result.total()).isEqualTo(1);
        verify(orderRepository).findByUserIdAndStatus(eq(userId), eq(OrderStatus.PAID), any(Pageable.class));
    }
}
