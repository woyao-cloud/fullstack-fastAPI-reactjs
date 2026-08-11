CREATE TABLE cart (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL,
    sku_id     UUID NOT NULL,
    quantity   INT NOT NULL,
    checked    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, sku_id)
);

CREATE TABLE orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no     VARCHAR(32) NOT NULL UNIQUE,
    user_id      UUID NOT NULL,
    status       VARCHAR(20) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    pay_amount   DECIMAL(10,2) NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at      TIMESTAMP,
    closed_at    TIMESTAMP,
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE order_item (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     UUID NOT NULL REFERENCES orders(id),
    sku_id       UUID NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    sku_spec     VARCHAR(500),
    price        DECIMAL(10,2) NOT NULL,
    quantity     INT NOT NULL,
    subtotal     DECIMAL(10,2) NOT NULL
);

CREATE TABLE payment (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pay_no   VARCHAR(32) NOT NULL UNIQUE,
    order_id UUID NOT NULL REFERENCES orders(id),
    amount   DECIMAL(10,2) NOT NULL,
    status   VARCHAR(20) NOT NULL,
    channel  VARCHAR(20) NOT NULL DEFAULT 'MOCK',
    paid_at  TIMESTAMP
);
