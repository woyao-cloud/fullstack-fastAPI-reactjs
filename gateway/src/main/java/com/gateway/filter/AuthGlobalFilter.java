package com.gateway.filter;

import com.gateway.dto.UserInfo;
import com.gateway.jwt.JwtException;
import com.gateway.jwt.JwtParser;
import com.gateway.jwt.TokenBlacklist;
import com.nimbusds.jwt.SignedJWT;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.text.ParseException;
import java.time.Instant;
import java.util.Date;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 3)
public class AuthGlobalFilter implements GlobalFilter {

    private static final Logger log = LoggerFactory.getLogger(AuthGlobalFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";
    private final AntPathMatcher matcher = new AntPathMatcher();

    private final JwtParser jwtParser;
    private final TokenBlacklist blacklist;
    private final AuthProperties props;

    public AuthGlobalFilter(JwtParser jwtParser, TokenBlacklist blacklist, AuthProperties props) {
        this.jwtParser = jwtParser;
        this.blacklist = blacklist;
        this.props = props;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        if (isExcluded(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "缺少认证凭据");
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            UserInfo userInfo = jwtParser.parse(token);
            SignedJWT jwt = SignedJWT.parse(token);
            String jti = jwt.getJWTClaimsSet().getJWTID();
            Date iat = jwt.getJWTClaimsSet().getIssueTime();
            Instant issuedAt = iat != null ? iat.toInstant() : Instant.EPOCH;

            return blacklist.isBlacklisted(jti, userInfo.userId(), issuedAt)
                    .flatMap(blacklisted -> {
                        if (blacklisted) {
                            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "认证凭据已失效");
                        }
                        return forwardWithUserHeaders(exchange, chain, userInfo);
                    });

        } catch (JwtException e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "认证凭据无效或已过期");
        } catch (ParseException e) {
            log.error("Failed to parse JWT for blacklist check", e);
            return errorResponse(exchange, HttpStatus.UNAUTHORIZED, "认证凭据无效或已过期");
        }
    }

    private boolean isExcluded(String path) {
        return props.excludePaths().stream().anyMatch(p -> matcher.match(p, path));
    }

    private Mono<Void> forwardWithUserHeaders(ServerWebExchange exchange, GatewayFilterChain chain,
                                               UserInfo userInfo) {
        var req = exchange.getRequest().mutate()
                .header("X-User-Id", userInfo.userId())
                .header("X-User-Email", userInfo.email())
                .header("X-User-Permissions", String.join(",", userInfo.permissions()))
                .build();
        return chain.filter(exchange.mutate().request(req).build());
    }

    private Mono<Void> errorResponse(ServerWebExchange exchange, HttpStatus status, String detail) {
        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
        byte[] body = ("{\"detail\":\"" + detail + "\"}").getBytes();
        var buffer = exchange.getResponse().bufferFactory().wrap(body);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }
}