package com.order.client;

import feign.Feign;
import feign.jackson.JacksonDecoder;
import feign.jackson.JacksonEncoder;
import feign.okhttp.OkHttpClient;
import okhttp3.mockwebserver.MockResponse;
import org.springframework.cloud.openfeign.support.SpringMvcContract;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class FeignClientsTest {
    MockWebServer server;
    InventoryClient client;
    ProductClient productClient;

    @BeforeEach
    void setUp() throws IOException {
        server = new MockWebServer();
        server.start();
        Feign.Builder builder = Feign.builder()
                .client(new OkHttpClient())
                .contract(new SpringMvcContract())
                .encoder(new JacksonEncoder())
                .decoder(new JacksonDecoder());
        client = builder.target(InventoryClient.class, server.url("/").toString());
        productClient = builder.target(ProductClient.class, server.url("/").toString());
    }

    @AfterEach
    void tearDown() throws IOException {
        server.shutdown();
    }

    @Test
    void reservePostsReservePath() throws InterruptedException {
        server.enqueue(new MockResponse().setBody("{\"success\":true,\"available\":{}}")
                .addHeader("Content-Type", "application/json"));
        client.reserve(new InventoryClient.ReserveRequest(List.of(new InventoryClient.ReserveItem(UUID.randomUUID(), 2))));
        RecordedRequest r = server.takeRequest();
        assertThat(r.getPath()).isEqualTo("/internal/inventory/reserve");
    }

    @Test
    void batchSkusPostsBatchPath() throws InterruptedException {
        server.enqueue(new MockResponse().setBody("[]")
                .addHeader("Content-Type", "application/json"));
        productClient.batchSkus(List.of(UUID.randomUUID()));
        RecordedRequest r = server.takeRequest();
        assertThat(r.getPath()).isEqualTo("/internal/skus/batch");
    }
}
