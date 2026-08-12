package com.gateway.filter;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties("gateway.auth")
public record AuthProperties(
    String jwtSecretKey,
    String jwtAlgorithm,
    List<String> excludePaths,
    Blacklist blacklist,
    List<String> publicReadPaths
) {
    public record Blacklist(Duration redisTimeout, boolean degradeOnFailure) {}
}