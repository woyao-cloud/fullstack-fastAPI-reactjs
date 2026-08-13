import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuantityStepper } from "@/components/storefront/quantity-stepper";

describe("QuantityStepper", () => {
  it("clamps to min/max", () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} onChange={onChange} min={1} max={3} />);
    fireEvent.click(screen.getByText("+"));
    expect(onChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByText("−"));
    fireEvent.click(screen.getByText("−"));  // 已在 min, 按钮禁用
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
