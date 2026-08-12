package com.inventory.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ReserveRequest(
        @NotEmpty List<@Valid ReserveItem> items
) {}
