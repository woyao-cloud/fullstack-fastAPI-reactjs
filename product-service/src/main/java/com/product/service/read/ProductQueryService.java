package com.product.service.read;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.domain.entity.Brand;
import com.product.domain.entity.Category;
import com.product.domain.entity.Sku;
import com.product.domain.entity.Spu;
import com.product.domain.entity.SpuStatus;
import com.product.dto.request.ProductSearchRequest;
import com.product.dto.response.BrandResponse;
import com.product.dto.response.CategoryResponse;
import com.product.dto.response.PageResponse;
import com.product.dto.response.SkuResponse;
import com.product.dto.response.SpuResponse;
import com.product.repository.SpuRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class ProductQueryService {

    private final SpuRepository spuRepository;
    private final ObjectMapper objectMapper;

    public ProductQueryService(SpuRepository spuRepository, ObjectMapper objectMapper) {
        this.spuRepository = spuRepository;
        this.objectMapper = objectMapper;
    }

    public SpuResponse detail(UUID id) {
        Spu spu = spuRepository.findByIdWithSkus(id)
                .orElseThrow(() -> new IllegalArgumentException("商品不存在: " + id));
        return toResponse(spu);
    }

    public PageResponse<SpuResponse> search(ProductSearchRequest req) {
        Specification<Spu> spec = (root, q, cb) -> {
            q.distinct(true); // skus 隐式 join 去重，防止同 SPU 多 SKU 匹配时翻页重复
            List<Predicate> ps = new ArrayList<>();
            ps.add(cb.equal(root.get("status"), SpuStatus.active));
            if (req.q() != null && !req.q().isBlank()) {
                ps.add(cb.like(cb.lower(root.get("name")), "%" + req.q().toLowerCase() + "%"));
            }
            if (req.category() != null && !req.category().isBlank()) {
                ps.add(cb.equal(root.get("category").get("slug"), req.category()));
            }
            if (req.brand() != null && !req.brand().isBlank()) {
                ps.add(cb.equal(root.get("brand").get("name"), req.brand()));
            }
            if (req.minPrice() != null && !req.minPrice().isBlank()) {
                ps.add(cb.greaterThanOrEqualTo(root.get("skus").get("price"), new BigDecimal(req.minPrice())));
            }
            if (req.maxPrice() != null && !req.maxPrice().isBlank()) {
                ps.add(cb.lessThanOrEqualTo(root.get("skus").get("price"), new BigDecimal(req.maxPrice())));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
        var page = spuRepository.findAll(spec, PageRequest.of(req.page(), req.size()));
        return new PageResponse<>(page.getContent().stream().map(this::toResponse).toList(),
                page.getTotalElements(), req.page(), req.size());
    }

    private SpuResponse toResponse(Spu spu) {
        return new SpuResponse(
                spu.getId(), spu.getName(), spu.getDescription(),
                toCategoryResponse(spu.getCategory()),
                spu.getBrand() != null ? toBrandResponse(spu.getBrand()) : null,
                spu.getStatus().name(), spu.getCoverImage(),
                readList(spu.getImages(), new TypeReference<List<String>>() {}),
                readList(spu.getSpecsTemplate(), new TypeReference<List<SpuResponse.SpecTemplateResponse>>() {}),
                readList(spu.getTags(), new TypeReference<List<String>>() {}),
                spu.getSkus().stream().map(this::toSkuResponse).toList());
    }

    private SkuResponse toSkuResponse(Sku sku) {
        return new SkuResponse(sku.getId(),
                readMap(sku.getSpecs()),
                sku.getPrice(), sku.getSkuCode(), sku.getBarCode(), sku.getWeight(),
                readList(sku.getImages(), new TypeReference<List<String>>() {}),
                sku.isActive(), 0);
    }

    private CategoryResponse toCategoryResponse(Category category) {
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

    private BrandResponse toBrandResponse(Brand brand) {
        return new BrandResponse(
                brand.getId(),
                brand.getName(),
                brand.getLogoUrl(),
                brand.getDescription(),
                brand.getSortOrder()
        );
    }

    private Map<String, String> readMap(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private <T> List<T> readList(String json, TypeReference<List<T>> typeRef) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, typeRef);
        } catch (Exception e) {
            return List.of();
        }
    }
}
