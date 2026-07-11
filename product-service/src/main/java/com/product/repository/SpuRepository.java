package com.product.repository;

import com.product.domain.entity.Spu;
import com.product.domain.entity.SpuStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SpuRepository extends JpaRepository<Spu, UUID> {

    @Query("SELECT s FROM Spu s JOIN FETCH s.category LEFT JOIN FETCH s.brand WHERE s.id = :id")
    Optional<Spu> findByIdWithDetails(@Param("id") UUID id);

    @Query("SELECT s FROM Spu s JOIN FETCH s.skus WHERE s.id = :id")
    Optional<Spu> findByIdWithSkus(@Param("id") UUID id);

    List<Spu> findByCategoryId(UUID categoryId);

    List<Spu> findByBrandId(UUID brandId);

    List<Spu> findByStatus(SpuStatus status);
}
