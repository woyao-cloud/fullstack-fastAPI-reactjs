import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";

describe("OrderStatusBadge", () => {
  it.each([
    ["PENDING_PAYMENT", "待支付"],
    ["PAID", "已支付"],
    ["SHIPPED", "已发货"],
    ["COMPLETED", "已完成"],
    ["CLOSED", "已关闭"],
    ["REFUNDING", "退款中"],
    ["REFUNDED", "已退款"],
  ] as const)("renders %s as %s", (status, label) => {
    render(<OrderStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
