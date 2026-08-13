import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoriesPage from "@/app/admin/categories/page";
import { categoriesApi } from "@/lib/api/categories";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import type { CategoryResponse } from "@/types/api";

vi.mock("@/lib/api/categories", () => ({
  categoriesApi: { tree: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const child: CategoryResponse = { id: "c2", name: "子类", slug: "child", parentId: "c1", sortOrder: 0, icon: null, isActive: true, children: [] };
const tree: CategoryResponse[] = [
  { id: "c1", name: "父类", slug: "parent", parentId: null, sortOrder: 1, icon: null, isActive: true, children: [child] },
];

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ permissions: ["product:manage"], isAuthenticated: true });
  (categoriesApi.tree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: tree });
  window.confirm = vi.fn(() => true);
});

describe("CategoriesPage", () => {
  it("renders the category tree", async () => {
    render(<CategoriesPage />);
    await waitFor(() => expect(screen.getByText("父类")).toBeInTheDocument());
    expect(screen.getByText("子类")).toBeInTheDocument();
    expect(screen.getByText("顶级分类 1 个（含子级递归）")).toBeInTheDocument();
  });

  it("creates a top-level category", async () => {
    (categoriesApi.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<CategoriesPage />);
    fireEvent.click(screen.getByRole("button", { name: "新建顶级分类" }));
    await waitFor(() => expect(screen.getByLabelText("名称")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "新分类" } });
    fireEvent.change(screen.getByLabelText("slug"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(categoriesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: "新分类", slug: "new", parentId: null })), { timeout: 5000 });
    expect(toast.success).toHaveBeenCalledWith("已保存");
  });

  it("adds a child category under a node", async () => {
    (categoriesApi.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<CategoriesPage />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "加子级" }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: "加子级" })[0]);
    expect(screen.getByText("在「父类」下添加子级")).toBeInTheDocument();
  });

  it("edits an existing category", async () => {
    (categoriesApi.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<CategoriesPage />);
    await waitFor(() => expect(screen.getAllByText("编辑").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("编辑")[0]);
    await waitFor(() => expect(screen.getByText("编辑分类")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "改名" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(categoriesApi.update).toHaveBeenCalledWith("c1", expect.objectContaining({ name: "改名" })), { timeout: 5000 });
  });

  it("removes a category after confirm", async () => {
    (categoriesApi.remove as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<CategoriesPage />);
    await waitFor(() => expect(screen.getAllByText("删除").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("删除")[0]);
    await waitFor(() => expect(categoriesApi.remove).toHaveBeenCalledWith("c1"));
  });

  it("shows validation error for empty name", async () => {
    render(<CategoriesPage />);
    fireEvent.click(screen.getByRole("button", { name: "新建顶级分类" }));
    await waitFor(() => expect(screen.getByLabelText("名称")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(categoriesApi.create).not.toHaveBeenCalled(), { timeout: 5000 });
  });

  it("toasts error when save fails", async () => {
    (categoriesApi.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("失败"));
    render(<CategoriesPage />);
    fireEvent.click(screen.getByRole("button", { name: "新建顶级分类" }));
    await waitFor(() => expect(screen.getByLabelText("名称")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "新分类" } });
    fireEvent.change(screen.getByLabelText("slug"), { target: { value: "new" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("失败"), { timeout: 5000 });
  });
});
