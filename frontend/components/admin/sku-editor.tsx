"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { skuSchema } from "@/lib/schemas/spu";
import type { z } from "zod";

export type SkuRow = z.infer<typeof skuSchema>;

// 内部用字符串保存 price/weight 原始输入, 提交时转 number (schema 用 z.coerce.number)
type RawSku = {
  specPairs: { key: string; value: string }[];
  price: string;
  skuCode: string;
  barCode: string | null;
  weight: string | null;
  images: string[];
  isActive: boolean;
};

function toRaw(s: SkuRow): RawSku {
  return {
    specPairs: Object.entries(s.specs ?? {}).map(([key, value]) => ({ key, value })),
    price: s.price == null ? "" : String(s.price),
    skuCode: s.skuCode ?? "",
    barCode: s.barCode ?? null,
    weight: s.weight == null ? null : String(s.weight),
    images: s.images ?? [],
    isActive: s.isActive ?? true,
  };
}

function toRow(r: RawSku): SkuRow {
  const specs: Record<string, string> = {};
  r.specPairs.forEach((p) => { if (p.key) specs[p.key] = p.value; });
  return {
    specs,
    price: r.price === "" ? 0 : Number(r.price),
    skuCode: r.skuCode,
    barCode: r.barCode,
    weight: r.weight == null || r.weight === "" ? null : Number(r.weight),
    images: r.images,
    isActive: r.isActive,
  };
}

export function SkuEditor({ value, onChange }: { value: SkuRow[]; onChange: (rows: SkuRow[]) => void }) {
  const [rows, setRows] = useState<RawSku[]>(() => value.map(toRaw));

  const commit = (next: RawSku[]) => { setRows(next); onChange(next.map(toRow)); };
  const update = (i: number, patch: Partial<RawSku>) => commit(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addSku = () => commit([...rows, { specPairs: [], price: "", skuCode: "", barCode: null, weight: null, images: [], isActive: true }]);
  const remove = (i: number) => commit(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">SKU #{i + 1}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>删除</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">规格:</span>
            {row.specPairs.map((p, j) => (
              <div key={j} className="flex items-center gap-1">
                <Input placeholder="规格名" className="w-28" value={p.key}
                  onChange={(e) => update(i, { specPairs: row.specPairs.map((x, k) => k === j ? { ...x, key: e.target.value } : x) })} />
                <Input placeholder="规格值" className="w-28" value={p.value}
                  onChange={(e) => update(i, { specPairs: row.specPairs.map((x, k) => k === j ? { ...x, value: e.target.value } : x) })} />
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => update(i, { specPairs: row.specPairs.filter((_, k) => k !== j) })}>✕</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm"
              onClick={() => update(i, { specPairs: [...row.specPairs, { key: "", value: "" }] })}>+规格</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">价格 *</span>
              <Input type="number" value={row.price} placeholder="0.00"
                onChange={(e) => update(i, { price: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">SKU 编码 *</span>
              <Input value={row.skuCode} placeholder="SKU-001"
                onChange={(e) => update(i, { skuCode: e.target.value })} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">条码</span>
              <Input value={row.barCode ?? ""} placeholder="可选"
                onChange={(e) => update(i, { barCode: e.target.value || null })} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">重量(kg)</span>
              <Input type="number" value={row.weight ?? ""} placeholder="可选"
                onChange={(e) => update(i, { weight: e.target.value || null })} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={row.isActive} onCheckedChange={(v) => update(i, { isActive: v === true })} />
            启用该 SKU
          </label>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addSku}>添加 SKU</Button>
    </div>
  );
}
