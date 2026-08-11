package com.order.web;

import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

@Component
public class UserContext {
    public UUID currentUserId() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        String userId = attrs == null ? null : attrs.getRequest().getHeader("X-User-Id");
        if (userId == null || userId.isBlank()) {
            throw new IllegalStateException("缺少用户身份");
        }
        return UUID.fromString(userId);
    }
}
