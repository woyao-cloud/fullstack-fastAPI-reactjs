package com.product.dto.response;

import java.util.UUID;

public record BrandResponse(
        UUID id,
        String name,
        String logoUrl,
        String description,
        int sortOrder
) {}
