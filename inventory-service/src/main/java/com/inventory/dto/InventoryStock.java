package com.inventory.dto;

import java.util.UUID;

public record InventoryStock(UUID skuId, int quantity, int frozen, int available) {}
