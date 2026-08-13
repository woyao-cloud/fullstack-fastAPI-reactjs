import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminProductsPage from "@/app/admin/products/page";
import { productsApi } from "@/lib/api/products";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import type { SpuResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ push: vi.fn(), searchParams: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/lib/api/products", () => ({
  productsApi: { search: vi.fn(), detail: vi.fn(), changeStatus: vi.fn(), remove: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const spu: SpuResponse = {
  id: "s1", name: "测试商品", description: null, category: { id: "c1", name: "数码", slug: "digital", parentId: null, sortOrder: 0, icon: null, isActive: true, children: [] }, brand: null,
  status: "active", coverImage: null, images: [], specsTemplate: [], tags: [],
  skus: [],
};
const pageData = (items: SpuResponse[], total: number, p = 0, size = 10) => ({ items, total, page: p, size });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
  useAuthStore.setState({ permissions: ["product:manage"], isAuthenticated: true });
  (productsApi.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([spu], 1) });
  window.confirm = vi.fn(() => true);
});

describe("AdminProductsPage", () => {
  it("denies access without permission", async () => {
    useAuthStore.setState({ permissions: [] });
    render(<AdminProductsPage />);
    expect(screen.getByText(/无权限访问该功能/)).toBeInTheDocument();
  });

  it("renders product rows with status label", async () => {
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByText("测试商品")).toBeInTheDocument());
    expect(screen.getAllByText("在售").length).toBeGreaterThan(0);
    expect(screen.getByText("数码")).toBeInTheDocument();
  });

  it("toggles product status", async () => {
    (productsApi.changeStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "下架" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下架" }));
    await waitFor(() => expect(productsApi.changeStatus).toHaveBeenCalledWith("s1", "inactive"));
    expect(toast.success).toHaveBeenCalledWith("已下架");
    await waitFor(() => expect(screen.getByRole("button", { name: "上架" })).toBeInTheDocument());
  });

  it("removes a product after confirm", async () => {
    (productsApi.remove as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => expect(productsApi.remove).toHaveBeenCalledWith("s1"));
    expect(toast.success).toHaveBeenCalledWith("已删除");
    expect(mocks.push).toHaveBeenCalledWith("/admin/products?page=0");
  });

  it("skips remove when confirm is cancelled", async () => {
    window.confirm = vi.fn(() => false);
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(productsApi.remove).not.toHaveBeenCalled();
  });

  it("shows empty message when no products", async () => {
    (productsApi.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([], 0) });
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByText("暂无商品")).toBeInTheDocument());
  });

  it("searches on Enter", async () => {
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByPlaceholderText("搜索商品名")).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText("搜索商品名"), { target: { value: "手机" } });
    fireEvent.keyDown(screen.getByPlaceholderText("搜索商品名"), { key: "Enter" });
    expect(mocks.push).toHaveBeenCalledWith("/admin/products?q=%E6%89%8B%E6%9C%BA&page=0");
  });

  it("filters by status select", async () => {
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByDisplayValue("全部")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("全部"), { target: { value: "draft" } });
    expect(mocks.push).toHaveBeenCalledWith("/admin/products?status=draft&page=0");
  });

  it("reads status filter from search params", async () => {
    mocks.searchParams = new URLSearchParams("status=draft");
    render(<AdminProductsPage />);
    await waitFor(() => expect(productsApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ status: "draft" })));
  });

  it("paginates next page", async () => {
    (productsApi.search as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: pageData([spu], 25, 0) });
    render(<AdminProductsPage />);
    await waitFor(() => expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(mocks.push).toHaveBeenCalledWith("/admin/products?page=1");
  });
});
