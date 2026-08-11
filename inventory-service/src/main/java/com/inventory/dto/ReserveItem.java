package com.inventory.dto;

import java.util.UUID;

public record ReserveItem(UUID skuId, int quantity) {}
