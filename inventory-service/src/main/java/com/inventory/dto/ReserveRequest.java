package com.inventory.dto;

import java.util.List;

public record ReserveRequest(List<ReserveItem> items) {}
