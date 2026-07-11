package com.product.dto.response;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record SkuResponse(
        UUID id,
        Map<String, String> specs,
        BigDecimal price,
        int stock,
        int lockedStock,
        String skuCode,
        String barCode,
        BigDecimal weight,
        List<String> images,
        boolean isActive
) {}
