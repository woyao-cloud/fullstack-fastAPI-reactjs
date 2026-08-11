package com.order.web;

import com.order.domain.entity.Cart;
import com.order.service.CartService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cart")
public class CartController {

    private final CartService cartService;
    private final UserContext userContext;

    public CartController(CartService cartService, UserContext userContext) {
        this.cartService = cartService;
        this.userContext = userContext;
    }

    @PostMapping
    public void add(@RequestBody CartService.AddItemRequest req) {
        cartService.add(userContext.currentUserId(), req);
    }

    @GetMapping
    public List<Cart> list() {
        return cartService.list(userContext.currentUserId());
    }

    @DeleteMapping("/{skuId}")
    public void remove(@PathVariable UUID skuId) {
        cartService.remove(userContext.currentUserId(), skuId);
    }
}
