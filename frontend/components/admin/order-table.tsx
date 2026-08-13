"use client";
import type { OrderResponse } from "@/types/api";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";

export function OrderTable({ rows, onRowClick }: {
  rows: OrderResponse[]; onRowClick: (o: OrderResponse) => void;
}) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b text-left text-muted-foreground">
        <th className="py-2">订单号</th><th>状态</th><th className="text-right">金额</th>
      </tr></thead>
      <tbody>
        {rows.map((o) => (
          <tr key={o.id} className="cursor-pointer border-b hover:bg-muted/50" onClick={() => onRowClick(o)}>
            <td className="py-2">{o.orderNo}</td>
            <td><OrderStatusBadge status={o.status} /></td>
            <td className="text-right">¥{Number(o.totalAmount).toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
