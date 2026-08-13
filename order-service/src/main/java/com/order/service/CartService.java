package com.order.service;

import com.order.client.ProductClient;
import com.order.client.SkuSnapshot;
import com.order.domain.entity.Cart;
import com.order.repository.CartRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class CartService {

    private final CartRepository cartRepository;
    private final ProductClient productClient;

    public CartService(CartRepository cartRepository, ProductClient productClient) {
        this.cartRepository = cartRepository;
        this.productClient = productClient;
    }

    public void add(UUID userId, AddItemRequest req) {
        Cart cart = cartRepository.findByUserIdAndSkuId(userId, req.skuId()).orElseGet(() -> {
            Cart c = new Cart();
            c.setUserId(userId); c.setSkuId(req.skuId()); c.setChecked(true);
            return c;
        });
        cart.setQuantity(cart.getQuantity() + req.quantity());
        cartRepository.save(cart);
    }

    @Transactional(readOnly = true)
    public List<CartItemResponse> list(UUID userId) {
        List<Cart> carts = cartRepository.findByUserId(userId);
        if (carts.isEmpty()) { return List.of(); }
        List<UUID> skuIds = carts.stream().map(Cart::getSkuId).toList();
        Map<UUID, SkuSnapshot> byId = productClient.batchSkus(skuIds).stream()
                .collect(Collectors.toMap(SkuSnapshot::id, s -> s));
        return carts.stream().map(c -> {
            SkuSnapshot s = byId.get(c.getSkuId());
            return new CartItemResponse(c.getSkuId(), c.getQuantity(), c.isChecked(),
                    s != null ? s.productName() : null,
                    s != null ? s.skuSpec() : null,
                    s != null ? s.price() : null);
        }).toList();
    }

    public void remove(UUID userId, UUID skuId) {
        cartRepository.findByUserIdAndSkuId(userId, skuId).ifPresent(cartRepository::delete);
    }

    public void toggleChecked(UUID userId, UUID skuId, boolean checked) {
        cartRepository.findByUserIdAndSkuId(userId, skuId).ifPresent(c -> { c.setChecked(checked); });
    }

    public record AddItemRequest(
            @NotNull UUID skuId,
            @NotNull @Min(1) @Max(999) int quantity
    ) {}

    public record CartItemResponse(UUID skuId, int quantity, boolean checked,
            String productName, String skuSpec, BigDecimal price) {}
}
