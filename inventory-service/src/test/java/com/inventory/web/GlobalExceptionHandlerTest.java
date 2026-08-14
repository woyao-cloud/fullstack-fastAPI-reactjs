package com.inventory.web;

import com.inventory.domain.entity.Inventory;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void optimisticLockMapsToConflict() {
        var resp = handler.handleOptimisticLock(
                new ObjectOptimisticLockingFailureException(Inventory.class, "inv-id"));
        assertEquals(HttpStatus.CONFLICT, resp.getStatusCode());
    }

    @Test
    void illegalStateMapsToConflict() {
        var resp = handler.handleConflict(new IllegalStateException("库存不足"));
        assertEquals(HttpStatus.CONFLICT, resp.getStatusCode());
    }
}
