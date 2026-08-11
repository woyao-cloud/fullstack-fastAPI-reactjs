package com.inventory.service;

import com.inventory.domain.entity.Inventory;
import com.inventory.dto.ReserveItem;
import com.inventory.repository.InventoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InventoryServiceTest {
    @Mock InventoryRepository repo;
    InventoryService service;

    @BeforeEach
    void setUp() { service = new InventoryService(repo); }

    private Inventory stock(int qty, int frozen) {
        var i = new Inventory();
        i.setSkuId(UUID.randomUUID()); i.setQuantity(qty); i.setFrozen(frozen);
        return i;
    }

    @Test
    void shouldReserve() {
        var inv = stock(10, 0);
        when(repo.findByIdForUpdate(inv.getSkuId())).thenReturn(Optional.of(inv));
        var r = service.reserve(List.of(new ReserveItem(inv.getSkuId(), 3)));
        assertThat(r.success()).isTrue();
        assertThat(inv.getFrozen()).isEqualTo(3);
    }

    @Test
    void shouldFailReserveWhenInsufficient() {
        var inv = stock(2, 0);
        when(repo.findByIdForUpdate(inv.getSkuId())).thenReturn(Optional.of(inv));
        var r = service.reserve(List.of(new ReserveItem(inv.getSkuId(), 5)));
        assertThat(r.success()).isFalse();
        assertThat(inv.getFrozen()).isZero();
    }

    @Test
    void shouldConfirmAndRelease() {
        var inv = stock(10, 5);
        when(repo.findByIdForUpdate(inv.getSkuId())).thenReturn(Optional.of(inv));
        service.confirm(inv.getSkuId(), 3);   // quantity 7, frozen 2
        assertThat(inv.getQuantity()).isEqualTo(7);
        assertThat(inv.getFrozen()).isEqualTo(2);
        service.release(inv.getSkuId(), 2);   // frozen 0
        assertThat(inv.getFrozen()).isZero();
    }
}
