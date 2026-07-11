package com.gateway;

import com.gateway.jwt.TokenBlacklist;
import com.gateway.ratelimit.RateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@AutoConfigureWebTestClient
class GatewayIntegrationTest {

    @Autowired
    private WebTestClient webClient;

    @MockBean
    private TokenBlacklist blacklist;

    @MockBean
    private RateLimiter rateLimiter;

    @Test
    void shouldReturn401WhenNoToken() {
        webClient.get().uri("/api/v1/users")
                .exchange()
                .expectStatus().isUnauthorized()
                .expectBody()
                .jsonPath("$.detail").isEqualTo("缺少认证凭据");
    }

    @Test
    void shouldPassThroughAuthEndpoints() {
        webClient.post().uri("/api/v1/auth/login")
                .exchange()
                .expectStatus().is2xxSuccessful();
    }

    @Test
    void shouldStartApplicationContext() {
        // Verifies all beans wire correctly
    }
}