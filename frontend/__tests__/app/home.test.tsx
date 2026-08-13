import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StorefrontHome from "@/app/(storefront)/page";
import { productsApi } from "@/lib/api/products";
import { categoriesApi } from "@/lib/api/categories";
import { brandsApi } from "@/lib/api/brands";
import type { SpuResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ push: vi.fn(), searchParams: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/lib/api/products", () => ({ productsApi: { search: vi.fn() } }));
vi.mock("@/lib/api/categories", () => ({ categoriesApi: { tree: vi.fn() } }));
vi.mock("@/lib/api/brands", () => ({ brandsApi: { list: vi.fn() } }));

const spu: SpuResponse = {
  id: "s1", name: "测试商品", description: null, category: null, brand: null, status: "active",
  coverImage: null, images: [], specsTemplate: [], tags: [],
  skus: [{ id: "k1", specs: {}, price: "99.00", skuCode: "SKU1", barCode: null, weight: null, images: [], isActive: true, available: 0 }],
};
const pageData = (items: SpuResponse[], total: number, p = 0, size = 12) => ({ items, total, page: p, size });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
  (categoriesApi.tree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [{ id: "c1", name: "数码", slug: "digital", parentId: null, sortOrder: 0, icon: null, isActive: true, children: [] }],
  });
  (brandsApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { items: [{ id: "b1", name: "品牌X", logoUrl: null, description: null, sortOrder: 0 }], total: 1, page: 0, size: 100 },
  });
});

describe("StorefrontHome", () => {
  it("renders products, categories, brands and result count", async () => {
    (productsApi.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([spu], 1) });
    render(<StorefrontHome />);
    await waitFor(() => expect(screen.getByText("测试商品")).toBeInTheDocument());
    expect(screen.getByText("共 1 件")).toBeInTheDocument();
    expect(screen.getByText("数码")).toBeInTheDocument();
    expect(screen.getByText("品牌X")).toBeInTheDocument();
  });

  it("pushes filter query when a category is clicked", async () => {
    (productsApi.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([spu], 1) });
    render(<StorefrontHome />);
    await waitFor(() => expect(screen.getByText("数码")).toBeInTheDocument());
    fireEvent.click(screen.getByText("数码"));
    expect(mocks.push).toHaveBeenCalledWith("/?category=digital&page=0");
  });

  it("passes search query param to the API", async () => {
    (productsApi.search as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([spu], 1) });
    mocks.searchParams = new URLSearchParams("q=手机&page=0");
    render(<StorefrontHome />);
    await waitFor(() => expect(productsApi.search).toHaveBeenCalledWith(expect.objectContaining({ q: "手机", page: 0 })));
  });

  it("paginates when total exceeds page size", async () => {
    (productsApi.search as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: pageData([spu], 30, 0) });
    render(<StorefrontHome />);
    await waitFor(() => expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    expect(mocks.push).toHaveBeenCalledWith("/?page=1");
  });
});
