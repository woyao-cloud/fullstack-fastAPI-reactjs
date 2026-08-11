-- 乐观锁版本列：pay/cancel/close 等状态流转并发时防止互相覆盖（如支付与超时关单竞争）
ALTER TABLE orders ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
