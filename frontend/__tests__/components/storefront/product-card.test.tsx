import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductCard } from "@/components/storefront/product-card";
import type { SpuResponse } from "@/types/api";

const spu: SpuResponse = {
  id: "s1", name: "测试商品", description: "描述", category: null, brand: null,
  status: "active", coverImage: null, images: [], specsTemplate: [], tags: [],
  skus: [{ id: "k1", specs: {}, price: "99.00", skuCode: "SKU1", barCode: null, weight: null, images: [], isActive: true, available: 0 }],
};

describe("ProductCard", () => {
  it("renders name, price and active badge", () => {
    render(<ProductCard product={spu} />);
    expect(screen.getByText("测试商品")).toBeInTheDocument();
    expect(screen.getByText(/¥99.00/)).toBeInTheDocument();
    expect(screen.getByText("在售")).toBeInTheDocument();
  });

  it("shows inactive badge for draft", () => {
    render(<ProductCard product={{ ...spu, status: "draft" }} />);
    expect(screen.getByText("下架")).toBeInTheDocument();
  });
});
