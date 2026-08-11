package com.order.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@FeignClient(name = "product-service", url = "${product.service.url}")
public interface ProductClient {
    @PostMapping("/internal/skus/batch")
    List<SkuSnapshot> batchSkus(@RequestBody List<UUID> skuIds);
}
