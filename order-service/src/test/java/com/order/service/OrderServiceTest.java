package com.order.service;

import com.order.client.InventoryClient;
import com.order.client.ProductClient;
import com.order.client.SkuSnapshot;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
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
    void shouldCreateOrderWithReservedStock() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        var snapshot = new SkuSnapshot(skuId, "iPhone", "黑", new BigDecimal("5999.00"));
        when(productClient.batchSkus(List.of(skuId))).thenReturn(List.of(snapshot));
        when(inventoryClient.reserve(any())).thenReturn(
                new InventoryClient.ReserveResult(true, Map.of(skuId, 10)));
        when(orderRepository.save(any())).thenAnswer(inv -> { var o = inv.getArgument(0, Order.class); o.setId(UUID.randomUUID()); return o; });

        var result = service.createOrder(userId,
                new OrderService.CreateOrderRequest(List.of(new OrderService.OrderLine(skuId, 1))));

        assertThat(result.status()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        verify(orderItemRepository).saveAll(any());
    }

    @Test
    void shouldCloseOrderWhenReserveFails() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        var snapshot = new SkuSnapshot(skuId, "iPhone", "黑", new BigDecimal("5999.00"));
        when(productClient.batchSkus(List.of(skuId))).thenReturn(List.of(snapshot));
        when(inventoryClient.reserve(any())).thenReturn(
                new InventoryClient.ReserveResult(false, Map.of(skuId, 0)));
        when(orderRepository.save(any())).thenAnswer(inv -> { var o = inv.getArgument(0, Order.class); o.setId(UUID.randomUUID()); return o; });

        var result = service.createOrder(userId,
                new OrderService.CreateOrderRequest(List.of(new OrderService.OrderLine(skuId, 5))));

        assertThat(result.status()).isEqualTo(OrderStatus.CLOSED);
    }
}
