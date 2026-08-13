"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ordersApi } from "@/lib/api/orders";
import type { OrderResponse, OrderStatus, PageResponse } from "@/types/api";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const TABS: Array<{ key: OrderStatus | ""; label: string }> = [
  { key: "", label: "全部" },
  { key: "PENDING_PAYMENT", label: "待支付" },
  { key: "PAID", label: "已支付" },
  { key: "SHIPPED", label: "已发货" },
  { key: "COMPLETED", label: "已完成" },
  { key: "CLOSED", label: "已关闭" },
  { key: "REFUNDED", label: "已退款" },
];

export default function OrdersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<OrderResponse> | null>(null);
  const [notAuthed, setNotAuthed] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => { setPage(0); }, [tab]);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    ordersApi.list(tab === "" ? undefined : tab, page, 10)
      .then((r) => { if (!cancelled) setData(r.data); })
      .catch((e) => {
        if (cancelled) return;
        if ((e as { response?: { status?: number } })?.response?.status === 401) setNotAuthed(true);
        else { setData(null); setError(true); toast.error(e instanceof Error ? e.message : "订单加载失败"); }
      });
    return () => { cancelled = true; };
  }, [tab, page]);

  if (notAuthed) return (
    <div className="container mx-auto p-6 text-center text-muted-foreground">
      <p>登录后查看订单</p>
      <Button className="mt-4" onClick={() => router.push("/login?redirect=/orders")}>去登录</Button>
    </div>
  );

  return (
    <div className="container mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">我的订单</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-sm ${tab === t.key ? "border-primary bg-primary/10" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-muted-foreground">订单加载失败，请稍后重试</p> : !data ? <Skeleton className="h-40" /> : (
        <div className="space-y-3">
          {data.items.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-muted/50">
              <span>{o.orderNo}</span>
              <span className="font-semibold">¥{Number(o.totalAmount).toFixed(2)}</span>
              <OrderStatusBadge status={o.status} />
            </Link>
          ))}
          {data.items.length === 0 && <p className="text-muted-foreground">暂无订单</p>}
        </div>
      )}
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">
            第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
          </span>
          <Button variant="outline" size="sm"
            disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
    </div>
  );
}
