import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names and filters falsy", () => {
    expect(cn("a", "b", false && "c", null, undefined, "d")).toBe("a b d");
  });

  it("merges tailwind conflicts with twMerge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
