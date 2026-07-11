package com.gateway.filter;

import com.gateway.jwt.JwtException;
import com.gateway.jwt.JwtParser;
import com.gateway.jwt.TokenBlacklist;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthGlobalFilterTest {

    private JwtParser jwtParser = mock(JwtParser.class);
    private TokenBlacklist blacklist = mock(TokenBlacklist.class);
    private AuthProperties props = new AuthProperties("secret", "HS256",
            List.of("/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh", "/api/v1/auth/login/oauth"),
            new AuthProperties.Blacklist(Duration.ofMillis(50), true));
    private AuthGlobalFilter filter = new AuthGlobalFilter(jwtParser, blacklist, props);
    private GatewayFilterChain chain = mock(GatewayFilterChain.class);

    @BeforeEach
    void setUp() {
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Test
    void shouldPassThroughExcludedPaths() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/auth/login").build());

        var result = filter.filter(exchange, chain);

        StepVerifier.create(result).verifyComplete();
    }

    @Test
    void shouldReturn401WhenNoToken() {
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users").build());

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldReturn401WhenJwtInvalid() {
        when(jwtParser.parse(anyString())).thenThrow(new JwtException("bad token"));

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer invalid"));

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void shouldReturn401WhenBlacklisted() {
        var userInfo = new com.gateway.dto.UserInfo("user-1", "a@b.com", List.of());
        var parsed = new JwtParser.ParsedToken(userInfo, "jti-1", Instant.ofEpochSecond(1750000000));
        when(jwtParser.parse(anyString())).thenReturn(parsed);
        when(blacklist.isBlacklisted(anyString(), anyString(), any(Instant.class)))
                .thenReturn(Mono.just(true));

        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/users")
                        .header(HttpHeaders.AUTHORIZATION,
                                "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJpYXQiOjE3NTAwMDAwMDAsImV4cCI6MTg1MDAwMDAwMCwianRpIjoianRpLTEifQ.placeholder"));

        filter.filter(exchange, chain).subscribe();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}