CREATE TABLE sku (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spu_id          UUID NOT NULL REFERENCES spu(id) ON DELETE CASCADE,
    specs           JSONB NOT NULL DEFAULT '{}',
    price           DECIMAL(10,2) NOT NULL,
    stock           INT NOT NULL DEFAULT 0,
    locked_stock    INT NOT NULL DEFAULT 0,
    sku_code        VARCHAR(50) NOT NULL UNIQUE,
    bar_code        VARCHAR(50),
    weight          DECIMAL(10,3),
    images          JSONB,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sku_spu_id ON sku(spu_id);
CREATE INDEX idx_sku_sku_code ON sku(sku_code);
CREATE INDEX idx_sku_bar_code ON sku(bar_code);
