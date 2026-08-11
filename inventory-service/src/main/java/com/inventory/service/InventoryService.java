package com.inventory.service;

import com.inventory.domain.entity.Inventory;
import com.inventory.dto.InventoryStock;
import com.inventory.dto.ReserveItem;
import com.inventory.dto.ReserveResult;
import com.inventory.repository.InventoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class InventoryService {

    private final InventoryRepository inventoryRepository;

    public InventoryService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    public ReserveResult reserve(List<ReserveItem> items) {
        Map<UUID, Integer> available = new HashMap<>();
        for (ReserveItem item : items) {
            Inventory inv = load(item.skuId());
            if (inv.available() < item.quantity()) {
                available.put(item.skuId(), inv.available());
                return new ReserveResult(false, available);
            }
        }
        for (ReserveItem item : items) {
            Inventory inv = load(item.skuId());
            inv.setFrozen(inv.getFrozen() + item.quantity());
            available.put(item.skuId(), inv.available());
        }
        return new ReserveResult(true, available);
    }

    public void confirm(UUID skuId, int quantity) {
        Inventory inv = load(skuId);
        inv.setQuantity(inv.getQuantity() - quantity);
        inv.setFrozen(inv.getFrozen() - quantity);
    }

    public void release(UUID skuId, int quantity) {
        Inventory inv = load(skuId);
        inv.setFrozen(inv.getFrozen() - quantity);
    }

    public void restock(UUID skuId, int quantity) {
        Inventory inv = inventoryRepository.findById(skuId).orElseGet(() -> {
            Inventory i = new Inventory();
            i.setSkuId(skuId);
            return inventoryRepository.save(i);
        });
        inv.setQuantity(inv.getQuantity() + quantity);
    }

    @Transactional(readOnly = true)
    public InventoryStock getStock(UUID skuId) {
        Inventory inv = inventoryRepository.findById(skuId)
                .orElseThrow(() -> new IllegalArgumentException("库存不存在: " + skuId));
        return new InventoryStock(inv.getSkuId(), inv.getQuantity(), inv.getFrozen(), inv.available());
    }

    private Inventory load(UUID skuId) {
        return inventoryRepository.findByIdForUpdate(skuId)
                .orElseThrow(() -> new IllegalArgumentException("库存不存在: " + skuId));
    }
}
