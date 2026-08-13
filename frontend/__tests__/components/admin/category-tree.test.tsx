import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryTree } from "@/components/admin/category-tree";
import type { CategoryResponse } from "@/types/api";

const tree: CategoryResponse[] = [
  { id: "a", name: "父类", slug: "p", parentId: null, sortOrder: 0, icon: null, isActive: true,
    children: [{ id: "b", name: "子类", slug: "c", parentId: "a", sortOrder: 0, icon: null, isActive: true, children: [] }] },
];

describe("CategoryTree", () => {
  it("renders nested categories", () => {
    render(<CategoryTree nodes={tree} onEdit={() => {}} onAdd={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("父类")).toBeInTheDocument();
    expect(screen.getByText("子类")).toBeInTheDocument();
  });
});
