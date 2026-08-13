import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrderTable } from "@/components/admin/order-table";
import type { OrderResponse } from "@/types/api";

const order: OrderResponse = {
  id: "o1", orderNo: "NO1", status: "PAID", totalAmount: "19.80", paidAt: null, closedAt: null, items: [],
};

describe("OrderTable", () => {
  it("renders rows and fires onRowClick", () => {
    const onRowClick = vi.fn();
    render(<OrderTable rows={[order]} onRowClick={onRowClick} />);
    expect(screen.getByText("NO1")).toBeInTheDocument();
    expect(screen.getByText("已支付")).toBeInTheDocument();
    fireEvent.click(screen.getByText("NO1"));
    expect(onRowClick).toHaveBeenCalledWith(order);
  });
});
