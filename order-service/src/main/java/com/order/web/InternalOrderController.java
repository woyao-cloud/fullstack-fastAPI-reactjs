package com.order.web;

import com.order.domain.entity.OrderStatus;
import com.order.service.OrderResponse;
import com.order.service.OrderService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/internal/orders")
public class InternalOrderController {

    private final OrderService orderService;

    public InternalOrderController(OrderService orderService) { this.orderService = orderService; }

    @GetMapping
    public PageResponse<OrderResponse> list(@RequestParam(required = false) OrderStatus status,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "20") int size) {
        return orderService.listAllOrders(status, page, size);
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable UUID id) { return orderService.getOrderAdmin(id); }

    @PostMapping("/{id}/ship")
    public void ship(@PathVariable UUID id) { orderService.shipAdmin(id); }

    @PostMapping("/{id}/refund")
    public void refund(@PathVariable UUID id) { orderService.refundAdmin(id); }
}
