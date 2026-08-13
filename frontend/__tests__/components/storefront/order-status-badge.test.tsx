import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrderStatusBadge } from "@/components/storefront/order-status-badge";

describe("OrderStatusBadge", () => {
  it("renders Chinese label", () => {
    render(<OrderStatusBadge status="PENDING_PAYMENT" />);
    expect(screen.getByText("待支付")).toBeInTheDocument();
  });
});
