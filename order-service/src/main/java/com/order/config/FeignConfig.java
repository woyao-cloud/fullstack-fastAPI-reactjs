package com.order.config;

import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

@Configuration
public class FeignConfig {
    @Bean
    public feign.Request.Options feignOptions() {
        return new feign.Request.Options(2, TimeUnit.SECONDS, 5, TimeUnit.SECONDS, true);
    }

    // 服务间调用携带共享 token, 满足 /internal/** 鉴权 (review C2/C3)
    @Bean
    public RequestInterceptor internalTokenInterceptor(@Value("${internal.api.token}") String token) {
        return template -> template.header("X-Internal-Token", token);
    }
}
