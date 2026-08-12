package com.inventory.service;

import com.inventory.domain.entity.Inventory;
import com.inventory.dto.InventoryStock;
import com.inventory.dto.ReserveItem;
import com.inventory.dto.ReserveResult;
import com.inventory.repository.InventoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashMap;
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
        // 按 SKU 聚合数量, 防止同 SKU 重复行绕过可用校验造成超卖 (review C1)
        Map<UUID, Integer> qtyBySku = new LinkedHashMap<>();
        for (ReserveItem item : items) {
            if (item.quantity() <= 0) {
                throw new IllegalArgumentException("预扣数量必须大于0: " + item.skuId());
            }
            qtyBySku.merge(item.skuId(), item.quantity(), Integer::sum);
        }
        Map<UUID, Integer> available = new HashMap<>();
        for (Map.Entry<UUID, Integer> e : qtyBySku.entrySet()) {
            Inventory inv = load(e.getKey());
            if (inv.available() < e.getValue()) {
                available.put(e.getKey(), inv.available());
                return new ReserveResult(false, available);
            }
        }
        for (Map.Entry<UUID, Integer> e : qtyBySku.entrySet()) {
            Inventory inv = load(e.getKey());
            inv.setFrozen(inv.getFrozen() + e.getValue());
            available.put(e.getKey(), inv.available());
        }
        return new ReserveResult(true, available);
    }

    public void confirm(UUID skuId, int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("确认数量必须大于0: " + skuId);
        }
        Inventory inv = load(skuId);
        // 无预扣/重复确认/数量不足时禁止扣减, 防止负库存 (review C2)
        if (inv.getFrozen() < quantity || inv.getQuantity() < quantity) {
            throw new IllegalStateException("库存或预扣不足, 无法确认: " + skuId);
        }
        inv.setQuantity(inv.getQuantity() - quantity);
        inv.setFrozen(inv.getFrozen() - quantity);
    }

    public void release(UUID skuId, int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("释放数量必须大于0: " + skuId);
        }
        Inventory inv = load(skuId);
        // 防止已确认订单被重复释放导致 frozen 为负 (review C2)
        if (inv.getFrozen() < quantity) {
            throw new IllegalStateException("预扣不足, 无法释放: " + skuId);
        }
        inv.setFrozen(inv.getFrozen() - quantity);
    }

    public void restock(UUID skuId, int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("补货数量必须大于0: " + skuId);
        }
        // 用行锁读取, 避免与 confirm/reserve 并发时覆盖已提交的扣减 (review I1);
        // 保留"库存行不存在时自动创建"的语义
        Inventory inv = inventoryRepository.findByIdForUpdate(skuId).orElseGet(() -> {
            Inventory i = new Inventory();
            i.setSkuId(skuId);
            i.setQuantity(0);
            i.setFrozen(0);
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
