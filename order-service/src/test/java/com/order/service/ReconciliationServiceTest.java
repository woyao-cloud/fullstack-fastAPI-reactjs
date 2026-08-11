package com.order.service;

import com.order.client.InventoryClient;
import com.order.domain.entity.Order;
import com.order.domain.entity.OrderItem;
import com.order.domain.entity.OrderStatus;
import com.order.repository.OrderItemRepository;
import com.order.repository.OrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReconciliationServiceTest {

    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock InventoryClient inventoryClient;
    ReconciliationService service;

    @BeforeEach
    void setUp() {
        service = new ReconciliationService(orderRepository, orderItemRepository, inventoryClient);
    }

    private Order paidOrder(UUID id, Instant paidAt) {
        Order order = new Order();
        order.setId(id);
        order.setOrderNo("NO" + id.toString().substring(0, 6));
        order.setStatus(OrderStatus.PAID);
        order.setPaidAt(paidAt);
        return order;
    }

    private OrderItem item(UUID orderId, UUID skuId, int quantity) {
        OrderItem item = new OrderItem();
        item.setId(UUID.randomUUID());
        item.setSkuId(skuId);
        item.setQuantity(quantity);
        return item;
    }

    @Test
    void shouldFlagPaidOrderWithoutConfirmedInventory() {
        UUID orderId = UUID.randomUUID(), skuId = UUID.randomUUID();
        Order paid = paidOrder(orderId, Instant.now().minus(Duration.ofMinutes(30)));
        when(orderRepository.findByStatusAndPaidAtBefore(eq(OrderStatus.PAID), any()))
                .thenReturn(List.of(paid));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item(orderId, skuId, 5)));
        when(inventoryClient.getStock(skuId)).thenReturn(new InventoryClient.InventoryStock(skuId, 10, 0, 10));

        service.reconcile();

        assertThat(service.getAlertCount()).isGreaterThan(0);
        verify(inventoryClient).getStock(skuId);
    }

    @Test
    void shouldNotFlagPaidOrderWithSufficientFrozen() {
        UUID orderId = UUID.randomUUID(), skuId = UUID.randomUUID();
        Order paid = paidOrder(orderId, Instant.now().minus(Duration.ofMinutes(30)));
        when(orderRepository.findByStatusAndPaidAtBefore(eq(OrderStatus.PAID), any()))
                .thenReturn(List.of(paid));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(item(orderId, skuId, 5)));
        when(inventoryClient.getStock(skuId)).thenReturn(new InventoryClient.InventoryStock(skuId, 10, 5, 5));

        service.reconcile();

        assertThat(service.getAlertCount()).isZero();
        verify(inventoryClient).getStock(skuId);
    }

    @Test
    void shouldIgnoreRecentPaidOrders() {
        // 查询使用 10 分钟前的截止时间；近期支付（或在截止前未被选出）的订单不应触发告警
        when(orderRepository.findByStatusAndPaidAtBefore(eq(OrderStatus.PAID), any())).thenReturn(List.of());

        service.reconcile();

        assertThat(service.getAlertCount()).isZero();
        verifyNoInteractions(inventoryClient);

        ArgumentCaptor<Instant> captor = ArgumentCaptor.forClass(Instant.class);
        verify(orderRepository).findByStatusAndPaidAtBefore(eq(OrderStatus.PAID), captor.capture());
        Instant now = Instant.now();
        Instant expectedCutoff = now.minus(Duration.ofMinutes(10));
        assertThat(captor.getValue()).isBetween(expectedCutoff.minusSeconds(5), expectedCutoff.plusSeconds(5));
    }

    @Test
    void shouldFlagOnlyShortSkuInMultiSkuOrder() {
        UUID orderId = UUID.randomUUID(), shortSku = UUID.randomUUID(), fineSku = UUID.randomUUID();
        Order paid = paidOrder(orderId, Instant.now().minus(Duration.ofMinutes(30)));
        when(orderRepository.findByStatusAndPaidAtBefore(eq(OrderStatus.PAID), any()))
                .thenReturn(List.of(paid));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(
                item(orderId, shortSku, 2),
                item(orderId, fineSku, 1)));
        when(inventoryClient.getStock(shortSku)).thenReturn(new InventoryClient.InventoryStock(shortSku, 2, 0, 2));
        when(inventoryClient.getStock(fineSku)).thenReturn(new InventoryClient.InventoryStock(fineSku, 1, 1, 0));

        service.reconcile();

        // 只有 shortSku 冻结量不足，恰好 1 次告警
        assertThat(service.getAlertCount()).isEqualTo(1);
        verify(inventoryClient).getStock(shortSku);
        verify(inventoryClient).getStock(fineSku);
    }

    @Test
    void shouldContinueWhenGetStockFails() {
        UUID orderId = UUID.randomUUID(), badSku = UUID.randomUUID(), goodSku = UUID.randomUUID();
        Order paid = paidOrder(orderId, Instant.now().minus(Duration.ofMinutes(30)));
        when(orderRepository.findByStatusAndPaidAtBefore(eq(OrderStatus.PAID), any()))
                .thenReturn(List.of(paid));
        when(orderItemRepository.findByOrderId(orderId)).thenReturn(List.of(
                item(orderId, badSku, 2),
                item(orderId, goodSku, 1)));
        when(inventoryClient.getStock(badSku)).thenThrow(new RuntimeException("Feign 500"));
        when(inventoryClient.getStock(goodSku)).thenReturn(new InventoryClient.InventoryStock(goodSku, 1, 0, 1));

        service.reconcile();

        // badSku 查询失败被跳过，goodSku 不足仍告警 1 次，整体不中断
        assertThat(service.getAlertCount()).isEqualTo(1);
        verify(inventoryClient).getStock(badSku);
        verify(inventoryClient).getStock(goodSku);
    }
}
