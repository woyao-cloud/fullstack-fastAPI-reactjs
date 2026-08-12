package com.gateway.filter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Arrays;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)   // 在 AuthGlobalFilter(+3) 之后运行, 此时 X-User-Permissions 已注入
public class AdminInternalFilter implements GlobalFilter {

    private static final String ADMIN_PERMISSION = "order:manage";
    private static final String WILDCARD = "*:*";
    private final String internalToken;

    public AdminInternalFilter(@Value("${gateway.internal.token}") String internalToken) {
        this.internalToken = internalToken;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();
        if (!path.startsWith("/internal/")) {
            return chain.filter(exchange);
        }
        String perms = exchange.getRequest().getHeaders().getFirst("X-User-Permissions");
        boolean admin = perms != null && Arrays.stream(perms.split(","))
                .map(String::trim)
                .anyMatch(p -> p.equals(ADMIN_PERMISSION) || p.equals(WILDCARD));
        if (!admin) {
            exchange.getResponse().setStatusCode(HttpStatus.FORBIDDEN);
            return exchange.getResponse().setComplete();
        }
        var req = exchange.getRequest().mutate().header("X-Internal-Token", internalToken).build();
        return chain.filter(exchange.mutate().request(req).build());
    }
}
