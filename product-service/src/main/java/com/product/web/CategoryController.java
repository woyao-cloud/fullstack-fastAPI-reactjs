package com.product.web;

import com.product.dto.request.CategoryRequest;
import com.product.dto.response.CategoryResponse;
import com.product.service.write.CategoryWriteService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    private final CategoryWriteService service;

    public CategoryController(CategoryWriteService service) { this.service = service; }

    @GetMapping("/tree")
    public List<CategoryResponse> tree() { return service.getTree(); }

    @PostMapping
    public CategoryResponse create(@Valid @RequestBody CategoryRequest req) { return service.create(req); }

    @PutMapping("/{id}")
    public CategoryResponse update(@PathVariable UUID id, @Valid @RequestBody CategoryRequest req) { return service.update(id, req); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { service.delete(id); }
}
