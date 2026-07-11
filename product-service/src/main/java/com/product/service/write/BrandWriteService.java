package com.product.service.write;

import com.product.domain.entity.Brand;
import com.product.dto.request.BrandRequest;
import com.product.dto.response.BrandResponse;
import com.product.repository.BrandRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class BrandWriteService {

    private final BrandRepository brandRepository;

    public BrandWriteService(BrandRepository brandRepository) {
        this.brandRepository = brandRepository;
    }

    public BrandResponse create(BrandRequest request) {
        if (brandRepository.existsByName(request.name())) {
            throw new IllegalArgumentException("品牌名称已存在: " + request.name());
        }

        Brand brand = new Brand();
        brand.setName(request.name());
        brand.setLogoUrl(request.logoUrl());
        brand.setDescription(request.description());
        brand.setSortOrder(request.sortOrder());

        Brand saved = brandRepository.save(brand);
        return toResponse(saved);
    }

    public BrandResponse update(UUID id, BrandRequest request) {
        Brand brand = brandRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("品牌不存在: " + id));

        if (!brand.getName().equals(request.name())
                && brandRepository.existsByName(request.name())) {
            throw new IllegalArgumentException("品牌名称已存在: " + request.name());
        }

        brand.setName(request.name());
        brand.setLogoUrl(request.logoUrl());
        brand.setDescription(request.description());
        brand.setSortOrder(request.sortOrder());

        return toResponse(brandRepository.save(brand));
    }

    public void delete(UUID id) {
        if (!brandRepository.existsById(id)) {
            throw new IllegalArgumentException("品牌不存在: " + id);
        }
        brandRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Page<BrandResponse> list(int page, int size) {
        return brandRepository.findAll(PageRequest.of(page, size))
                .map(this::toResponse);
    }

    private BrandResponse toResponse(Brand brand) {
        return new BrandResponse(
                brand.getId(),
                brand.getName(),
                brand.getLogoUrl(),
                brand.getDescription(),
                brand.getSortOrder()
        );
    }
}
