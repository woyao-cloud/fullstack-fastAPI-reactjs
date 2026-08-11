#!/usr/bin/env bash
# =============================================================
# 加载三服务测试数据到本地 compose 测试环境
# 前置: docker compose up -d --build 已启动 (postgres-product/inventory/order 健康)
# 用法: bash scripts/test-data/load-test-data.sh
# 幂等: 每个 SQL 开头 TRUNCATE, 可反复执行
# =============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# ---------- 前置检查 ----------
if ! docker compose version >/dev/null 2>&1; then
    echo "错误: 未找到 docker 命令。请先安装 Docker Desktop 并启动。" >&2
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    echo "错误: Docker daemon 未运行。请启动 Docker Desktop 后重试。" >&2
    exit 1
fi
for svc in postgres-product postgres-inventory postgres-order; do
    if ! docker compose ps -q "$svc" | grep -q .; then
        echo "错误: 服务 $svc 未运行。请先执行: docker compose up -d --build" >&2
        exit 1
    fi
done

DATA_DIR="scripts/test-data"

# ---------- 逐模块加载 ----------
echo "==> [1/3] 加载 product-service 测试数据 (product_service@:5433)"
docker compose exec -T -e PGPASSWORD=product123 postgres-product \
    psql -U product -d product_service -v ON_ERROR_STOP=1 \
    -f /dev/stdin < "$DATA_DIR/product.sql"
docker compose exec -T -e PGPASSWORD=product123 postgres-product \
    psql -U product -d product_service -t -A -c \
    "SELECT '  category='||(SELECT count(*) FROM category)||' brand='||(SELECT count(*) FROM brand)||' spu='||(SELECT count(*) FROM spu)||' sku='||(SELECT count(*) FROM sku)"

echo "==> [2/3] 加载 inventory-service 测试数据 (inventory_service@:5434)"
docker compose exec -T -e PGPASSWORD=inventory123 postgres-inventory \
    psql -U inventory -d inventory_service -v ON_ERROR_STOP=1 \
    -f /dev/stdin < "$DATA_DIR/inventory.sql"
docker compose exec -T -e PGPASSWORD=inventory123 postgres-inventory \
    psql -U inventory -d inventory_service -t -A -c \
    "SELECT '  inventory='||(SELECT count(*) FROM inventory)||' inventory_event='||(SELECT count(*) FROM inventory_event)"

echo "==> [3/3] 加载 order-service 测试数据 (order_service@:5435)"
docker compose exec -T -e PGPASSWORD=order123 postgres-order \
    psql -U order -d order_service -v ON_ERROR_STOP=1 \
    -f /dev/stdin < "$DATA_DIR/order.sql"
docker compose exec -T -e PGPASSWORD=order123 postgres-order \
    psql -U order -d order_service -t -A -c \
    "SELECT '  cart='||(SELECT count(*) FROM cart)||' orders='||(SELECT count(*) FROM orders)||' order_item='||(SELECT count(*) FROM order_item)||' payment='||(SELECT count(*) FROM payment)"

echo
echo "测试数据加载完成 ✅  详见 scripts/test-data/README.md"
