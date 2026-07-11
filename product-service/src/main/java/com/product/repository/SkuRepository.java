package com.product.repository;

import com.product.domain.entity.Sku;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SkuRepository extends JpaRepository<Sku, UUID> {

    List<Sku> findBySpuId(UUID spuId);

    Optional<Sku> findBySkuCode(String skuCode);

    boolean existsBySkuCode(String skuCode);

    Optional<Sku> findByBarCode(String barCode);
}
