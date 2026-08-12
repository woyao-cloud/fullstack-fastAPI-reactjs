package com.gateway.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminInternalFilterTest {

    private final AdminInternalFilter filter = new AdminInternalFilter("dev-token");
    private final GatewayFilterChain chain = mock(GatewayFilterChain.class);
    private final AtomicReference<ServerWebExchange> forwarded = new AtomicReference<>();

    @BeforeEach
    void setUp() {
        when(chain.filter(any())).thenAnswer(inv -> {
            forwarded.set(inv.getArgument(0));
            return Mono.empty();
        });
    }

    @Test
    void passesThroughNonInternalPaths() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/products/search").build());
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }

    @Test
    void rejectsInternalWithoutAdminPermission() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/internal/orders")
                        .header("X-User-Permissions", "user:read"));
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void injectsInternalTokenForAdmin() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/internal/orders")
                        .header("X-User-Permissions", "user:read,order:manage"));
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(forwarded.get().getRequest().getHeaders().getFirst("X-Internal-Token")).isEqualTo("dev-token");
    }

    @Test
    void acceptsWildcardPermission() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/internal/orders")
                        .header("X-User-Permissions", "*:*"));
        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();
        assertThat(forwarded.get().getRequest().getHeaders().getFirst("X-Internal-Token")).isEqualTo("dev-token");
    }
}
