import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrderDetailPage from "@/app/(storefront)/orders/[id]/page";
import { ordersApi } from "@/lib/api/orders";
import { toast } from "sonner";
import type { OrderResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ params: { id: "o1" } }));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params }));
vi.mock("@/lib/api/orders", () => ({ ordersApi: { get: vi.fn(), pay: vi.fn(), cancel: vi.fn(), refund: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const order = (status: OrderResponse["status"]): OrderResponse => ({
  id: "o1", orderNo: "NO1", status, totalAmount: "39.90", paidAt: null, closedAt: null,
  items: [{ skuId: "s1", productName: "商品A", skuSpec: "红色", price: "19.95", quantity: 2, subtotal: "39.90" }],
});

beforeEach(() => { vi.clearAllMocks(); });

describe("OrderDetailPage", () => {
  it("renders order, items, total and pay/cancel for pending payment", async () => {
    (ordersApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: order("PENDING_PAYMENT") });
    render(<OrderDetailPage />);
    await waitFor(() => expect(screen.getByText("订单 NO1")).toBeInTheDocument());
    expect(screen.getByText("待支付")).toBeInTheDocument();
    expect(screen.getByText(/商品A/)).toBeInTheDocument();
    expect(screen.getByText(/合计 ¥39.90/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "支付" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取消订单" })).toBeInTheDocument();
  });

  it("pays and reloads the order", async () => {
    (ordersApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: order("PENDING_PAYMENT") });
    (ordersApi.pay as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<OrderDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "支付" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "支付" }));
    await waitFor(() => expect(ordersApi.pay).toHaveBeenCalledWith("o1"));
  });

  it("shows refund button for paid order and refunds", async () => {
    (ordersApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: order("PAID") });
    (ordersApi.refund as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<OrderDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "申请退款" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "申请退款" }));
    await waitFor(() => expect(ordersApi.refund).toHaveBeenCalledWith("o1"));
  });

  it("shows an error toast when payment fails", async () => {
    (ordersApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: order("PENDING_PAYMENT") });
    (ordersApi.pay as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("支付失败"));
    render(<OrderDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "支付" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "支付" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("支付失败"));
  });

  it("shows 订单不存在 when load fails", async () => {
    (ordersApi.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    render(<OrderDetailPage />);
    await waitFor(() => expect(screen.getByText("订单不存在")).toBeInTheDocument());
  });
});
