package com.inventory.repository;

import com.inventory.domain.entity.InventoryEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface InventoryEventRepository extends JpaRepository<InventoryEvent, UUID> {
}
