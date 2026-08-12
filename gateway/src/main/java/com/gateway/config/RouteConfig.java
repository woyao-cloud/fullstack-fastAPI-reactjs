package com.gateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("!test")
public class RouteConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("product-service", r -> r
                        .path("/api/v1/products/**", "/api/v1/categories/**", "/api/v1/brands/**")
                        .uri("http://product-service:8081"))
                .route("inventory-service", r -> r
                        .path("/api/v1/inventory/**")
                        .uri("http://inventory-service:8082"))
                .route("order-service", r -> r
                        .path("/api/v1/cart/**", "/api/v1/orders/**")
                        .uri("http://order-service:8083"))
                .route("order-internal", r -> r
                        .path("/internal/orders/**")
                        .filters(f -> f.circuitBreaker(c -> c
                                .setName("order-internal")
                                .setFallbackUri("forward:/fallback/order-internal")))
                        .uri("http://order-service:8083"))
                .route("user-service", r -> r
                        .path("/api/v1/**")
                        .filters(f -> f.circuitBreaker(c -> c
                                .setName("user-service")
                                .setFallbackUri("forward:/fallback/user-service")))
                        .uri("http://user-service:8000"))
                .build();
    }
}