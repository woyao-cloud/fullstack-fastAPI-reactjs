package com.gateway.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class Resilience4jConfig {

    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .slidingWindowType(CircuitBreakerConfig.SlidingWindowType.COUNT_BASED)
                .slidingWindowSize(100)
                .failureRateThreshold(50)
                .slowCallRateThreshold(50)
                .slowCallDurationThreshold(Duration.ofMillis(500))
                .waitDurationInOpenState(Duration.ofSeconds(10))
                .permittedNumberOfCallsInHalfOpenState(10)
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .build();
        return CircuitBreakerRegistry.of(config);
    }

    @Bean
    public CircuitBreaker userServiceCircuitBreaker(CircuitBreakerRegistry registry) {
        return registry.circuitBreaker("user-service");
    }
}