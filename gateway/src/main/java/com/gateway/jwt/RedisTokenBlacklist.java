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
    private final Duration timeout;
    private final boolean degradeOnFailure;

    public RedisTokenBlacklist(ReactiveRedisTemplate<String, String> redis, AuthProperties props) {
        this.redis = redis;
        this.timeout = props.blacklist().redisTimeout();
        this.degradeOnFailure = props.blacklist().degradeOnFailure();
    }

    @Override
    public Mono<Boolean> isBlacklisted(String jti, String userId, Instant tokenIssuedAt) {
        Mono<Boolean> jtiCheck = redis.hasKey(JTI_PREFIX + jti)
                .timeout(timeout);

        Mono<Boolean> userCheck = redis.opsForValue().get(USER_PREFIX + userId)
                .timeout(timeout)
                .map(disabledAt -> {
                    long disabledEpoch = Long.parseLong(disabledAt);
                    return tokenIssuedAt.getEpochSecond() < disabledEpoch;
                })
                .defaultIfEmpty(false);

        return Mono.zip(jtiCheck, userCheck)
                .map(tuple -> tuple.getT1() || tuple.getT2())
                .onErrorResume(RedisException.class, e -> {
                    if (degradeOnFailure) {
                        log.warn("Redis blacklist check failed, degraded: {}", e.getMessage());
                        return Mono.just(false);
                    }
                    return Mono.error(e);
                })
                .onErrorResume(e -> {
                    if (degradeOnFailure) {
                        log.warn("Blacklist check timeout, degraded: {}", e.getMessage());
                        return Mono.just(false);
                    }
                    return Mono.error(e);
                });
    }
}