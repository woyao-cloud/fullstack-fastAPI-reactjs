-- V6: 乐观锁版本列 + SKU bar_code 唯一约束
-- 对应 Sku/Spu 实体 @Version 与 bar_code unique 映射 (review C1/C4 修复)
ALTER TABLE spu ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sku ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE sku ADD CONSTRAINT uq_sku_bar_code UNIQUE (bar_code);
