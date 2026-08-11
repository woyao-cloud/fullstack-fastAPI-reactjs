package com.product.dto.response;

import java.math.BigDecimal;
import java.util.UUID;

public record SkuSnapshot(UUID id, String productName, String skuSpec, BigDecimal price) {}
