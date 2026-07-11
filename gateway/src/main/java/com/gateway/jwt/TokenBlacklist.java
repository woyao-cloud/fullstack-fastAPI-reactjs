package com.gateway.jwt;

import reactor.core.publisher.Mono;

import java.time.Instant;

public interface TokenBlacklist {
    Mono<Boolean> isBlacklisted(String jti, String userId, Instant tokenIssuedAt);
}