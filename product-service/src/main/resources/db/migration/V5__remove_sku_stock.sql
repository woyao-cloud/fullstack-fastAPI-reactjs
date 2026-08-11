-- V5__remove_sku_stock.sql
ALTER TABLE sku DROP COLUMN stock, DROP COLUMN locked_stock;
