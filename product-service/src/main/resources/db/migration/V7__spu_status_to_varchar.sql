-- Spu.status 由 PG 原生枚举 spu_status 改为 VARCHAR(20):
-- 实体改为 @Enumerated(EnumType.STRING), 规避 Hibernate 6 NAMED_ENUM 按简单类名(SpuStatus)
-- 解析类型名与 Flyway 建的 spu_status 不匹配导致的 ddl-auto:validate 启动失败。
-- USING status::text 保留现有枚举值(draft/active/inactive), 与 Java 枚举常量名一致。
ALTER TABLE spu ALTER COLUMN status TYPE VARCHAR(20) USING status::text;
DROP TYPE spu_status;
