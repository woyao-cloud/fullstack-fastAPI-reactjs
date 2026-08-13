import { describe, expect, it } from "vitest";
import { categorySchema, brandSchema } from "@/lib/schemas/admin";

describe("categorySchema", () => {
  it("validates a valid category", () => {
    expect(categorySchema.safeParse({ name: "数码", slug: "digital", sortOrder: "2" }).success).toBe(true);
  });

  it("rejects empty name and slug", () => {
    expect(categorySchema.safeParse({ name: "", slug: "s" }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "n", slug: "" }).success).toBe(false);
  });
});

describe("brandSchema", () => {
  it("validates a valid brand", () => {
    expect(brandSchema.safeParse({ name: "品牌X", sortOrder: "1" }).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(brandSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
