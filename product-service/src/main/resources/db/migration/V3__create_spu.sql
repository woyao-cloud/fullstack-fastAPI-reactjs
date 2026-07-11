CREATE TYPE spu_status AS ENUM ('draft', 'active', 'inactive');

CREATE TABLE spu (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    category_id     UUID NOT NULL REFERENCES category(id),
    brand_id        UUID REFERENCES brand(id),
    status          spu_status NOT NULL DEFAULT 'draft',
    cover_image     VARCHAR(255),
    images          JSONB NOT NULL DEFAULT '[]',
    specs_template  JSONB NOT NULL DEFAULT '[]',
    tags            JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spu_category_id ON spu(category_id);
CREATE INDEX idx_spu_brand_id ON spu(brand_id);
CREATE INDEX idx_spu_status ON spu(status);
CREATE INDEX idx_spu_tags ON spu USING GIN(tags);
