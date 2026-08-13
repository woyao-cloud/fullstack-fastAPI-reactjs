import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProductDetailPage from "@/app/(storefront)/products/[id]/page";
import { productsApi } from "@/lib/api/products";
import { inventoryApi } from "@/lib/api/inventory";
import { cartApi } from "@/lib/api/cart";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import type { SpuResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ push: vi.fn(), params: { id: "s1" } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), useParams: () => mocks.params }));
vi.mock("@/lib/api/products", () => ({ productsApi: { detail: vi.fn() } }));
vi.mock("@/lib/api/inventory", () => ({ inventoryApi: { get: vi.fn() } }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { add: vi.fn(), list: vi.fn(), remove: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const spu: SpuResponse = {
  id: "s1", name: "测试商品", description: "很不错的商品", category: null, brand: null, status: "active",
  coverImage: null, images: ["https://a.jpg"], specsTemplate: [],
  tags: [],
  skus: [
    { id: "k1", specs: { 颜色: "红" }, price: "99.00", skuCode: "SKU1", barCode: null, weight: null, images: [], isActive: true, available: 0 },
    { id: "k2", specs: { 颜色: "蓝" }, price: "109.00", skuCode: "SKU2", barCode: null, weight: null, images: [], isActive: true, available: 0 },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ isAuthenticated: false, user: null, permissions: [], accessToken: null });
  (productsApi.detail as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: spu });
  (inventoryApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { skuId: "k1", quantity: 5, frozen: 0, available: 5 } });
});

describe("ProductDetailPage", () => {
  it("renders product and loads real inventory", async () => {
    render(<ProductDetailPage />);
    await waitFor(() => expect(screen.getByText("测试商品")).toBeInTheDocument());
    expect(screen.getByText(/很不错的商品/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/可售 5 件/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "加入购物车" })).toBeInTheDocument();
    expect(inventoryApi.get).toHaveBeenCalledWith("k1");
  });

  it("selecting another sku reloads inventory", async () => {
    render(<ProductDetailPage />);
    await waitFor(() => expect(screen.getByText("测试商品")).toBeInTheDocument());
    (inventoryApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { skuId: "k2", quantity: 3, frozen: 0, available: 3 } });
    fireEvent.click(screen.getByRole("button", { name: "蓝" }));
    await waitFor(() => expect(inventoryApi.get).toHaveBeenCalledWith("k2"));
    await waitFor(() => expect(screen.getByText(/可售 3 件/)).toBeInTheDocument());
  });

  it("redirects to login when adding to cart unauthenticated", async () => {
    render(<ProductDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "加入购物车" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "加入购物车" }));
    expect(mocks.push).toHaveBeenCalledWith("/login?redirect=%2Fproducts%2Fs1");
  });

  it("adds to cart when authenticated", async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: "u1", email: "a@b.c" } });
    (cartApi.add as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<ProductDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "加入购物车" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "加入购物车" }));
    await waitFor(() => expect(cartApi.add).toHaveBeenCalledWith("k1", 1));
  });

  it("shows an error toast when add to cart fails", async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: "u1", email: "a@b.c" } });
    (cartApi.add as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("加购失败"));
    render(<ProductDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "加入购物车" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "加入购物车" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("加购失败"));
  });

  it("shows out-of-stock state when inventory is zero", async () => {
    (inventoryApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { skuId: "k1", quantity: 0, frozen: 0, available: 0 } });
    render(<ProductDetailPage />);
    await waitFor(() => expect(screen.getByText("暂时缺货")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "加入购物车" })).not.toBeInTheDocument();
  });

  it("shows 商品不存在 when detail fails", async () => {
    (productsApi.detail as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    render(<ProductDetailPage />);
    await waitFor(() => expect(screen.getByText("商品不存在")).toBeInTheDocument());
  });
});
