package com.order.web;

import com.order.domain.entity.OrderStatus;
import com.order.service.OrderResponse;
import com.order.service.OrderService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import com.order.config.SecurityConfig;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InternalOrderController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "internal.api.token=test-token")
class InternalOrderControllerTest {

    @Autowired MockMvc mockMvc;
    @MockitoBean OrderService orderService;

    @Test
    void rejectsMissingToken() throws Exception {
        mockMvc.perform(get("/internal/orders"))
                .andExpect(status().isForbidden());
    }

    @Test
    void rejectsWrongToken() throws Exception {
        mockMvc.perform(get("/internal/orders").header("X-Internal-Token", "wrong"))
                .andExpect(status().isForbidden());
    }

    @Test
    void listsOrdersWithToken() throws Exception {
        when(orderService.listAllOrders(isNull(), eq(0), eq(20)))
                .thenReturn(new PageResponse<>(List.of(
                        new OrderResponse(UUID.randomUUID(), "NO1", OrderStatus.PAID,
                                new BigDecimal("10"), null, null, List.of())), 1, 0, 20));
        mockMvc.perform(get("/internal/orders").header("X-Internal-Token", "test-token"))
                .andExpect(status().isOk());
    }

    @Test
    void shipsWithToken() throws Exception {
        mockMvc.perform(post("/internal/orders/{id}/ship", UUID.randomUUID())
                        .header("X-Internal-Token", "test-token"))
                .andExpect(status().isOk());
        verify(orderService).shipAdmin(any(UUID.class));
    }
}
