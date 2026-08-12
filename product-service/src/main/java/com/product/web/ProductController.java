package com.product.web;

import com.product.domain.entity.SpuStatus;
import com.product.dto.request.ProductSearchRequest;
import com.product.dto.request.SpuCreateRequest;
import com.product.dto.response.PageResponse;
import com.product.dto.response.SpuResponse;
import com.product.service.read.ProductQueryService;
import com.product.service.write.SpuWriteService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/products")
public class ProductController {

    private final SpuWriteService writeService;
    private final ProductQueryService queryService;

    public ProductController(SpuWriteService writeService, ProductQueryService queryService) {
        this.writeService = writeService;
        this.queryService = queryService;
    }

    @PostMapping
    public SpuResponse create(@Valid @RequestBody SpuCreateRequest req) { return writeService.create(req); }

    @PutMapping("/{id}")
    public SpuResponse update(@PathVariable UUID id, @Valid @RequestBody SpuCreateRequest req) { return writeService.update(id, req); }

    @PatchMapping("/{id}/status")
    public void changeStatus(@PathVariable UUID id, @RequestBody SpuStatus status) { writeService.changeStatus(id, status); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { writeService.delete(id); }

    @GetMapping("/{id}")
    public SpuResponse detail(@PathVariable UUID id) { return queryService.detail(id); }

    @GetMapping("/search")
    public PageResponse<SpuResponse> search(ProductSearchRequest req) { return queryService.search(req); }
}
