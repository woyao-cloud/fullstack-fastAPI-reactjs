package com.order.web;

import com.order.service.OrderResponse;
import com.order.service.OrderService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orderService;
    private final UserContext userContext;

    public OrderController(OrderService orderService, UserContext userContext) {
        this.orderService = orderService;
        this.userContext = userContext;
    }

    @PostMapping
    public OrderResponse create(@RequestBody OrderService.CreateOrderRequest req) {
        return orderService.createOrder(userContext.currentUserId(), req);
    }

    @GetMapping("/{id}")
    public OrderResponse get(@PathVariable UUID id) {
        return orderService.getOrder(id, userContext.currentUserId());
    }

    @PostMapping("/{id}/pay")
    public void pay(@PathVariable UUID id) { orderService.pay(id, userContext.currentUserId()); }

    @PostMapping("/{id}/cancel")
    public void cancel(@PathVariable UUID id) { orderService.cancel(id, userContext.currentUserId()); }

    @PostMapping("/{id}/refund")
    public void refund(@PathVariable UUID id) { orderService.refund(id, userContext.currentUserId()); }

    @PostMapping("/{id}/ship")
    public void ship(@PathVariable UUID id) { orderService.ship(id, userContext.currentUserId()); }
}
