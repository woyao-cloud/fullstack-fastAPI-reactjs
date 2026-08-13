import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OrdersPage from "@/app/(storefront)/orders/page";
import { ordersApi } from "@/lib/api/orders";
import type { OrderResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api/orders", () => ({ ordersApi: { list: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const order: OrderResponse = {
  id: "o1", orderNo: "NO202608130001", status: "PENDING_PAYMENT", totalAmount: "19.80",
  paidAt: null, closedAt: null, items: [],
};
const page = (items: OrderResponse[], total: number, pageIdx = 0, size = 10) => ({ items, total, page: pageIdx, size });

beforeEach(() => { vi.clearAllMocks(); });

describe("OrdersPage", () => {
  it("renders the order list with status badge", async () => {
    (ordersApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: page([order], 1) });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("NO202608130001")).toBeInTheDocument());
    expect(screen.getByText(/¥19.80/)).toBeInTheDocument();
    expect(screen.getAllByText("待支付").length).toBeGreaterThan(0);
    expect(ordersApi.list).toHaveBeenCalledWith(undefined, 0, 10);
  });

  it("shows empty message when no orders", async () => {
    (ordersApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: page([], 0) });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("暂无订单")).toBeInTheDocument());
  });

  it("switches tab and reloads with status filter", async () => {
    (ordersApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: page([order], 1) });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("NO202608130001")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "已支付" }));
    await waitFor(() => expect(ordersApi.list).toHaveBeenCalledWith("PAID", 0, 10));
  });

  it("paginates to next page", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...order, id: `o${i}`, orderNo: `NO${i}` }));
    (ordersApi.list as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: page(many, 25, 0) })
      .mockResolvedValueOnce({ data: page(many, 25, 1) });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument());
    const next = screen.getByRole("button", { name: "下一页" });
    expect(next).not.toBeDisabled();
    fireEvent.click(next);
    await waitFor(() => expect(ordersApi.list).toHaveBeenCalledWith(undefined, 1, 10));
  });

  it("prompts login on 401", async () => {
    (ordersApi.list as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({ response: { status: 401 } });
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("登录后查看订单")).toBeInTheDocument());
  });

  it("shows an error message on failure", async () => {
    (ordersApi.list as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    render(<OrdersPage />);
    await waitFor(() => expect(screen.getByText("订单加载失败，请稍后重试")).toBeInTheDocument());
  });
});
