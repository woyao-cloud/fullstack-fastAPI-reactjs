package com.inventory.dto;

import java.util.Map;
import java.util.UUID;

public record ReserveResult(boolean success, Map<UUID, Integer> available) {}
