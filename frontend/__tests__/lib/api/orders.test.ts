import { describe, expect, it, vi, afterEach } from "vitest";
import { api, internalApi } from "@/lib/api/client";
import { ordersApi, adminOrdersApi } from "@/lib/api/orders";

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  internalApi: { get: vi.fn(), post: vi.fn() },
}));

afterEach(() => { vi.clearAllMocks(); });

describe("ordersApi", () => {
  it("creates an order", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const req = { lines: [{ skuId: "s1", quantity: 2 }] };
    await ordersApi.create(req);
    expect(api.post).toHaveBeenCalledWith("/orders", req);
  });

  it("lists with status filter and pagination", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });
    await ordersApi.list("PAID", 1, 20);
    expect(api.get).toHaveBeenCalledWith("/orders", { params: { status: "PAID", page: 1, size: 20 } });
  });

  it("lists with defaults when no args", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });
    await ordersApi.list();
    expect(api.get).toHaveBeenCalledWith("/orders", { params: { status: undefined, page: 0, size: 20 } });
  });

  it("gets an order", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await ordersApi.get("o1");
    expect(api.get).toHaveBeenCalledWith("/orders/o1");
  });

  it("pays an order", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await ordersApi.pay("o1");
    expect(api.post).toHaveBeenCalledWith("/orders/o1/pay");
  });

  it("cancels an order", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await ordersApi.cancel("o1");
    expect(api.post).toHaveBeenCalledWith("/orders/o1/cancel");
  });

  it("refunds an order", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await ordersApi.refund("o1");
    expect(api.post).toHaveBeenCalledWith("/orders/o1/refund");
  });
});

describe("adminOrdersApi", () => {
  it("lists via internal endpoint", async () => {
    (internalApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });
    await adminOrdersApi.list("PAID", 1, 20);
    expect(internalApi.get).toHaveBeenCalledWith("/orders", { params: { status: "PAID", page: 1, size: 20 } });
  });

  it("gets via internal endpoint", async () => {
    (internalApi.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await adminOrdersApi.get("o1");
    expect(internalApi.get).toHaveBeenCalledWith("/orders/o1");
  });

  it("ships via internal endpoint", async () => {
    (internalApi.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await adminOrdersApi.ship("o1");
    expect(internalApi.post).toHaveBeenCalledWith("/orders/o1/ship");
  });

  it("refunds via internal endpoint", async () => {
    (internalApi.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await adminOrdersApi.refund("o1");
    expect(internalApi.post).toHaveBeenCalledWith("/orders/o1/refund");
  });
});
