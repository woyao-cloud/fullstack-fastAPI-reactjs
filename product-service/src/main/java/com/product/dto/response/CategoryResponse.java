package com.product.dto.response;

import java.util.List;
import java.util.UUID;

public record CategoryResponse(
        UUID id,
        String name,
        String slug,
        UUID parentId,
        int sortOrder,
        String icon,
        boolean isActive,
        List<CategoryResponse> children
) {}
