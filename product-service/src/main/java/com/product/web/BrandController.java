package com.product.web;

import com.product.dto.request.BrandRequest;
import com.product.dto.response.BrandResponse;
import com.product.dto.response.PageResponse;
import com.product.service.write.BrandWriteService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/brands")
public class BrandController {

    private final BrandWriteService service;

    public BrandController(BrandWriteService service) { this.service = service; }

    @GetMapping
    public PageResponse<BrandResponse> list(@RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        Page<BrandResponse> p = service.list(page, size);
        return new PageResponse<>(p.getContent(), p.getTotalElements(), page, size);
    }

    @PostMapping
    public BrandResponse create(@Valid @RequestBody BrandRequest req) { return service.create(req); }

    @PutMapping("/{id}")
    public BrandResponse update(@PathVariable UUID id, @Valid @RequestBody BrandRequest req) { return service.update(id, req); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { service.delete(id); }
}
