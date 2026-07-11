package com.gateway.ratelimit;

import reactor.core.publisher.Mono;

public interface RateLimiter {
    Mono<RateLimitResult> isAllowed(String userId, String path);
}