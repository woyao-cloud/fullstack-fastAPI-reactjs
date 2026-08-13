import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import BrandsPage from "@/app/admin/brands/page";
import { brandsApi } from "@/lib/api/brands";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import type { BrandResponse } from "@/types/api";

vi.mock("@/lib/api/brands", () => ({
  brandsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const brand: BrandResponse = { id: "b1", name: "品牌X", logoUrl: null, description: "描述", sortOrder: 1 };
const pageData = (items: BrandResponse[], total: number, p = 0, size = 10) => ({ items, total, page: p, size });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ permissions: ["product:manage"], isAuthenticated: true });
  (brandsApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([brand], 1) });
  window.confirm = vi.fn(() => true);
});

describe("BrandsPage", () => {
  it("renders brand rows", async () => {
    render(<BrandsPage />);
    await waitFor(() => expect(screen.getByText("品牌X")).toBeInTheDocument());
    expect(screen.getAllByText("描述").length).toBeGreaterThan(0);
  });

  it("creates a brand", async () => {
    (brandsApi.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<BrandsPage />);
    fireEvent.click(screen.getByRole("button", { name: "新建品牌" }));
    await waitFor(() => expect(screen.getByLabelText("名称")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "新品牌" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(brandsApi.create).toHaveBeenCalledWith(expect.objectContaining({ name: "新品牌" })));
    expect(toast.success).toHaveBeenCalledWith("已保存");
  });

  it("edits a brand and calls update", async () => {
    (brandsApi.update as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    render(<BrandsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "编辑" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "编辑" }));
    await waitFor(() => expect(screen.getByText("编辑品牌")).toBeInTheDocument());
    expect((screen.getByLabelText("名称") as HTMLInputElement).value).toBe("品牌X");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(brandsApi.update).toHaveBeenCalledWith("b1", expect.objectContaining({ name: "品牌X" })));
  });

  it("removes a brand after confirm", async () => {
    (brandsApi.remove as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<BrandsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => expect(brandsApi.remove).toHaveBeenCalledWith("b1"));
  });

  it("paginates next page", async () => {
    (brandsApi.list as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: pageData([brand], 25, 0) });
    render(<BrandsPage />);
    await waitFor(() => expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(brandsApi.list).toHaveBeenCalledWith(1, 10));
  });

  it("paginates to previous page", async () => {
    (brandsApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([brand], 25, 0) });
    render(<BrandsPage />);
    await waitFor(() => expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(brandsApi.list).toHaveBeenCalledWith(1, 10));
    const prev = screen.getByRole("button", { name: "上一页" });
    expect(prev).not.toBeDisabled();
    fireEvent.click(prev);
    await waitFor(() => expect(brandsApi.list).toHaveBeenCalledWith(0, 10));
  });
});
