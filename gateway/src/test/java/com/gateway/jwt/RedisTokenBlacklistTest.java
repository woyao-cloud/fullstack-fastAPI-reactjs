package com.gateway.jwt;

import com.gateway.filter.AuthProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.ReactiveValueOperations;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RedisTokenBlacklistTest {

    @SuppressWarnings("unchecked")
    private ReactiveRedisTemplate<String, String> redis = mock(ReactiveRedisTemplate.class);
    private ReactiveValueOperations<String, String> ops = mock(ReactiveValueOperations.class);
    private RedisTokenBlacklist blacklist;

    @BeforeEach
    void setUp() {
        when(redis.hasKey(anyString())).thenReturn(Mono.just(false));
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.get(anyString())).thenReturn(Mono.empty());

        var authProps = new AuthProperties("secret", "HS256", List.of(),
                new AuthProperties.Blacklist(2000, true));
        blacklist = new RedisTokenBlacklist(redis, authProps);
    }

    @Test
    void shouldReturnFalseWhenNotBlacklisted() {
        StepVerifier.create(blacklist.isBlacklisted("jti-1", "user-1", Instant.now()))
                .expectNext(false)
                .verifyComplete();
    }

    @Test
    void shouldReturnTrueWhenJtiBlacklisted() {
        when(redis.hasKey("blacklist:jti:jti-1")).thenReturn(Mono.just(true));

        StepVerifier.create(blacklist.isBlacklisted("jti-1", "user-1", Instant.now()))
                .expectNext(true)
                .verifyComplete();
    }

    @Test
    void shouldReturnTrueWhenUserDisabledAfterTokenIssued() {
        Instant issuedAt = Instant.now().minus(Duration.ofHours(1));
        when(ops.get("blacklist:user:user-1")).thenReturn(Mono.just(String.valueOf(Instant.now().getEpochSecond())));

        StepVerifier.create(blacklist.isBlacklisted("jti-1", "user-1", issuedAt))
                .expectNext(true)
                .verifyComplete();
    }
}