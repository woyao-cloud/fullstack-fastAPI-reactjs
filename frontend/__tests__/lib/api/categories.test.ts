import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { categoriesApi } from "@/lib/api/categories";

vi.mock("@/lib/api/client", () => ({ api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

afterEach(() => { vi.clearAllMocks(); });

describe("categoriesApi", () => {
  it("fetches tree", async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    await categoriesApi.tree();
    expect(api.get).toHaveBeenCalledWith("/categories/tree");
  });

  it("creates", async () => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const req = { name: "n", slug: "s", sortOrder: 0, isActive: true };
    await categoriesApi.create(req);
    expect(api.post).toHaveBeenCalledWith("/categories", req);
  });

  it("updates", async () => {
    (api.put as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
    const req = { name: "n", slug: "s", sortOrder: 0, isActive: true };
    await categoriesApi.update("c1", req);
    expect(api.put).toHaveBeenCalledWith("/categories/c1", req);
  });

  it("removes", async () => {
    (api.delete as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});
    await categoriesApi.remove("c1");
    expect(api.delete).toHaveBeenCalledWith("/categories/c1");
  });
});
