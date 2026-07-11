package com.gateway.jwt;

import com.gateway.dto.UserInfo;
import com.gateway.filter.AuthProperties;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtParserTest {

    private JwtParser parser;
    private String secret = "test-secret-key-at-least-256-bits-long!!";

    @BeforeEach
    void setUp() {
        parser = new JwtParser(new AuthProperties(secret, "HS256", List.of(), null));
    }

    private String createToken(String userId, String email, List<String> permissions,
                                Instant issuedAt, Instant expiresAt) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(userId)
                .claim("email", email)
                .claim("permissions", permissions)
                .issueTime(Date.from(issuedAt))
                .expirationTime(Date.from(expiresAt))
                .jwtID(UUID.randomUUID().toString())
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret));
        return jwt.serialize();
    }

    @Test
    void shouldParseValidToken() throws Exception {
        String token = createToken("user-123", "test@example.com", List.of("user:read"),
                Instant.now(), Instant.now().plusSeconds(3600));

        UserInfo info = parser.parse(token);

        assertThat(info.userId()).isEqualTo("user-123");
        assertThat(info.email()).isEqualTo("test@example.com");
        assertThat(info.permissions()).contains("user:read");
    }

    @Test
    void shouldRejectExpiredToken() throws Exception {
        String token = createToken("user-123", "test@example.com", List.of(),
                Instant.now().minusSeconds(7200), Instant.now().minusSeconds(3600));

        assertThatThrownBy(() -> parser.parse(token))
                .isInstanceOf(JwtException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void shouldRejectTokenWithWrongSecret() throws Exception {
        JwtParser otherParser = new JwtParser(new AuthProperties("wrong-secret-key-at-least-256-bits!!!", "HS256", List.of(), null));
        String token = createToken("user-123", "test@example.com", List.of(),
                Instant.now(), Instant.now().plusSeconds(3600));

        assertThatThrownBy(() -> otherParser.parse(token))
                .isInstanceOf(JwtException.class);
    }
}