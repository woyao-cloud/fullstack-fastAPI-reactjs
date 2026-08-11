package com.product.repository;

import com.product.domain.entity.Sku;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SkuRepository extends JpaRepository<Sku, UUID> {

    @Query("select s from Sku s join fetch s.spu where s.id in :ids")
    List<Sku> findByIdsWithSpu(@Param("ids") List<UUID> ids);

    List<Sku> findBySpuId(UUID spuId);

    Optional<Sku> findBySkuCode(String skuCode);

    boolean existsBySkuCode(String skuCode);

    Optional<Sku> findByBarCode(String barCode);

    void deleteBySpuId(UUID spuId);
}
