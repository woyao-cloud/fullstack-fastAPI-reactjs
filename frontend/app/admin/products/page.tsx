"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import type { ProductSearchParams } from "@/lib/api/products";
import type { PageResponse, SpuResponse, SpuStatus } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<{ key: SpuStatus | ""; label: string }> = [
  { key: "", label: "全部" }, { key: "active", label: "在售" },
  { key: "draft", label: "草稿" }, { key: "inactive", label: "下架" },
];
const STATUS_LABEL: Record<SpuStatus, string> = { draft: "草稿", active: "在售", inactive: "下架" };

function ProductListContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const page = Number(sp.get("page") ?? 0);
  const q = sp.get("q") ?? "";
  const status = (sp.get("status") ?? "") as SpuStatus | "";
  const [data, setData] = useState<PageResponse<SpuResponse> | null>(null);

  useEffect(() => {
    // 后端按 status 过滤并分页(Step 1 契约): 空→"all" 全部, 否则按值
    const params: ProductSearchParams = {
      q: q || undefined, page, size: 10, status: status || "all",
    };
    productsApi.search(params).then((r) => setData(r.data)).catch(() => setData(null));
  }, [sp]);

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    next.set("page", "0");
    router.push(`/admin/products?${next.toString()}`);
  };
  const goPage = (p: number) => {
    const next = new URLSearchParams(sp.toString());
    next.set("page", String(p));
    router.push(`/admin/products?${next.toString()}`);
  };

  const toggle = async (p: SpuResponse) => {
    const target: SpuStatus = p.status === "active" ? "inactive" : "active";
    await productsApi.changeStatus(p.id, target);
    toast.success(target === "active" ? "已上架" : "已下架");
    setData((d) => d ? { ...d, items: d.items.map((x) => x.id === p.id ? { ...x, status: target } : x) } : d);
  };
  const remove = async (p: SpuResponse) => {
    if (!window.confirm(`确定删除「${p.name}」？`)) return;
    await productsApi.remove(p.id);
    toast.success("已删除");
    go({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input defaultValue={q} placeholder="搜索商品名" className="max-w-xs"
          onKeyDown={(e) => { if (e.key === "Enter") go({ q: (e.target as HTMLInputElement).value || null }); }} />
        <select value={status} onChange={(e) => go({ status: e.target.value || null })}
          className="rounded border px-2 py-1 text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <Link href="/admin/products/new" className={cn(buttonVariants(), "ml-auto")}>新建商品</Link>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2">名称</th><th>分类</th><th>状态</th><th className="text-right">操作</th>
        </tr></thead>
        <tbody>
          {data?.items.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2"><Link href={`/admin/products/${p.id}`} className="hover:underline">{p.name}</Link></td>
              <td>{p.category?.name ?? "—"}</td>
              <td><Badge variant="outline">{STATUS_LABEL[p.status]}</Badge></td>
              <td className="space-x-2 text-right">
                <Button variant="outline" size="sm" onClick={() => toggle(p)}>
                  {p.status === "active" ? "下架" : "上架"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(p)}>删除</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && data.items.length === 0 && <p className="text-muted-foreground">暂无商品</p>}
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => goPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
          </span>
          <Button variant="outline" size="sm"
            disabled={(page + 1) * data.size >= data.total} onClick={() => goPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}

export default function AdminProductsPage() {
  return (
    <PermissionGuard code="product:manage">
      <h1 className="mb-4 text-xl font-semibold">商品管理</h1>
      <Suspense fallback={null}>
        <ProductListContent />
      </Suspense>
    </PermissionGuard>
  );
}
