import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CartLine } from "@/components/storefront/cart-line";
import type { CartItem } from "@/types/api";

const item: CartItem = { skuId: "s1", quantity: 2, checked: true, productName: "测试商品", skuSpec: "红色", price: "9.90" };

describe("CartLine", () => {
  it("renders name, spec, price and quantity", () => {
    render(<CartLine item={item} checked onToggle={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("测试商品")).toBeInTheDocument();
    expect(screen.getByText(/红色 · ¥9.90 × 2/)).toBeInTheDocument();
  });

  it("renders without skuSpec", () => {
    render(<CartLine item={{ ...item, skuSpec: "" }} checked onToggle={() => {}} onRemove={() => {}} />);
    expect(screen.getByText("测试商品")).toBeInTheDocument();
  });

  it("fires toggle and remove callbacks", () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    render(<CartLine item={item} checked={false} onToggle={onToggle} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    expect(onRemove).toHaveBeenCalled();
  });
});
