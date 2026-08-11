package com.product.service.write;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.product.domain.entity.*;
import com.product.dto.request.SkuRequest;
import com.product.dto.request.SpuCreateRequest;
import com.product.dto.response.BrandResponse;
import com.product.dto.response.CategoryResponse;
import com.product.dto.response.SkuResponse;
import com.product.dto.response.SpuResponse;
import com.product.repository.BrandRepository;
import com.product.repository.CategoryRepository;
import com.product.repository.SkuRepository;
import com.product.repository.SpuRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class SpuWriteService {

    private final SpuRepository spuRepository;
    private final CategoryRepository categoryRepository;
    private final BrandRepository brandRepository;
    private final SkuRepository skuRepository;
    private final ObjectMapper objectMapper;

    public SpuWriteService(SpuRepository spuRepository, CategoryRepository categoryRepository,
                           BrandRepository brandRepository, SkuRepository skuRepository,
                           ObjectMapper objectMapper) {
        this.spuRepository = spuRepository;
        this.categoryRepository = categoryRepository;
        this.brandRepository = brandRepository;
        this.skuRepository = skuRepository;
        this.objectMapper = objectMapper;
    }

    public SpuResponse create(SpuCreateRequest request) {
        Spu spu = new Spu();
        apply(spu, request);
        Spu saved = spuRepository.save(spu);
        List<Sku> skus = request.skus().stream().map(s -> toSku(saved, s)).toList();
        skuRepository.saveAll(skus);
        saved.setSkus(skus);
        return toResponse(saved);
    }

    public SpuResponse update(UUID id, SpuCreateRequest request) {
        Spu spu = spuRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("商品不存在: " + id));
        apply(spu, request);
        skuRepository.deleteBySpuId(id);
        List<Sku> skus = request.skus().stream().map(s -> toSku(spu, s)).toList();
        skuRepository.saveAll(skus);
        spu.setSkus(skus);
        return toResponse(spu);
    }

    public void changeStatus(UUID id, SpuStatus status) {
        Spu spu = spuRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("商品不存在: " + id));
        spu.setStatus(status);
    }

    public void delete(UUID id) {
        if (!spuRepository.existsById(id)) {
            throw new IllegalArgumentException("商品不存在: " + id);
        }
        spuRepository.deleteById(id); // sku 级联删除
    }

    private void apply(Spu spu, SpuCreateRequest r) {
        spu.setName(r.name());
        spu.setDescription(r.description());
        spu.setCategory(categoryRepository.findById(r.categoryId())
                .orElseThrow(() -> new IllegalArgumentException("分类不存在: " + r.categoryId())));
        if (r.brandId() != null) {
            spu.setBrand(brandRepository.findById(r.brandId())
                    .orElseThrow(() -> new IllegalArgumentException("品牌不存在: " + r.brandId())));
        } else {
            spu.setBrand(null);
        }
        spu.setCoverImage(r.coverImage());
        spu.setImages(toJsonArray(r.images()));
        spu.setSpecsTemplate(toJsonArray(r.specsTemplate()));
        spu.setTags(toJsonArray(r.tags()));
    }

    private Sku toSku(Spu spu, SkuRequest r) {
        Sku sku = new Sku();
        sku.setSpu(spu);
        sku.setSpecs(toJson(r.specs()));
        sku.setPrice(r.price());
        sku.setSkuCode(r.skuCode());
        sku.setBarCode(r.barCode());
        sku.setWeight(r.weight());
        sku.setImages(toJsonArray(r.images()));
        sku.setActive(true);
        return sku;
    }

    private String toJson(Object o) {
        // 用注入的 ObjectMapper 序列化；SPU 的 images/specsTemplate/tags 与 SKU 的 specs/images 为 JSON 字符串列
        return objectMapper.valueToTree(o).toString();
    }

    private String toJsonArray(List<?> list) {
        return list == null ? "[]" : toJson(list);
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
