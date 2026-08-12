package com.inventory.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.UUID;

public record RestockRequest(
        @NotNull UUID skuId,
        @NotNull @Positive int quantity
) {}
