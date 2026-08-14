package com.product.web;

import com.product.domain.entity.Spu;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void optimisticLockMapsToConflict() {
        var resp = handler.handleOptimisticLock(
                new ObjectOptimisticLockingFailureException(Spu.class, "spu-id"));
        assertEquals(HttpStatus.CONFLICT, resp.getStatusCode());
    }

    @Test
    void illegalArgumentMapsToBadRequest() {
        var resp = handler.handleBadRequest(new IllegalArgumentException("商品不存在"));
        assertEquals(HttpStatus.BAD_REQUEST, resp.getStatusCode());
    }
}
