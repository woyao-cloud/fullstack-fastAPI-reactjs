import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpuForm } from "@/components/admin/spu-form";
import { productsApi } from "@/lib/api/products";
import { categoriesApi } from "@/lib/api/categories";
import { brandsApi } from "@/lib/api/brands";
import { toast } from "sonner";
import type { SpuResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, back: mocks.back }) }));
vi.mock("@/lib/api/products", () => ({
  productsApi: { search: vi.fn(), create: vi.fn(), update: vi.fn(), changeStatus: vi.fn(), remove: vi.fn() },
}));
vi.mock("@/lib/api/categories", () => ({ categoriesApi: { tree: vi.fn() } }));
vi.mock("@/lib/api/brands", () => ({ brandsApi: { list: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const initial: SpuResponse = {
  id: "p1", name: "旧商品", description: "旧描述", status: "active",
  category: { id: "c1", name: "数码", slug: "digital", parentId: null, sortOrder: 0, icon: null, isActive: true, children: [] },
  brand: { id: "b1", name: "品牌X", logoUrl: null, description: null, sortOrder: 0 },
  coverImage: null, images: [], specsTemplate: [], tags: [],
  skus: [{ id: "k1", specs: {}, price: "9.90", skuCode: "K1", barCode: null, weight: null, images: [], isActive: true, available: 0 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  (categoriesApi.tree as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: [{ id: "c1", name: "数码", slug: "digital", parentId: null, sortOrder: 0, icon: null, isActive: true, children: [] }],
  });
  (brandsApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { items: [{ id: "b1", name: "品牌X", logoUrl: null, description: null, sortOrder: 0 }], total: 1, page: 0, size: 200 },
  });
});

describe("SpuForm create", () => {
  it("shows validation errors on empty submit", async () => {
    render(<SpuForm mode="create" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "创建商品" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "创建商品" }));
    await waitFor(() => expect(screen.getByText("商品名必填")).toBeInTheDocument());
    expect(screen.getAllByText("请选择分类").length).toBeGreaterThan(1);
    expect(productsApi.create).not.toHaveBeenCalled();
  });

  it("creates a product with sku payload", async () => {
    (productsApi.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<SpuForm mode="create" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "创建商品" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("商品名 *"), { target: { value: "新商品" } });
    fireEvent.change(screen.getByLabelText("分类 *"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("价格 *"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("SKU 编码 *"), { target: { value: "K1" } });
    fireEvent.click(screen.getByRole("button", { name: "创建商品" }));
    await waitFor(() =>
      expect(productsApi.create).toHaveBeenCalledWith(expect.objectContaining({
        name: "新商品",
        categoryId: "c1",
        skus: [expect.objectContaining({ price: "10", skuCode: "K1" })],
      })));
    expect(toast.success).toHaveBeenCalledWith("创建成功");
    expect(mocks.push).toHaveBeenCalledWith("/admin/products");
  });

  it("adds spec template and csv images/tags to the payload", async () => {
    (productsApi.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<SpuForm mode="create" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "添加规格模板" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "添加规格模板" }));
    fireEvent.change(screen.getByPlaceholderText("规格名（如 颜色）"), { target: { value: "颜色" } });
    fireEvent.change(screen.getByLabelText("商品名 *"), { target: { value: "新商品" } });
    fireEvent.change(screen.getByLabelText("分类 *"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("价格 *"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("SKU 编码 *"), { target: { value: "K1" } });
    fireEvent.change(screen.getByLabelText("图片 URL（逗号分隔）"), { target: { value: "https://a.jpg, https://b.jpg" } });
    fireEvent.change(screen.getByLabelText("标签（逗号分隔）"), { target: { value: "热卖, 新品" } });
    fireEvent.click(screen.getByRole("button", { name: "创建商品" }));
    await waitFor(() =>
      expect(productsApi.create).toHaveBeenCalledWith(expect.objectContaining({
        images: ["https://a.jpg", "https://b.jpg"],
        tags: ["热卖", "新品"],
      })));
  });

  it("shows a save error when create fails", async () => {
    (productsApi.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    render(<SpuForm mode="create" />);
    await waitFor(() => expect(screen.getByRole("button", { name: "创建商品" })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("商品名 *"), { target: { value: "新商品" } });
    fireEvent.change(screen.getByLabelText("分类 *"), { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("价格 *"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("SKU 编码 *"), { target: { value: "K1" } });
    fireEvent.click(screen.getByRole("button", { name: "创建商品" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("保存失败，请检查表单"));
  });

  it("navigates back on cancel", () => {
    render(<SpuForm mode="create" />);
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(mocks.back).toHaveBeenCalled();
  });
});

describe("SpuForm edit", () => {
  it("pre-fills and updates an existing product", async () => {
    (productsApi.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<SpuForm mode="edit" id="p1" initial={initial} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存修改" })).toBeInTheDocument());
    expect((screen.getByLabelText("商品名 *") as HTMLInputElement).value).toBe("旧商品");
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    await waitFor(() =>
      expect(productsApi.update).toHaveBeenCalledWith("p1", expect.objectContaining({
        name: "旧商品",
        categoryId: "c1",
        brandId: "b1",
      })));
    expect(toast.success).toHaveBeenCalledWith("保存成功");
  });
});
