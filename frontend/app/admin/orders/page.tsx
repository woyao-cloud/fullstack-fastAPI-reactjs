"use client";
import { useEffect, useState } from "react";
import { adminOrdersApi } from "@/lib/api/orders";
import type { OrderResponse, OrderStatus, PageResponse } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { OrderTable } from "@/components/admin/order-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const TABS: Array<{ key: OrderStatus | ""; label: string }> = [
  { key: "", label: "全部" }, { key: "PENDING_PAYMENT", label: "待支付" }, { key: "PAID", label: "已支付" },
  { key: "SHIPPED", label: "已发货" }, { key: "COMPLETED", label: "已完成" },
  { key: "CLOSED", label: "已关闭" }, { key: "REFUNDED", label: "已退款" },
];

function OrderManageContent() {
  const [tab, setTab] = useState<OrderStatus | "">("");
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PageResponse<OrderResponse> | null>(null);

  useEffect(() => { setPage(0); }, [tab]);
  useEffect(() => {
    adminOrdersApi.list(tab === "" ? undefined : tab, page, 10)
      .then((r) => setData(r.data)).catch(() => setData(null));
  }, [tab, page]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-sm ${tab === t.key ? "border-primary bg-primary/10" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>
      {!data ? <Skeleton className="h-40" /> : (
        <>
          <OrderTable rows={data.items}
            onRowClick={(o) => { window.location.href = `/admin/orders/${o.id}`; }} />
          {data.items.length === 0 && <p className="text-muted-foreground">暂无订单</p>}
          {data.total > data.size && (
            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>上一页</Button>
              <span className="text-sm text-muted-foreground">
                第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页
              </span>
              <Button variant="outline" size="sm"
                disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>下一页</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <PermissionGuard code="order:manage">
      <h1 className="mb-4 text-xl font-semibold">订单管理</h1>
      <OrderManageContent />
    </PermissionGuard>
  );
}
