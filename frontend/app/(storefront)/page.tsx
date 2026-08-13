"use client";
import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { productsApi } from "@/lib/api/products";
import { categoriesApi } from "@/lib/api/categories";
import { brandsApi } from "@/lib/api/brands";
import { productSearchSchema } from "@/lib/schemas/product";
import type { CategoryResponse, BrandResponse, PageResponse, SpuResponse } from "@/types/api";
import { ProductCard } from "@/components/storefront/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function StorefrontHomeInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Number(sp.get("page") ?? 0);
  const [data, setData] = useState<PageResponse<SpuResponse> | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [brands, setBrands] = useState<BrandResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { categoriesApi.tree().then((r) => setCategories(r.data)).catch(() => {}); }, []);
  useEffect(() => { brandsApi.list(0, 100).then((r) => setBrands(r.data.items)).catch(() => {}); }, []);

  const load = useCallback(() => {
    setLoading(true);
    const raw = {
      q: sp.get("q") ?? undefined,
      category: sp.get("category") ?? undefined,
      brand: sp.get("brand") ?? undefined,
      minPrice: sp.get("minPrice") ?? undefined,
      maxPrice: sp.get("maxPrice") ?? undefined,
      sort: sp.get("sort") ?? undefined,
      page: sp.get("page") ?? undefined,
      size: sp.get("size") ?? undefined,
    };
    const parsed = productSearchSchema.safeParse(raw);
    // 后端 ProductQueryService.search 不支持 sort, 不透传 sort
    const params = parsed.success
      ? {
          q: parsed.data.q,
          category: parsed.data.category,
          brand: parsed.data.brand,
          minPrice: parsed.data.minPrice,
          maxPrice: parsed.data.maxPrice,
          page: parsed.data.page,
          size: parsed.data.size,
        }
      : {
          q: raw.q,
          category: raw.category,
          brand: raw.brand,
          minPrice: raw.minPrice,
          maxPrice: raw.maxPrice,
          page: Number(raw.page ?? 0),
          size: 12,
        };
    productsApi.search(params)
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sp]);

  useEffect(() => { load(); }, [load]);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.set("page", "0");
    router.push(`/?${next.toString()}`);
  };
  const goPage = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set("page", String(p));
    router.push(`/?${next.toString()}`);
  };

  return (
    <div className="container mx-auto grid grid-cols-[220px_1fr] gap-6 p-6">
      <aside className="space-y-6">
        <div>
          <h3 className="mb-2 font-semibold">分类</h3>
          {categories.map((c) => (
            <button key={c.id} className="block text-sm hover:underline" onClick={() => push({ category: c.slug })}>
              {c.name}
            </button>
          ))}
        </div>
        <div>
          <h3 className="mb-2 font-semibold">品牌</h3>
          {brands.map((b) => (
            <button key={b.id} className="block text-sm hover:underline" onClick={() => push({ brand: b.name })}>
              {b.name}
            </button>
          ))}
        </div>
      </aside>
      <section>
        <div className="mb-4 flex items-center gap-4">
          <span className="text-sm text-muted-foreground">共 {data?.total ?? 0} 件</span>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
        {data && data.total > data.size && (
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => goPage(page - 1)}>上一页</Button>
            <span className="text-sm text-muted-foreground">
              第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
            </span>
            <Button variant="outline" size="sm"
              disabled={(page + 1) * data.size >= data.total} onClick={() => goPage(page + 1)}>下一页</Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default function StorefrontHome() {
  return (
    <Suspense fallback={<div className="container mx-auto p-6"><Skeleton className="h-64" /></div>}>
      <StorefrontHomeInner />
    </Suspense>
  );
}
