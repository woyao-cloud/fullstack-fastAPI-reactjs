package com.inventory.web;

import com.inventory.dto.InventoryStock;
import com.inventory.service.InventoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryAdminController {

    private final InventoryService inventoryService;

    public InventoryAdminController(InventoryService inventoryService) { this.inventoryService = inventoryService; }

    @GetMapping("/{skuId}")
    public InventoryStock getStock(@PathVariable UUID skuId) {
        return inventoryService.getStock(skuId);
    }
}
