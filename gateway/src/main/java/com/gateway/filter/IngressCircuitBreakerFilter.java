package com.gateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.time.Duration;

import com.sun.management.OperatingSystemMXBean;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class IngressCircuitBreakerFilter implements GlobalFilter {

    private static final Logger log = LoggerFactory.getLogger(IngressCircuitBreakerFilter.class);
    private static final OperatingSystemMXBean osBean =
            (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
    private static final MemoryMXBean memBean = ManagementFactory.getMemoryMXBean();

    private final IngressConfig config;
    private volatile boolean open = false;
    private int triggerCount = 0;
    private int recoverCount = 0;

    public IngressCircuitBreakerFilter(IngressConfig config) {
        this.config = config;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        updateState();

        if (open) {
            exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
            exchange.getResponse().getHeaders().set(HttpHeaders.CONTENT_TYPE, "application/json");
            byte[] body = "{\"detail\":\"服务繁忙，请稍后重试\"}".getBytes();
            return exchange.getResponse()
                    .writeWith(Mono.just(exchange.getResponse().bufferFactory().wrap(body)));
        }

        return chain.filter(exchange);
    }

    private void updateState() {
        double cpu = osBean.getCpuLoad();
        if (cpu < 0) return; // CPU load not available yet (JVM just started)

        long usedMem = memBean.getHeapMemoryUsage().getUsed();
        long maxMem = memBean.getHeapMemoryUsage().getMax();
        double memRatio = (double) usedMem / maxMem;

        boolean overloaded = cpu > config.cpuThreshold() || memRatio > config.memoryThreshold();

        if (overloaded) {
            triggerCount++;
            recoverCount = 0;
            if (triggerCount >= config.triggerCount() && !open) {
                open = true;
                log.warn("Ingress circuit breaker OPENED: cpu={}, mem={}", String.format("%.2f", cpu), String.format("%.2f", memRatio));
            }
        } else {
            recoverCount++;
            triggerCount = 0;
            if (recoverCount >= config.recoverCount() && open) {
                open = false;
                log.info("Ingress circuit breaker CLOSED: cpu={}, mem={}", String.format("%.2f", cpu), String.format("%.2f", memRatio));
            }
        }
    }
}

@ConfigurationProperties("gateway.circuit-breaker.ingress")
record IngressConfig(double cpuThreshold, double memoryThreshold, Duration sampleInterval,
                     int triggerCount, int recoverCount) {}