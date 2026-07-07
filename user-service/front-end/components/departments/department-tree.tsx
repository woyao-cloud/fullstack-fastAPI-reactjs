"use client";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { DepartmentTreeNode } from "@/types/user";
import { useState } from "react";

interface Props {
  tree: DepartmentTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function TreeNode({ node, selectedId, onSelect, depth }: { node: DepartmentTreeNode; selectedId: string | null; onSelect: (id: string) => void; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <button
        onClick={() => { onSelect(node.id); }}
        className={cn(
          "flex items-center gap-1 w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
          selectedId === node.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="cursor-pointer">
            {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </span>
        ) : <span className="size-4" />}
        <span>{node.name}</span>
        <span className="text-xs text-muted-foreground ml-1">({node.code})</span>
      </button>
      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DepartmentTree({ tree, selectedId, onSelect }: Props) {
  return (
    <div className="border rounded-md p-2">
      {tree.length === 0 ? (
        <p className="text-sm text-muted-foreground p-2">暂无部门</p>
      ) : (
        tree.map((node) => (
          <TreeNode key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} depth={0} />
        ))
      )}
    </div>
  );
}