package com.inventory.web;

import com.inventory.dto.InventoryStock;
import com.inventory.dto.ReserveRequest;
import com.inventory.dto.ReserveResult;
import com.inventory.dto.RestockRequest;
import com.inventory.service.InventoryService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/internal/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) { this.inventoryService = inventoryService; }

    @PostMapping("/reserve")
    public ReserveResult reserve(@Valid @RequestBody ReserveRequest req) {
        return inventoryService.reserve(req.items());
    }

    @PostMapping("/restock")
    public void restock(@Valid @RequestBody RestockRequest req) {
        inventoryService.restock(req.skuId(), req.quantity());
    }

    @GetMapping("/{skuId}")
    public InventoryStock getStock(@PathVariable UUID skuId) {
        return inventoryService.getStock(skuId);
    }
}
