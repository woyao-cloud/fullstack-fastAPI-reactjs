package com.product.web;

import com.product.dto.response.SkuSnapshot;
import com.product.service.read.ProductQueryService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/internal/skus")
public class InternalSkuController {

    private final ProductQueryService productQueryService;

    public InternalSkuController(ProductQueryService productQueryService) { this.productQueryService = productQueryService; }

    @PostMapping("/batch")
    public List<SkuSnapshot> batch(@RequestBody List<UUID> skuIds) {
        return productQueryService.batchSkus(skuIds);
    }
}
