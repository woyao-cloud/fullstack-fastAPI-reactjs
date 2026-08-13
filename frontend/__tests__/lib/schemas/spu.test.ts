import { describe, expect, it } from "vitest";
import { spuSchema, skuSchema } from "@/lib/schemas/spu";

describe("spu schema", () => {
  it("validates a valid spu", () => {
    const r = spuSchema.safeParse({
      name: "商品", categoryId: "uuid", skus: [{ specs: {}, price: 10, skuCode: "K1", isActive: true }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty name and no sku", () => {
    expect(spuSchema.safeParse({ name: "", categoryId: "x", skus: [] }).success).toBe(false);
  });

  it("rejects non-positive price", () => {
    expect(skuSchema.safeParse({ specs: {}, price: 0, skuCode: "K1", isActive: true }).success).toBe(false);
  });
});
