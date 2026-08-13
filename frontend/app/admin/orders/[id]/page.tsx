"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { adminOrdersApi } from "@/lib/api/orders";
import type { OrderResponse } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { Button } from "@/components/ui/button";

function OrderDetailContent() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderResponse | null>(null);

  const load = useCallback(() => {
    adminOrdersApi.get(id).then((r) => setOrder(r.data)).catch(() => setOrder(null));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
  };

  if (!order) return <p className="text-muted-foreground">订单不存在</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">订单 {order.orderNo}</h2>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="space-y-2">
        {order.items.map((it) => (
          <p key={it.skuId} className="border-b py-2 text-sm">
            {it.productName} {it.skuSpec} × {it.quantity} — ¥{Number(it.subtotal).toFixed(2)}
          </p>
        ))}
      </div>
      <p className="font-semibold">合计 ¥{Number(order.totalAmount).toFixed(2)}</p>
      {order.status === "PAID" && (
        <div className="flex gap-2">
          <Button onClick={() => act(() => adminOrdersApi.ship(order.id), "已发货")}>发货</Button>
          <Button variant="outline" onClick={() => act(() => adminOrdersApi.refund(order.id), "已退款")}>退款</Button>
        </div>
      )}
    </div>
  );
}

export default function AdminOrderDetailPage() {
  return (
    <PermissionGuard code="order:manage">
      <h1 className="mb-4 text-xl font-semibold">订单详情</h1>
      <OrderDetailContent />
    </PermissionGuard>
  );
}
