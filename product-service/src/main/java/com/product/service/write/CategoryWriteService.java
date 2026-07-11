package com.product.service.write;

import com.product.domain.entity.Category;
import com.product.dto.request.CategoryRequest;
import com.product.dto.response.CategoryResponse;
import com.product.repository.CategoryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class CategoryWriteService {

    private final CategoryRepository categoryRepository;

    public CategoryWriteService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    public CategoryResponse create(CategoryRequest request) {
        if (categoryRepository.existsBySlug(request.slug())) {
            throw new IllegalArgumentException("slug 已存在: " + request.slug());
        }

        Category category = new Category();
        category.setName(request.name());
        category.setSlug(request.slug());
        category.setSortOrder(request.sortOrder());
        category.setIcon(request.icon());
        category.setActive(request.isActive());

        if (request.parentId() != null) {
            Category parent = categoryRepository.findById(request.parentId())
                    .orElseThrow(() -> new IllegalArgumentException("父分类不存在: " + request.parentId()));
            category.setParent(parent);
        }

        Category saved = categoryRepository.save(category);
        return toResponse(saved);
    }

    public CategoryResponse update(UUID id, CategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("分类不存在: " + id));

        if (!category.getSlug().equals(request.slug())
                && categoryRepository.existsBySlug(request.slug())) {
            throw new IllegalArgumentException("slug 已存在: " + request.slug());
        }

        category.setName(request.name());
        category.setSlug(request.slug());
        category.setSortOrder(request.sortOrder());
        category.setIcon(request.icon());
        category.setActive(request.isActive());

        if (request.parentId() != null) {
            Category parent = categoryRepository.findById(request.parentId())
                    .orElseThrow(() -> new IllegalArgumentException("父分类不存在: " + request.parentId()));
            category.setParent(parent);
        } else {
            category.setParent(null);
        }

        return toResponse(categoryRepository.save(category));
    }

    public void delete(UUID id) {
        if (categoryRepository.existsByParentId(id)) {
            throw new IllegalStateException("该分类下有子分类，无法删除");
        }
        if (!categoryRepository.existsById(id)) {
            throw new IllegalArgumentException("分类不存在: " + id);
        }
        categoryRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> getTree() {
        List<Category> roots = categoryRepository.findRootCategories();
        return roots.stream().map(this::toTreeResponse).toList();
    }

    private CategoryResponse toTreeResponse(Category category) {
        List<CategoryResponse> children = category.getChildren().stream()
                .map(this::toTreeResponse)
                .toList();
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getParent() != null ? category.getParent().getId() : null,
                category.getSortOrder(),
                category.getIcon(),
                category.isActive(),
                children
        );
    }

    private CategoryResponse toResponse(Category category) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getParent() != null ? category.getParent().getId() : null,
                category.getSortOrder(),
                category.getIcon(),
                category.isActive(),
                List.of()
        );
    }
}
