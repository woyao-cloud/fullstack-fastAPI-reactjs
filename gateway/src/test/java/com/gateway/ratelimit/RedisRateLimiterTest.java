package com.gateway.ratelimit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RedisRateLimiterTest {

    @SuppressWarnings("unchecked")
    private ReactiveRedisTemplate<String, String> redis = mock(ReactiveRedisTemplate.class);
    private RedisRateLimiter limiter;

    @BeforeEach
    void setUp() {
        var config = new RateLimitConfig(true, 300, Duration.ofSeconds(1),
                List.of(new RateLimitConfig.RouteLimit("/api/v1/auth/**", 20),
                        new RateLimitConfig.RouteLimit("/api/v1/users/**", 200)),
                true);
        when(redis.execute(any(), anyList(), anyList())).thenReturn(Flux.just(List.of(1L, 299L)));
        limiter = new RedisRateLimiter(redis, config);
    }

    @Test
    void shouldAllowRequest() {
        StepVerifier.create(limiter.isAllowed("user-1", "/api/v1/users"))
                .expectNextMatches(r -> r.allowed() && r.remaining() == 299L)
                .verifyComplete();
    }

    @Test
    void shouldDenyWhenOverLimit() {
        when(redis.execute(any(), anyList(), anyList())).thenReturn(Flux.just(List.of(0L, 500L)));

        StepVerifier.create(limiter.isAllowed("user-1", "/api/v1/users"))
                .expectNextMatches(r -> !r.allowed() && r.retryAfterMs() == 500L)
                .verifyComplete();
    }

    @Test
    void shouldUseRouteSpecificLimit() {
        when(redis.execute(any(), anyList(), anyList())).thenReturn(Flux.just(List.of(1L, 19L)));

        StepVerifier.create(limiter.isAllowed("user-1", "/api/v1/auth/login"))
                .expectNextMatches(r -> r.allowed() && r.remaining() == 19L)
                .verifyComplete();
    }
}