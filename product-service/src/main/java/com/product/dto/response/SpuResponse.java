package com.product.dto.response;

import java.util.List;
import java.util.UUID;

public record SpuResponse(
        UUID id,
        String name,
        String description,
        CategoryResponse category,
        BrandResponse brand,
        String status,
        String coverImage,
        List<String> images,
        List<SpecTemplateResponse> specsTemplate,
        List<String> tags,
        List<SkuResponse> skus
) {
    public record SpecTemplateResponse(String key, List<String> values) {}
}
