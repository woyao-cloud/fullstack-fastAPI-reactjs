import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { productsApi } from "@/lib/api/products";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

afterEach(() => { vi.clearAllMocks(); });

describe("productsApi", () => {
  it("searches with params", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });
    await productsApi.search({ q: "手机", page: 1, size: 10, status: "active" });
    expect(api.get).toHaveBeenCalledWith("/products/search", { params: { q: "手机", page: 1, size: 10, status: "active" } });
  });

  it("gets detail", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    await productsApi.detail("p1");
    expect(api.get).toHaveBeenCalledWith("/products/p1");
  });

  it("creates", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const req = { name: "x", categoryId: "c", skus: [] };
    await productsApi.create(req);
    expect(api.post).toHaveBeenCalledWith("/products", req);
  });

  it("updates", async () => {
    (api.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const req = { name: "x", categoryId: "c", skus: [] };
    await productsApi.update("p1", req);
    expect(api.put).toHaveBeenCalledWith("/products/p1", req);
  });

  it("changes status", async () => {
    (api.patch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await productsApi.changeStatus("p1", "inactive");
    expect(api.patch).toHaveBeenCalledWith("/products/p1/status", "inactive");
  });

  it("removes", async () => {
    (api.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await productsApi.remove("p1");
    expect(api.delete).toHaveBeenCalledWith("/products/p1");
  });
});
