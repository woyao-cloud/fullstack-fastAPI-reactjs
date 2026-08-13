import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { inventoryApi } from "@/lib/api/inventory";
import { cartApi } from "@/lib/api/cart";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

afterEach(() => { vi.clearAllMocks(); });

describe("inventoryApi", () => {
  it("fetches stock by sku id", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await inventoryApi.get("k1");
    expect(api.get).toHaveBeenCalledWith("/inventory/k1");
  });
});

describe("cartApi", () => {
  it("lists cart", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await cartApi.list();
    expect(api.get).toHaveBeenCalledWith("/cart");
  });

  it("adds item", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await cartApi.add("s1", 2);
    expect(api.post).toHaveBeenCalledWith("/cart", { skuId: "s1", quantity: 2 });
  });

  it("removes item", async () => {
    (api.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await cartApi.remove("s1");
    expect(api.delete).toHaveBeenCalledWith("/cart/s1");
  });
});
