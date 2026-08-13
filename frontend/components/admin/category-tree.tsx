"use client";
import type { CategoryResponse } from "@/types/api";
import { Button } from "@/components/ui/button";

export function CategoryTree({ nodes, onEdit, onAdd, onRemove }: {
  nodes: CategoryResponse[];
  onEdit: (c: CategoryResponse) => void;
  onAdd: (c: CategoryResponse) => void;
  onRemove: (c: CategoryResponse) => void;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((c) => (
        <li key={c.id}>
          <div className="flex items-center gap-2 rounded border px-3 py-2">
            <span className="flex-1">
              {c.name}
              <span className="ml-2 text-xs text-muted-foreground">slug: {c.slug} · sort: {c.sortOrder}</span>
              {!c.isActive && <span className="ml-2 text-xs text-muted-foreground">(停用)</span>}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onAdd(c)}>加子级</Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>编辑</Button>
            <Button variant="ghost" size="sm" onClick={() => onRemove(c)}>删除</Button>
          </div>
          {c.children.length > 0 && (
            <div className="ml-6 mt-1"><CategoryTree nodes={c.children} onEdit={onEdit} onAdd={onAdd} onRemove={onRemove} /></div>
          )}
        </li>
      ))}
    </ul>
  );
}
