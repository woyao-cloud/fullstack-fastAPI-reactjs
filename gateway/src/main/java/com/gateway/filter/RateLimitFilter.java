package com.gateway.filter;

import com.gateway.ratelimit.RateLimitConfig;
import com.gateway.ratelimit.RateLimiter;
import com.gateway.ratelimit.RateLimitResult;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 2)
public class RateLimitFilter implements GlobalFilter {

    private final RateLimiter rateLimiter;
    private final RateLimitConfig config;

    public RateLimitFilter(RateLimiter rateLimiter, RateLimitConfig config) {
        this.rateLimiter = rateLimiter;
        this.config = config;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        if (!config.enabled()) {
            return chain.filter(exchange);
        }

        String path = exchange.getRequest().getURI().getPath();
        // Use X-User-Id if already authenticated; otherwise fall back to IP
        String userId = exchange.getRequest().getHeaders().getFirst("X-User-Id");
        if (userId == null) {
            userId = exchange.getRequest().getRemoteAddress() != null
                    ? exchange.getRequest().getRemoteAddress().getAddress().getHostAddress()
                    : "anonymous";
        }

        String finalUserId = userId;
        return rateLimiter.isAllowed(finalUserId, path)
                .flatMap(result -> {
                    if (result.allowed()) {
                        return chain.filter(exchange);
                    }
                    exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                    exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
                    exchange.getResponse().getHeaders().set("Retry-After",
                            String.valueOf(result.retryAfterMs() / 1000));
                    String body = "{\"detail\":\"请求过于频繁\",\"retry_after\":" + result.retryAfterMs() / 1000 + "}";
                    byte[] bytes = body.getBytes();
                    return exchange.getResponse()
                            .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(bytes)));
                });
    }
}