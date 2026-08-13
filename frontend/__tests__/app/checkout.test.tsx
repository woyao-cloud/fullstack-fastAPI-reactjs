import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CheckoutPage from "@/app/(storefront)/checkout/page";
import { cartApi } from "@/lib/api/cart";
import { ordersApi } from "@/lib/api/orders";
import { useCartStore } from "@/stores/cart";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/api/cart", () => ({ cartApi: { list: vi.fn() } }));
vi.mock("@/lib/api/orders", () => ({ ordersApi: { create: vi.fn() } }));

describe("CheckoutPage", () => {
  it("submits checked lines and navigates to order", async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: "o1" } });
    (ordersApi.create as unknown as ReturnType<typeof vi.fn>).mockImplementation(create);
    (cartApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ skuId: "s1", quantity: 2, checked: true, productName: "测试商品", skuSpec: "默认规格", price: "9.90" }],
    });
    useCartStore.setState({ checkedBySku: { s1: true } });

    render(<CheckoutPage />);
    await waitFor(() => expect(screen.getByText(/测试商品/)).toBeInTheDocument());
    fireEvent.click(screen.getByText("提交订单"));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({ lines: [{ skuId: "s1", quantity: 2 }] }));
  });
});
