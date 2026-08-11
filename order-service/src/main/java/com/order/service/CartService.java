package com.order.service;

import com.order.domain.entity.Cart;
import com.order.repository.CartRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class CartService {

    private final CartRepository cartRepository;

    public CartService(CartRepository cartRepository) { this.cartRepository = cartRepository; }

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
    public List<Cart> list(UUID userId) {
        return cartRepository.findByUserIdAndCheckedTrue(userId);
    }

    public void remove(UUID userId, UUID skuId) {
        cartRepository.findByUserIdAndSkuId(userId, skuId).ifPresent(cartRepository::delete);
    }

    public void toggleChecked(UUID userId, UUID skuId, boolean checked) {
        cartRepository.findByUserIdAndSkuId(userId, skuId).ifPresent(c -> { c.setChecked(checked); });
    }

    public record AddItemRequest(UUID skuId, int quantity) {}
}
