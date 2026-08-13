import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckoutPage from "@/app/(storefront)/checkout/page";
import { cartApi } from "@/lib/api/cart";
import { ordersApi } from "@/lib/api/orders";
import { useCartStore } from "@/stores/cart";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { list: vi.fn() } }));
vi.mock("@/lib/api/orders", () => ({ ordersApi: { create: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const checkedItem = { skuId: "s1", quantity: 2, checked: true, productName: "测试商品", skuSpec: "默认规格", price: "9.90" };

beforeEach(() => {
  vi.clearAllMocks();
  useCartStore.setState({ checkedBySku: {} });
});

describe("CheckoutPage", () => {
  it("submits checked lines and navigates to order", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [checkedItem] });
    (ordersApi.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: "o1" } });
    useCartStore.setState({ checkedBySku: { s1: true } });

    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByText(/测试商品/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "提交订单" }));
    await waitFor(() => expect(ordersApi.create).toHaveBeenCalledWith({ lines: [{ skuId: "s1", quantity: 2 }] }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/orders/o1"));
    expect(toast.success).toHaveBeenCalledWith("下单成功");
  });

  it("shows empty state when nothing is checked", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ ...checkedItem, checked: false }],
    });
    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByText("没有已勾选的商品")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "提交订单" })).toBeDisabled();
  });

  it("prompts login on 401", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({ response: { status: 401 } });
    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByText("登录后查看购物车")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "去登录" }));
    expect(mocks.push).toHaveBeenCalledWith("/login?redirect=/checkout");
  });

  it("toasts an error when cart load fails with a generic error", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("网络错误"));
    render(<CheckoutPage />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("网络错误"));
  });

  it("toasts an error when order creation fails", async () => {
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [checkedItem] });
    (ordersApi.create as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("库存不足"));
    useCartStore.setState({ checkedBySku: { s1: true } });

    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "提交订单" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "提交订单" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("库存不足"));
  });
});
