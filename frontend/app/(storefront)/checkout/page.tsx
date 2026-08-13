"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cartApi } from "@/lib/api/cart";
import { ordersApi } from "@/lib/api/orders";
import { useCartStore } from "@/stores/cart";
import type { CartItem } from "@/types/api";
import { Button } from "@/components/ui/button";

export default function CheckoutPage() {
  const router = useRouter();
  const { checkedBySku } = useCartStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cartApi.list().then((r) => setItems(r.data.filter((c) => checkedBySku[c.skuId])))
      .catch(() => setItems([]));
  }, [checkedBySku]);

  const submit = async () => {
    const lines = items.map((c) => ({ skuId: c.skuId, quantity: c.quantity }));
    if (lines.length === 0) { toast.info("没有可结算的商品"); return; }
    setSubmitting(true);
    try {
      const { data } = await ordersApi.create({ lines });
      toast.success("下单成功");
      router.push(`/orders/${data.id}`);
    } catch (e) {
      // 库存不足 -> 后端保留 CLOSED 订单, 前端提示
      toast.error(e instanceof Error ? e.message : "下单失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">确认订单</h1>
      {items.map((c) => (
        <div key={c.skuId} className="border-b py-2 text-sm">
          <p className="font-medium">{c.productName || "…"}</p>
          <p className="text-muted-foreground">{c.skuSpec ? `${c.skuSpec} · ` : ""}¥{Number(c.price).toFixed(2)} × {c.quantity}</p>
        </div>
      ))}
      {items.length === 0 && <p className="text-muted-foreground">没有已勾选的商品</p>}
      <Button onClick={submit} disabled={submitting || items.length === 0}>
        {submitting ? "提交中…" : "提交订单"}
      </Button>
    </div>
  );
}
