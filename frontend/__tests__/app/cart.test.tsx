import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CartPage from "@/app/(storefront)/cart/page";
import { cartApi } from "@/lib/api/cart";
import { useCartStore } from "@/stores/cart";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { list: vi.fn(), add: vi.fn(), remove: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const checkedItem = {
  skuId: "s1", quantity: 2, checked: true, productName: "测试商品", skuSpec: "红色", price: "9.90",
};

beforeEach(() => {
  vi.clearAllMocks();
  useCartStore.setState({ checkedBySku: {} });
  (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [checkedItem] });
});
afterEach(() => { vi.clearAllMocks(); });

describe("CartPage", () => {
  it("renders items, computed total and navigates on checkout", async () => {
    render(<CartPage />);
    await waitFor(() => expect(screen.getByText("测试商品")).toBeInTheDocument());
    expect(screen.getByText(/红色/)).toBeInTheDocument();
    expect(screen.getByText(/¥19.80/)).toBeInTheDocument();
    expect(screen.getByText(/已选 1 件/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "去结算" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/checkout"));
  });

  it("shows empty state when no items", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    render(<CartPage />);
    await waitFor(() => expect(screen.getByText("购物车是空的")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "去结算" })).toBeDisabled();
  });

  it("prompts login on 401", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({ response: { status: 401 } });
    render(<CartPage />);
    await waitFor(() => expect(screen.getByText("登录后查看购物车")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "去登录" }));
    expect(mocks.push).toHaveBeenCalledWith("/login?redirect=/cart");
  });

  it("removes an item via API", async () => {
    (cartApi.remove as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<CartPage />);
    await waitFor(() => expect(screen.getByText("测试商品")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    await waitFor(() => expect(cartApi.remove).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(screen.getByText("购物车是空的")).toBeInTheDocument());
  });

  it("toasts an error on generic load failure", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("网络错误"));
    render(<CartPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("网络错误"));
  });

  it("toggles line checkbox and blocks checkout until an item is checked", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ ...checkedItem, checked: false }],
    });
    render(<CartPage />);
    await waitFor(() => expect(screen.getByText("测试商品")).toBeInTheDocument());
    const checkout = screen.getByRole("button", { name: "去结算" });
    expect(checkout).toBeDisabled();
    // 全选 checkbox + 行内 checkbox
    const boxes = screen.getAllByRole("checkbox");
    fireEvent.click(boxes[1]);
    await waitFor(() => expect(checkout).not.toBeDisabled());
    expect(useCartStore.getState().checkedBySku.s1).toBe(true);
  });
});
