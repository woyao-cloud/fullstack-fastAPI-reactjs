package com.product.dto.request;

public record ProductSearchRequest(
        String q,
        String category,
        String brand,
        String minPrice,
        String maxPrice,
        String sort,
        int page,
        int size
) {
    public ProductSearchRequest {
        if (page < 0) page = 0;
        if (size <= 0) size = 20;
    }
}
