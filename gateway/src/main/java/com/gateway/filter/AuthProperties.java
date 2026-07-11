package com.gateway.filter;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties("gateway.auth")
public record AuthProperties(
    String jwtSecretKey,
    String jwtAlgorithm,
    List<String> excludePaths,
    Blacklist blacklist
) {
    public record Blacklist(long redisTimeout, boolean degradeOnFailure) {}
}