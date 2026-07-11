package com.gateway.filter;

import com.gateway.ratelimit.RateLimitConfig;
import com.gateway.ratelimit.RateLimiter;
import com.gateway.ratelimit.RateLimitResult;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimitFilterTest {

    @Test
    void shouldReturn429WhenOverLimit() {
        var limiter = mock(RateLimiter.class);
        when(limiter.isAllowed(anyString(), anyString()))
                .thenReturn(Mono.just(RateLimitResult.deny(500)));
        var config = new RateLimitConfig(true, 300, Duration.ofSeconds(1), List.of(), true);
        var filter = new RateLimitFilter(limiter, config);
        var chain = mock(GatewayFilterChain.class);

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void shouldPassThroughWhenAllowed() {
        var limiter = mock(RateLimiter.class);
        when(limiter.isAllowed(anyString(), anyString()))
                .thenReturn(Mono.just(RateLimitResult.allow(299)));
        var config = new RateLimitConfig(true, 300, Duration.ofSeconds(1), List.of(), true);
        var filter = new RateLimitFilter(limiter, config);
        var chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        var result = filter.filter(exchange, chain);
        StepVerifier.create(result).verifyComplete();
    }
}