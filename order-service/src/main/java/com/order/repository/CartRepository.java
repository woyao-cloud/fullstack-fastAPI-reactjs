package com.order.repository;

import com.order.domain.entity.Cart;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CartRepository extends JpaRepository<Cart, UUID> {
    List<Cart> findByUserIdAndCheckedTrue(UUID userId);
    Optional<Cart> findByUserIdAndSkuId(UUID userId, UUID skuId);
    void deleteByUserIdAndSkuIdIn(UUID userId, Collection<UUID> skuIds);
}
