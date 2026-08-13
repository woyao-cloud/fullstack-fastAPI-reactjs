"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ordersApi } from "@/lib/api/orders";
import type { OrderResponse, OrderStatus } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "待支付", PAID: "已支付", SHIPPED: "已发货", COMPLETED: "已完成",
  CLOSED: "已关闭", REFUNDING: "退款中", REFUNDED: "已退款",
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderResponse | null>(null);

  const load = useCallback(() => {
    ordersApi.get(id).then((r) => setOrder(r.data)).catch(() => setOrder(null));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); }
  };

  if (!order) return <div className="container mx-auto p-6 text-muted-foreground">订单不存在</div>;
  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">订单 {order.orderNo}</h1>
        <Badge>{STATUS_LABEL[order.status]}</Badge>
      </div>
      <div className="space-y-2">
        {order.items.map((it) => (
          <p key={it.skuId} className="text-sm border-b py-2">
            {it.productName} {it.skuSpec} × {it.quantity} — ¥{Number(it.subtotal).toFixed(2)}
          </p>
        ))}
      </div>
      <p className="font-semibold">合计 ¥{Number(order.totalAmount).toFixed(2)}</p>
      <div className="flex gap-2">
        {order.status === "PENDING_PAYMENT" && (
          <>
            <Button onClick={() => act(() => ordersApi.pay(id), "支付成功")}>支付</Button>
            <Button variant="outline" onClick={() => act(() => ordersApi.cancel(id), "已取消")}>取消订单</Button>
          </>
        )}
        {order.status === "PAID" && (
          <Button variant="outline" onClick={() => act(() => ordersApi.refund(id), "已发起退款")}>申请退款</Button>
        )}
      </div>
    </div>
  );
}
