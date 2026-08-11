package com.order.service;

import com.order.domain.entity.Cart;
import com.order.repository.CartRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CartServiceTest {
    @Mock CartRepository repo;
    CartService service;

    @BeforeEach
    void setUp() { service = new CartService(repo); }

    @Test
    void shouldAddAndAccumulateQuantity() {
        UUID userId = UUID.randomUUID(), skuId = UUID.randomUUID();
        Cart existing = new Cart(); existing.setQuantity(1);
        when(repo.findByUserIdAndSkuId(userId, skuId)).thenReturn(Optional.of(existing));

        service.add(userId, new CartService.AddItemRequest(skuId, 2));

        assertThat(existing.getQuantity()).isEqualTo(3);
    }
}
