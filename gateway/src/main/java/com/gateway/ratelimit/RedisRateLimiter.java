package com.gateway.ratelimit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.util.List;

@Component
public class RedisRateLimiter implements RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RedisRateLimiter.class);
    private static final String KEY_PREFIX = "ratelimit:user:";

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static final RedisScript<List<Long>> SLIDING_WINDOW_SCRIPT = RedisScript.of("""
            local key = KEYS[1]
            local now = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local limit = tonumber(ARGV[3])
            local request_id = ARGV[4]

            local window_start = now - window
            redis.call('ZREMRANGEBYSCORE', key, 0, window_start)
            local count = redis.call('ZCOUNT', key, window_start, '+inf')

            if count >= limit then
                local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
                local retry_after = 0
                if #oldest > 0 then
                    retry_after = tonumber(oldest[2]) - window_start
                end
                return {0, retry_after}
            end

            redis.call('ZADD', key, now, request_id)
            local ttl = math.ceil(window / 1000) + 1
            redis.call('EXPIRE', key, ttl)
            return {1, limit - count - 1}
            """);

    private final ReactiveRedisTemplate<String, String> redis;
    private final RateLimitConfig config;

    public RedisRateLimiter(ReactiveRedisTemplate<String, String> redis, RateLimitConfig config) {
        this.redis = redis;
        this.config = config;
    }

    @Override
    public Mono<RateLimitResult> isAllowed(String userId, String path) {
        if (!config.enabled()) {
            return Mono.just(RateLimitResult.allow(Long.MAX_VALUE));
        }

        String key = KEY_PREFIX + userId + ":" + routeGroup(path);
        long now = System.currentTimeMillis();
        long windowMs = config.defaultWindow().toMillis();
        int limit = config.limitForPath(path);
        String requestId = System.nanoTime() + "-" + Thread.currentThread().threadId();

        return redis.execute(SLIDING_WINDOW_SCRIPT,
                        List.of(key),
                        List.of(String.valueOf(now), String.valueOf(windowMs),
                                String.valueOf(limit), requestId))
                .singleOrEmpty()
                .map(result -> {
                    if (result.get(0) == 1L) {
                        return RateLimitResult.allow(result.get(1));
                    }
                    return RateLimitResult.deny(result.get(1));
                })
                .defaultIfEmpty(RateLimitResult.allow(Long.MAX_VALUE))
                .onErrorResume(e -> {
                    log.warn("Rate limit Redis error, degraded: {}", e.getMessage());
                    return Mono.just(RateLimitResult.allow(Long.MAX_VALUE));
                });
    }

    private String routeGroup(String path) {
        if (path.startsWith("/api/v1/auth")) return "auth";
        if (path.startsWith("/api/v1/users")) return "users";
        if (path.startsWith("/api/v1/roles")) return "roles";
        return "default";
    }
}