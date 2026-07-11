package com.gateway.jwt;

import com.gateway.dto.UserInfo;
import com.gateway.filter.AuthProperties;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Component
public class JwtParser {

    private final JWSVerifier verifier;
    private final AuthProperties props;

    public JwtParser(AuthProperties props) {
        this.props = props;
        try {
            this.verifier = new MACVerifier(props.jwtSecretKey());
        } catch (com.nimbusds.jose.JOSEException e) {
            throw new JwtException("无法创建 JWT 验证器: " + e.getMessage(), e);
        }
    }

    public UserInfo parse(String token) throws JwtException {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!jwt.verify(verifier)) {
                throw new JwtException("签名验证失败");
            }
            Date expiration = jwt.getJWTClaimsSet().getExpirationTime();
            if (expiration == null || expiration.before(Date.from(Instant.now()))) {
                throw new JwtException("token expired");
            }
            String userId = jwt.getJWTClaimsSet().getSubject();
            if (userId == null || userId.isBlank()) {
                throw new JwtException("missing subject");
            }
            String email = jwt.getJWTClaimsSet().getStringClaim("email");
            List<String> permissions = jwt.getJWTClaimsSet().getStringListClaim("permissions");
            return UserInfo.fromPayload(userId, email, permissions);
        } catch (ParseException | com.nimbusds.jose.JOSEException e) {
            throw new JwtException("token 解析失败: " + e.getMessage(), e);
        }
    }
}