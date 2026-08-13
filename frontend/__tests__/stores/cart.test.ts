import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "@/stores/cart";

beforeEach(() => { useCartStore.setState({ checkedBySku: {} }); });

describe("cart store", () => {
  it("toggles checked state by sku", () => {
    useCartStore.getState().toggle("sku1");
    expect(useCartStore.getState().checkedBySku.sku1).toBe(true);
    useCartStore.getState().toggle("sku1");
    expect(useCartStore.getState().checkedBySku.sku1).toBe(false);
  });

  it("toggleAll sets all", () => {
    useCartStore.getState().toggleAll(["a", "b"], true);
    expect(useCartStore.getState().checkedBySku).toEqual({ a: true, b: true });
  });

  it("setInitial writes initial checked states", () => {
    useCartStore.setState({ checkedBySku: { stale: true } });
    useCartStore.getState().setInitial(["a", "b", "c"], [true, false, true]);
    expect(useCartStore.getState().checkedBySku).toEqual({ stale: true, a: true, b: false, c: true });
  });

  it("toggleAll false overrides prior checks", () => {
    useCartStore.setState({ checkedBySku: { a: true, b: true } });
    useCartStore.getState().toggleAll(["a", "b"], false);
    expect(useCartStore.getState().checkedBySku).toEqual({ a: false, b: false });
  });
});
