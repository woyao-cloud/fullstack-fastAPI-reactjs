package com.gateway.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RouteConfig {

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder, CircuitBreaker userServiceCb) {
        return builder.routes()
                .route("user-service", r -> r
                        .path("/api/v1/**")
                        .filters(f -> f.circuitBreaker(c -> c
                                .setName("user-service")
                                .setFallbackUri("forward:/fallback/user-service")))
                        .uri("http://user-service:8000"))
                .build();
    }
}