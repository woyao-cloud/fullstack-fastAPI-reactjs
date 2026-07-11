package com.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IngressCircuitBreakerFilterTest {

    @Test
    void shouldPassThroughWhenClosed() {
        var config = new IngressConfig(0.99, 0.99, Duration.ofSeconds(5), 3, 3);
        var filter = new IngressCircuitBreakerFilter(config);
        var chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        var result = filter.filter(exchange, chain);
        StepVerifier.create(result).verifyComplete();
    }
}