package com.product.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record SpuCreateRequest(
        @NotBlank @Size(max = 200) String name,
        String description,
        @NotNull UUID categoryId,
        UUID brandId,
        String coverImage,
        List<String> images,
        List<SpecTemplate> specsTemplate,
        List<String> tags,
        @NotEmpty List<SkuRequest> skus
) {
    public record SpecTemplate(String key, List<String> values) {}
}
