import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryPage from "@/app/admin/inventory/page";
import { inventoryApi } from "@/lib/api/inventory";
import { useAuthStore } from "@/stores/auth";

vi.mock("@/lib/api/inventory", () => ({ inventoryApi: { get: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ permissions: ["inventory:manage"], isAuthenticated: true });
});

describe("InventoryPage", () => {
  it("queries stock and renders three counters", async () => {
    (inventoryApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { skuId: "k1", quantity: 10, frozen: 2, available: 8 },
    });
    render(<InventoryPage />);
    fireEvent.change(screen.getByPlaceholderText("输入 SKU id"), { target: { value: "k1" } });
    fireEvent.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(inventoryApi.get).toHaveBeenCalledWith("k1"));
    expect(screen.getByText("总库存")).toBeInTheDocument();
    expect(screen.getByText("冻结")).toBeInTheDocument();
    expect(screen.getByText("可售")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("shows an error when query fails", async () => {
    (inventoryApi.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("x"));
    render(<InventoryPage />);
    fireEvent.change(screen.getByPlaceholderText("输入 SKU id"), { target: { value: "k1" } });
    fireEvent.click(screen.getByRole("button", { name: "查询" }));
    await waitFor(() => expect(screen.getByText(/查询失败/)).toBeInTheDocument());
  });

  it("ignores empty query", async () => {
    render(<InventoryPage />);
    fireEvent.click(screen.getByRole("button", { name: "查询" }));
    expect(inventoryApi.get).not.toHaveBeenCalled();
  });

  it("denies without permission", () => {
    useAuthStore.setState({ permissions: [] });
    render(<InventoryPage />);
    expect(screen.getByText(/无权限访问该功能/)).toBeInTheDocument();
  });
});
