import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminOrdersPage from "@/app/admin/orders/page";
import { adminOrdersApi } from "@/lib/api/orders";
import { useAuthStore } from "@/stores/auth";
import type { OrderResponse } from "@/types/api";

vi.mock("@/lib/api/orders", () => ({
  adminOrdersApi: { list: vi.fn(), get: vi.fn(), ship: vi.fn(), refund: vi.fn() },
}));

const order: OrderResponse = {
  id: "o1", orderNo: "NO1", status: "PAID", totalAmount: "19.80", paidAt: null, closedAt: null, items: [],
};
const pageData = (items: OrderResponse[], total: number, p = 0, size = 10) => ({ items, total, page: p, size });

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ permissions: ["order:manage"], isAuthenticated: true });
  (adminOrdersApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([order], 1) });
});

describe("AdminOrdersPage", () => {
  it("renders order rows in a table", async () => {
    render(<AdminOrdersPage />);
    await waitFor(() => expect(screen.getByText("NO1")).toBeInTheDocument());
    expect(screen.getByText("订单号")).toBeInTheDocument();
    expect(screen.getAllByText("已支付").length).toBeGreaterThan(0);
    expect(adminOrdersApi.list).toHaveBeenCalledWith(undefined, 0, 10);
  });

  it("switches status tab", async () => {
    render(<AdminOrdersPage />);
    await waitFor(() => expect(screen.getByText("NO1")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "已发货" }));
    await waitFor(() => expect(adminOrdersApi.list).toHaveBeenCalledWith("SHIPPED", 0, 10));
  });

  it("shows empty message", async () => {
    (adminOrdersApi.list as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: pageData([], 0) });
    render(<AdminOrdersPage />);
    await waitFor(() => expect(screen.getByText("暂无订单")).toBeInTheDocument());
  });

  it("paginates next page", async () => {
    (adminOrdersApi.list as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: pageData([order], 25, 0) });
    render(<AdminOrdersPage />);
    await waitFor(() => expect(screen.getByText("第 1 / 3 页")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(adminOrdersApi.list).toHaveBeenCalledWith(undefined, 1, 10));
  });

  it("denies without permission", () => {
    useAuthStore.setState({ permissions: [] });
    render(<AdminOrdersPage />);
    expect(screen.getByText(/无权限访问该功能/)).toBeInTheDocument();
  });
});
