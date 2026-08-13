import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminOrderDetailPage from "@/app/admin/orders/[id]/page";
import { adminOrdersApi } from "@/lib/api/orders";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import type { OrderResponse } from "@/types/api";

const mocks = vi.hoisted(() => ({ params: { id: "o1" } }));
vi.mock("next/navigation", () => ({ useParams: () => mocks.params }));
vi.mock("@/lib/api/orders", () => ({
  adminOrdersApi: { list: vi.fn(), get: vi.fn(), ship: vi.fn(), refund: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const order = (status: OrderResponse["status"]): OrderResponse => ({
  id: "o1", orderNo: "NO1", status, totalAmount: "39.90", paidAt: null, closedAt: null,
  items: [{ skuId: "s1", productName: "商品A", skuSpec: "红色", price: "19.95", quantity: 2, subtotal: "39.90" }],
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ permissions: ["order:manage"], isAuthenticated: true });
  (adminOrdersApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: order("PAID") });
});

describe("AdminOrderDetailPage", () => {
  it("renders order detail with ship/refund for paid order", async () => {
    render(<AdminOrderDetailPage />);
    await waitFor(() => expect(screen.getByText("订单 NO1")).toBeInTheDocument());
    expect(screen.getByText("已支付")).toBeInTheDocument();
    expect(screen.getByText(/商品A/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发货" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "退款" })).toBeInTheDocument();
  });

  it("ships the order", async () => {
    (adminOrdersApi.ship as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    render(<AdminOrderDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "发货" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "发货" }));
    await waitFor(() => expect(adminOrdersApi.ship).toHaveBeenCalledWith("o1"));
    expect(toast.success).toHaveBeenCalledWith("已发货");
  });

  it("does not show ship buttons for pending payment", async () => {
    (adminOrdersApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: order("PENDING_PAYMENT") });
    render(<AdminOrderDetailPage />);
    await waitFor(() => expect(screen.getByText("订单 NO1")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "发货" })).not.toBeInTheDocument();
  });

  it("shows an error toast when shipping fails", async () => {
    (adminOrdersApi.ship as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("发货失败"));
    render(<AdminOrderDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "发货" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "发货" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("发货失败"));
  });

  it("shows 订单不存在 when load fails", async () => {
    (adminOrdersApi.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    render(<AdminOrderDetailPage />);
    await waitFor(() => expect(screen.getByText("订单不存在")).toBeInTheDocument());
  });

  it("denies without permission", () => {
    useAuthStore.setState({ permissions: [] });
    render(<AdminOrderDetailPage />);
    expect(screen.getByText(/无权限访问该功能/)).toBeInTheDocument();
  });
});
