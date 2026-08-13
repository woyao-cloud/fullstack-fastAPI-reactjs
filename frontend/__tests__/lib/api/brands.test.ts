import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { brandsApi } from "@/lib/api/brands";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

afterEach(() => { vi.clearAllMocks(); });

describe("brandsApi", () => {
  it("lists with pagination", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { items: [] } });
    await brandsApi.list(1, 10);
    expect(api.get).toHaveBeenCalledWith("/brands", { params: { page: 1, size: 10 } });
  });

  it("creates", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const req = { name: "n", sortOrder: 0 };
    await brandsApi.create(req);
    expect(api.post).toHaveBeenCalledWith("/brands", req);
  });

  it("updates", async () => {
    (api.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const req = { name: "n", sortOrder: 0 };
    await brandsApi.update("b1", req);
    expect(api.put).toHaveBeenCalledWith("/brands/b1", req);
  });

  it("removes", async () => {
    (api.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await brandsApi.remove("b1");
    expect(api.delete).toHaveBeenCalledWith("/brands/b1");
  });
});
