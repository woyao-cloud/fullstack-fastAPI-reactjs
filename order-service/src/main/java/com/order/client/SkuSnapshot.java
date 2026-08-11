package com.order.client;

import java.util.UUID;

public record SkuSnapshot(UUID id, String productName, String skuSpec, java.math.BigDecimal price) {}
