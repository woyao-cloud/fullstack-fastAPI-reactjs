"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cartApi } from "@/lib/api/cart";
import { useCartStore } from "@/stores/cart";
import type { CartItem } from "@/types/api";
import { CartLine } from "@/components/storefront/cart-line";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  const router = useRouter();
  const { checkedBySku, setInitial, toggle, toggleAll } = useCartStore();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthed, setNotAuthed] = useState(false);

  useEffect(() => {
    cartApi.list().then((r) => {
      setItems(r.data);
      setInitial(r.data.map((c) => c.skuId), r.data.map((c) => c.checked));
      setLoading(false);
    }).catch((e) => {
      setLoading(false);
      if ((e as { response?: { status?: number } })?.response?.status === 401) {
        setNotAuthed(true);
      } else {
        toast.error(e instanceof Error ? e.message : "购物车加载失败");
      }
    });
  }, [setInitial]);

  const checked = items.filter((c) => checkedBySku[c.skuId]);
  const total = checked.reduce((sum, c) => sum + Number(c.price) * c.quantity, 0);

  const remove = async (skuId: string) => {
    await cartApi.remove(skuId);
    setItems((prev) => prev.filter((c) => c.skuId !== skuId));
  };

  const checkout = () => {
    if (checked.length === 0) { toast.info("请先勾选商品"); return; }
    router.push("/checkout");
  };

  if (loading) return <div className="container mx-auto p-6 text-muted-foreground">加载中…</div>;
  if (notAuthed) return (
    <div className="container mx-auto p-6 text-center text-muted-foreground">
      <p>登录后查看购物车</p>
      <Button className="mt-4" onClick={() => router.push("/login?redirect=/cart")}>去登录</Button>
    </div>
  );
  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">购物车</h1>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={items.length > 0 && checked.length === items.length}
          onChange={(e) => toggleAll(items.map((c) => c.skuId), e.target.checked)} />
        全选
      </label>
      {items.map((c) => (
        <CartLine key={c.skuId} item={c} checked={!!checkedBySku[c.skuId]}
          onToggle={() => toggle(c.skuId)} onRemove={() => remove(c.skuId)} />
      ))}
      {items.length === 0 && <p className="text-muted-foreground">购物车是空的</p>}
      <div className="flex items-center justify-between border-t pt-4">
        <span>已选 {checked.length} 件，合计 <strong className="text-primary">¥{total.toFixed(2)}</strong></span>
        <Button onClick={checkout} disabled={checked.length === 0}>去结算</Button>
      </div>
    </div>
  );
}
