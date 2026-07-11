package com.gateway.ratelimit;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.AntPathMatcher;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties("gateway.ratelimit")
public record RateLimitConfig(
    boolean enabled,
    int defaultLimit,
    Duration defaultWindow,
    List<RouteLimit> routes,
    boolean degradeOnFailure
) {
    public record RouteLimit(String path, int limit) {}

    public int limitForPath(String path) {
        if (routes == null) return defaultLimit;
        var matcher = new AntPathMatcher();
        return routes.stream()
                .filter(r -> matcher.match(r.path(), path))
                .findFirst()
                .map(RouteLimit::limit)
                .orElse(defaultLimit);
    }
}