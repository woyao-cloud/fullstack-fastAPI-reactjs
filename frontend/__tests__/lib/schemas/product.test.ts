import { describe, expect, it } from "vitest";
import { productSearchSchema } from "@/lib/schemas/product";

describe("productSearchSchema", () => {
  it("applies default page and size", () => {
    const r = productSearchSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(0);
      expect(r.data.size).toBe(12);
    }
  });

  it("coerces string page/size", () => {
    const r = productSearchSchema.safeParse({ page: "3", size: "20" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(3);
      expect(r.data.size).toBe(20);
    }
  });

  it("rejects negative page and oversized size", () => {
    expect(productSearchSchema.safeParse({ page: "-1" }).success).toBe(false);
    expect(productSearchSchema.safeParse({ size: "101" }).success).toBe(false);
  });
});
