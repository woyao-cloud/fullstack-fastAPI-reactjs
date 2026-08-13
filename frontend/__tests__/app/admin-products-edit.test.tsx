import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EditProductPage from "@/app/admin/products/[id]/page";
import NewProductPage from "@/app/admin/products/new/page";
import { productsApi } from "@/lib/api/products";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import type { SpuResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ params: { id: "p1" } }));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params }));
vi.mock("@/lib/api/products", () => ({
  productsApi: { detail: vi.fn(), changeStatus: vi.fn() },
}));
vi.mock("@/components/admin/spu-form", () => ({
  SpuForm: ({ initial, mode }: { initial?: SpuResponse; mode: string }) => (
    <div data-testid="spu-form">{mode}:{initial?.name ?? "none"}</div>
  ),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const spu: SpuResponse = {
  id: "p1", name: "测试商品", description: null, category: null, brand: null, status: "active",
  coverImage: null, images: [], specsTemplate: [], tags: [], skus: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ permissions: ["product:manage"], isAuthenticated: true });
  (productsApi.detail as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: spu });
});

describe("EditProductPage", () => {
  it("loads the product and renders the edit form", async () => {
    render(<EditProductPage />);
    await waitFor(() => expect(screen.getByText("编辑商品")).toBeInTheDocument());
    expect(screen.getByText("在售")).toBeInTheDocument();
    expect(screen.getByTestId("spu-form").textContent).toBe("edit:测试商品");
  });

  it("toggles status via API", async () => {
    (productsApi.changeStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<EditProductPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "下架" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下架" }));
    await waitFor(() => expect(productsApi.changeStatus).toHaveBeenCalledWith("p1", "inactive"));
    expect(toast.success).toHaveBeenCalledWith("已下架");
  });

  it("shows an error toast when status toggle fails", async () => {
    (productsApi.changeStatus as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    render(<EditProductPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "下架" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下架" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("操作失败"));
  });

  it("shows 商品不存在 when detail fails", async () => {
    (productsApi.detail as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    render(<EditProductPage />);
    await waitFor(() => expect(screen.getByText("商品不存在")).toBeInTheDocument());
    expect(toast.error).toHaveBeenCalledWith("加载商品失败");
  });

  it("denies without permission", () => {
    useAuthStore.setState({ permissions: [] });
    render(<EditProductPage />);
    expect(screen.getByText(/无权限访问该功能/)).toBeInTheDocument();
  });
});

describe("NewProductPage", () => {
  it("renders the create form", () => {
    useAuthStore.setState({ permissions: ["product:manage"] });
    render(<NewProductPage />);
    expect(screen.getByText("新建商品")).toBeInTheDocument();
    expect(screen.getByTestId("spu-form").textContent).toBe("create:none");
  });
});
