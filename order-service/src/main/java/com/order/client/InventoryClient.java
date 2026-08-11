package com.order.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@FeignClient(name = "inventory-service", url = "${inventory.service.url}")
public interface InventoryClient {
    @PostMapping("/internal/inventory/reserve")
    ReserveResult reserve(@RequestBody ReserveRequest request);

    @GetMapping("/internal/inventory/{skuId}")
    InventoryStock getStock(@PathVariable UUID skuId);

    record ReserveRequest(List<ReserveItem> items) {}
    record ReserveItem(UUID skuId, int quantity) {}
    record ReserveResult(boolean success, Map<UUID, Integer> available) {}
    record InventoryStock(UUID skuId, int quantity, int frozen, int available) {}
}
