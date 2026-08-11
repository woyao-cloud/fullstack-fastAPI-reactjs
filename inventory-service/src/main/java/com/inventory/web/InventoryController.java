package com.inventory.web;

import com.inventory.dto.InventoryStock;
import com.inventory.dto.ReserveRequest;
import com.inventory.dto.ReserveResult;
import com.inventory.service.InventoryService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/internal/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) { this.inventoryService = inventoryService; }

    @PostMapping("/reserve")
    public ReserveResult reserve(@RequestBody ReserveRequest req) {
        return inventoryService.reserve(req.items());
    }

    @PostMapping("/restock")
    public void restock(@RequestBody Map<String, Object> body) {
        inventoryService.restock(UUID.fromString((String) body.get("skuId")), (Integer) body.get("quantity"));
    }

    @GetMapping("/{skuId}")
    public InventoryStock getStock(@PathVariable UUID skuId) {
        return inventoryService.getStock(skuId);
    }
}
