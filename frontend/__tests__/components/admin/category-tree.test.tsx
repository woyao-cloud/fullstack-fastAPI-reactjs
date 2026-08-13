import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CategoryTree } from "@/components/admin/category-tree";
import type { CategoryResponse } from "@/types/api";

const child: CategoryResponse = { id: "b", name: "子类", slug: "c", parentId: "a", sortOrder: 0, icon: null, isActive: false, children: [] };
const tree: CategoryResponse[] = [
  { id: "a", name: "父类", slug: "p", parentId: null, sortOrder: 1, icon: null, isActive: true, children: [child] },
];

describe("CategoryTree", () => {
  it("renders nested categories with slug and inactive marker", () => {
    render(<CategoryTree nodes={tree} onEdit={() => {}} onAdd={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("父类")).toBeInTheDocument();
    expect(screen.getByText(/slug: p · sort: 1/)).toBeInTheDocument();
    expect(screen.getByText("子类")).toBeInTheDocument();
    expect(screen.getByText("(停用)")).toBeInTheDocument();
  });

  it("fires edit/add/remove callbacks", () => {
    const onEdit = vi.fn();
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    render(<CategoryTree nodes={tree} onEdit={onEdit} onAdd={onAdd} onRemove={onRemove} />);
    fireEvent.click(screen.getAllByText("编辑")[0]);
    expect(onEdit).toHaveBeenCalledWith(tree[0]);
    fireEvent.click(screen.getAllByText("加子级")[0]);
    expect(onAdd).toHaveBeenCalledWith(tree[0]);
    fireEvent.click(screen.getAllByText("删除")[0]);
    expect(onRemove).toHaveBeenCalledWith(tree[0]);
  });
});
