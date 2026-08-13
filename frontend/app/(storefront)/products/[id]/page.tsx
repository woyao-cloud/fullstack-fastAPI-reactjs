"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import { inventoryApi } from "@/lib/api/inventory";
import { cartApi } from "@/lib/api/cart";
import { useAuthStore } from "@/stores/auth";
import type { SkuResponse, SpuResponse } from "@/types/api";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [product, setProduct] = useState<SpuResponse | null>(null);
  const [selected, setSelected] = useState<SkuResponse | null>(null);
  const [available, setAvailable] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productsApi.detail(id).then((r) => {
      setProduct(r.data);
      const first = r.data.skus.find((s) => s.isActive) ?? r.data.skus[0];
      setSelected(first ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // 选中 SKU 变化 -> 懒加载真实可售库存（product 的 available 恒 0）
  useEffect(() => {
    if (!selected) return;
    setAvailable(null);
    inventoryApi.get(selected.id).then((r) => setAvailable(r.data.available)).catch(() => setAvailable(0));
    setQty(1);
  }, [selected]);

  const addToCart = async () => {
    if (!selected) return;
    if (!isAuthenticated) { router.push(`/login?redirect=${encodeURIComponent(`/products/${id}`)}`); return; }
    try {
      await cartApi.add(selected.id, qty);
      toast.success("已加入购物车");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "加购失败");
    }
  };

  if (loading) return <div className="container mx-auto p-6"><Skeleton className="h-96" /></div>;
  if (!product) return <div className="container mx-auto p-6 text-muted-foreground">商品不存在</div>;

  const maxQty = available ?? 999;
  return (
    <div className="container mx-auto grid grid-cols-2 gap-8 p-6">
      <div className="space-y-2">
        {product.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.coverImage} alt={product.name}
            className="aspect-square w-full rounded-lg object-cover" />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">暂无图片</div>
        )}
        <div className="flex gap-2">
          {product.images.slice(0, 4).map((img, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={img} alt="" className="h-16 w-16 rounded border object-cover" />
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <Badge variant={product.status === "active" ? "default" : "secondary"}>
          {product.status === "active" ? "在售" : "已下架"}
        </Badge>
        <p className="text-muted-foreground">{product.description}</p>
        {/* 规格选择: 遍历 specsTemplate, 按选中组合匹配 sku; 简化为按 sku 列表单选 */}
        <div className="space-y-2">
          <h3 className="font-medium">规格</h3>
          {product.skus.filter((s) => s.isActive).map((s) => (
            <button key={s.id} onClick={() => setSelected(s)}
              className={`rounded border px-3 py-1 text-sm ${selected?.id === s.id ? "border-primary bg-primary/10" : ""}`}>
              {Object.values(s.specs).join(" / ") || s.skuCode}
            </button>
          ))}
        </div>
        <p className="text-xl font-semibold text-primary">
          ¥{selected ? Number(selected.price).toFixed(2) : "—"}
        </p>
        <p className="text-sm text-muted-foreground">
          {available === null ? "库存查询中…" : available > 0 ? `可售 ${available} 件` : "暂时缺货"}
        </p>
        {selected && available !== 0 && (
          <>
            <QuantityStepper value={qty} onChange={setQty} max={maxQty} />
            <Button onClick={addToCart}>加入购物车</Button>
          </>
        )}
      </div>
    </div>
  );
}
