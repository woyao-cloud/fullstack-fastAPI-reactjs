package com.gateway.ratelimit;

import reactor.core.publisher.Mono;

public interface RateLimiter {
    Mono<RateLimitResult> isAllowed(String userId, String path);
}

record RateLimitResult(boolean allowed, long remaining, long retryAfterMs) {
    public static RateLimitResult allow(long remaining) {
        return new RateLimitResult(true, remaining, 0);
    }

    public static RateLimitResult deny(long retryAfterMs) {
        return new RateLimitResult(false, 0, retryAfterMs);
    }
}