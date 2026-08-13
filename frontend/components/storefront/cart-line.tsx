"use client";
import type { CartItem } from "@/types/api";
import { Button } from "@/components/ui/button";

export function CartLine({ item, checked, onToggle, onRemove }: {
  item: CartItem; checked: boolean; onToggle: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded border p-3">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <div className="flex-1">
        <p className="font-medium">{item.productName || "…"}</p>
        <p className="text-sm text-muted-foreground">
          {item.skuSpec ? `${item.skuSpec} · ¥${Number(item.price).toFixed(2)} × ${item.quantity}` : ""}
        </p>
      </div>
      <Button variant="ghost" size="sm" onClick={onRemove}>删除</Button>
    </div>
  );
}
