package com.gateway.dto;

import java.util.List;

public record UserInfo(
    String userId,
    String email,
    List<String> permissions
) {
    public static UserInfo fromPayload(String userId, String email, List<String> permissions) {
        return new UserInfo(userId, email != null ? email : "", permissions != null ? permissions : List.of());
    }
}