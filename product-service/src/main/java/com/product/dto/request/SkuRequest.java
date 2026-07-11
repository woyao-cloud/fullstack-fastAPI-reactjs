package com.product.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record SkuRequest(
        @NotNull Map<String, String> specs,
        @NotNull @Positive BigDecimal price,
        int stock,
        @NotBlank @Size(max = 50) String skuCode,
        String barCode,
        BigDecimal weight,
        List<String> images
) {}
