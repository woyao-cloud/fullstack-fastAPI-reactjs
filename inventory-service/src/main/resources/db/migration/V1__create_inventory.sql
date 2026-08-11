CREATE TABLE inventory (
    sku_id     UUID PRIMARY KEY,
    quantity   INT NOT NULL DEFAULT 0,
    frozen     INT NOT NULL DEFAULT 0,
    version    BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE inventory_event (
    event_id   UUID PRIMARY KEY,
    order_id   UUID NOT NULL,
    type       VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
