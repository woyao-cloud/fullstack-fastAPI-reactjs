import { describe, expect, it, vi, afterEach } from "vitest";
import { internalApi } from "@/lib/api/client";
import { adminOrdersApi } from "@/lib/api/orders";

vi.mock("@/lib/api/client", () => ({ internalApi: { get: vi.fn(), post: vi.fn() } }));

afterEach(() => { vi.clearAllMocks(); });

describe("adminOrdersApi", () => {
  it("lists via internal endpoint", async () => {
    (internalApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });
    await adminOrdersApi.list("PAID", 1, 20);
    expect(internalApi.get).toHaveBeenCalledWith("/orders", { params: { status: "PAID", page: 1, size: 20 } });
  });

  it("ships via internal endpoint", async () => {
    (internalApi.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await adminOrdersApi.ship("o1");
    expect(internalApi.post).toHaveBeenCalledWith("/orders/o1/ship");
  });
});
