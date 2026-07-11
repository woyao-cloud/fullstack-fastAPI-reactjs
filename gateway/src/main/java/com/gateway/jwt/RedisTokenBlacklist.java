package com.gateway.jwt;

import com.gateway.filter.AuthProperties;
import io.lettuce.core.RedisException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;

@Component
public class RedisTokenBlacklist implements TokenBlacklist {

    private static final Logger log = LoggerFactory.getLogger(RedisTokenBlacklist.class);
    private static final String JTI_PREFIX = "blacklist:jti:";
    private static final String USER_PREFIX = "blacklist:user:";

    private final ReactiveRedisTemplate<String, String> redis;
    private final long timeoutMs;
    private final boolean degradeOnFailure;

    public RedisTokenBlacklist(ReactiveRedisTemplate<String, String> redis, AuthProperties props) {
        this.redis = redis;
        this.timeoutMs = props.blacklist().redisTimeout();
        this.degradeOnFailure = props.blacklist().degradeOnFailure();
    }

    @Override
    public Mono<Boolean> isBlacklisted(String jti, String userId, Instant tokenIssuedAt) {
        Mono<Boolean> jtiCheck = redis.hasKey(JTI_PREFIX + jti)
                .timeout(Duration.ofMillis(timeoutMs));

        Mono<Boolean> userCheck = redis.opsForValue().get(USER_PREFIX + userId)
                .timeout(Duration.ofMillis(timeoutMs))
                .map(disabledAt -> {
                    long disabledEpoch = Long.parseLong(disabledAt);
                    return tokenIssuedAt.getEpochSecond() < disabledEpoch;
                })
                .defaultIfEmpty(false);

        return Mono.zip(jtiCheck, userCheck)
                .map(tuple -> tuple.getT1() || tuple.getT2())
                .onErrorResume(RedisException.class, e -> {
                    log.warn("Redis blacklist check failed, degraded: {}", e.getMessage());
                    return Mono.just(false);
                })
                .onErrorResume(e -> {
                    log.warn("Blacklist check timeout, degraded: {}", e.getMessage());
                    return Mono.just(false);
                });
    }
}