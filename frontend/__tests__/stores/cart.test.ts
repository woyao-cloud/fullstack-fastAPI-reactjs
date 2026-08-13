import { describe, expect, it } from "vitest";
import { useCartStore } from "@/stores/cart";

describe("cart store", () => {
  it("toggles checked state by sku", () => {
    useCartStore.setState({ checkedBySku: {} });
    useCartStore.getState().toggle("sku1");
    expect(useCartStore.getState().checkedBySku.sku1).toBe(true);
    useCartStore.getState().toggle("sku1");
    expect(useCartStore.getState().checkedBySku.sku1).toBe(false);
  });

  it("toggleAll sets all", () => {
    useCartStore.setState({ checkedBySku: {} });
    useCartStore.getState().toggleAll(["a", "b"], true);
    expect(useCartStore.getState().checkedBySku).toEqual({ a: true, b: true });
  });
});
