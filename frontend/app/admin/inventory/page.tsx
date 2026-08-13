"use client";
import { useState } from "react";
import { inventoryApi } from "@/lib/api/inventory";
import type { InventoryStock } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function InventoryContent() {
  const [skuId, setSkuId] = useState("");
  const [stock, setStock] = useState<InventoryStock | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = async () => {
    if (!skuId.trim()) return;
    setError(null);
    try { setStock((await inventoryApi.get(skuId.trim())).data); }
    catch { setStock(null); setError("查询失败，SKU 不存在或库存服务不可达"); }
  };

  return (
    <div className="max-w-md space-y-4">
      <div className="flex gap-2">
        <Input placeholder="输入 SKU id" value={skuId} onChange={(e) => setSkuId(e.target.value)} />
        <Button onClick={query}>查询</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {stock && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded border p-3 text-center">
            <p className="text-2xl font-semibold">{stock.quantity}</p>
            <p className="text-sm text-muted-foreground">总库存</p>
          </div>
          <div className="rounded border p-3 text-center">
            <p className="text-2xl font-semibold">{stock.frozen}</p>
            <p className="text-sm text-muted-foreground">冻结</p>
          </div>
          <div className="rounded border p-3 text-center">
            <p className="text-2xl font-semibold">{stock.available}</p>
            <p className="text-sm text-muted-foreground">可售</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <PermissionGuard code="inventory:manage">
      <h1 className="mb-4 text-xl font-semibold">库存查询</h1>
      <InventoryContent />
    </PermissionGuard>
  );
}
