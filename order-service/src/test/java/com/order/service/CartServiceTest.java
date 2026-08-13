package com.order.service;

import com.order.client.ProductClient;
import com.order.client.SkuSnapshot;
import com.order.domain.entity.Cart;
import com.order.repository.CartRepository;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {
    @Mock CartRepository repo;
    @Mock ProductClient productClient;
    CartService service;

    @BeforeEach
    void setUp() { service = new CartService(repo, productClient); }

    @Test
    void shouldAddAndAccumulateQuantity() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        Cart existing = new Cart(); existing.setQuantity(1);
        when(repo.findByUserIdAndSkuId(userId, skuId)).thenReturn(Optional.of(existing));

        service.add(userId, new CartService.AddItemRequest(skuId, 2));

        assertThat(existing.getQuantity()).isEqualTo(3);
    }

    @Test
    void listReturnsAllRowsEnrichedWithProductInfo() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        Cart c = new Cart();
        c.setUserId(userId); c.setSkuId(skuId); c.setQuantity(2); c.setChecked(true);
        when(repo.findByUserId(userId)).thenReturn(List.of(c));
        when(productClient.batchSkus(List.of(skuId)))
                .thenReturn(List.of(new SkuSnapshot(skuId, "测试商品", "{\"颜色\":\"红\"}", new BigDecimal("9.90"))));

        List<CartService.CartItemResponse> rows = service.list(userId);

        assertThat(rows).hasSize(1);
        CartService.CartItemResponse row = rows.get(0);
        assertThat(row.skuId()).isEqualTo(skuId);
        assertThat(row.quantity()).isEqualTo(2);
        assertThat(row.checked()).isTrue();
        assertThat(row.productName()).isEqualTo("测试商品");
        assertThat(row.price()).isEqualByComparingTo("9.90");
    }

    @Test
    void listReturnsEmptyWhenNoRows() {
        UUID userId = UUID.randomUUID();
        when(repo.findByUserId(userId)).thenReturn(List.of());
        assertThat(service.list(userId)).isEmpty();
    }
}
