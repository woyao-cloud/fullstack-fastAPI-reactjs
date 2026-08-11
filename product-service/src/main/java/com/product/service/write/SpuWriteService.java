package com.product.service.write;

import com.product.domain.entity.*;
import com.product.dto.request.SkuRequest;
import com.product.dto.request.SpuCreateRequest;
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

    public SpuWriteService(SpuRepository spuRepository, CategoryRepository categoryRepository,
                           BrandRepository brandRepository, SkuRepository skuRepository) {
        this.spuRepository = spuRepository;
        this.categoryRepository = categoryRepository;
        this.brandRepository = brandRepository;
        this.skuRepository = skuRepository;
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
        }
        spu.setCoverImage(r.coverImage());
        spu.setImages(toJsonArray(r.images()));
        spu.setSpecsTemplate(toJsonArray(r.specsTemplate() == null ? List.of() : r.specsTemplate().stream().map(s -> "{\"key\":\"" + s.key() + "\",\"values\":" + s.values() + "}").toList()));
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
        // 用 Jackson ObjectMapper 序列化；SPU 的 images/specsTemplate/tags 为 JSON 字符串列
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build().valueToTree(o).toString();
    }

    private String toJsonArray(List<String> list) {
        return list == null ? "[]" : toJson(list);
    }

    private SpuResponse toResponse(Spu spu) {
        return new SpuResponse(
                spu.getId(), spu.getName(), spu.getDescription(),
                null, null, spu.getStatus().name(), spu.getCoverImage(),
                List.of(), List.of(), List.of(),
                spu.getSkus().stream().map(this::toSkuResponse).toList());
    }

    private SkuResponse toSkuResponse(Sku sku) {
        return new SkuResponse(sku.getId(), sku.getSpecs() == null ? Map.of() : Map.of(),
                sku.getPrice(), sku.getSkuCode(), sku.getBarCode(), sku.getWeight(),
                List.of(), sku.isActive(), 0);
    }
}
