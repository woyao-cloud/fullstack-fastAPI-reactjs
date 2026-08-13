import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth";

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: vi.fn() },
}));

function ok(config: any) {
  return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
}
function unauthorized(config: any) {
  const err: any = new Error("Unauthorized");
  err.response = { status: 401, data: {} }; err.config = config;
  throw err;
}

describe("api client", () => {
  beforeEach(() => {
    // 有状态 mock：刷新成功后 store 持有新 token（与真 store 契约一致），
    // 保证重放请求的 request 拦截器读到 token-2。
    let token = "token-1";
    (useAuthStore.getState as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      accessToken: token,
      refreshAccessToken: vi.fn().mockImplementation(async () => {
        token = "token-2";
        return "token-2";
      }),
      logout: vi.fn(),
    }));
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it("attaches bearer token", async () => {
    const adapter = vi.fn().mockResolvedValue(ok(undefined));
    const resp = await api.get("/products/search", { adapter });
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer token-1");
  });

  it("refreshes and replays on 401 once", async () => {
    let calls = 0;
    const adapter = vi.fn().mockImplementation(async (config: any) => {
      calls++;
      if (calls === 1) return unauthorized(config);
      return ok(config);
    });
    const resp = await api.get("/cart", { adapter });
    expect(resp.data).toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe("Bearer token-2");
  });

  it("queues concurrent 401s during refresh and replays both", async () => {
    let resolveRefresh!: (v: string) => void;
    let token = "t1";
    (useAuthStore.getState as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      accessToken: token,
      refreshAccessToken: vi.fn().mockImplementation(() => new Promise<string>((res) => { resolveRefresh = res; })),
      logout: vi.fn(),
    }));
    const adapter = vi.fn().mockImplementation(async (config: any) => {
      if (config.headers?.Authorization === "Bearer t1") return unauthorized(config);
      return ok(config);
    });
    const p1 = api.get("/cart", { adapter });
    const p2 = api.get("/cart", { adapter });
    await new Promise((r) => setTimeout(r, 0));
    token = "t2";
    resolveRefresh("t2");
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.data).toEqual({ ok: true });
    expect(r2.data).toEqual({ ok: true });
    expect(adapter).toHaveBeenCalledTimes(4);
  });

  it("logs out and rejects when refresh returns null", async () => {
    const logout = vi.fn();
    (useAuthStore.getState as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      accessToken: "t1",
      refreshAccessToken: vi.fn().mockResolvedValue(null),
      logout,
    }));
    const adapter = vi.fn().mockImplementation(async (config: any) => unauthorized(config));
    await expect(api.get("/cart", { adapter })).rejects.toThrow("Unauthorized");
    expect(logout).toHaveBeenCalled();
  });

  it("logs out and rejects when refresh throws", async () => {
    const logout = vi.fn();
    (useAuthStore.getState as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      accessToken: "t1",
      refreshAccessToken: vi.fn().mockRejectedValue(new Error("refresh failed")),
      logout,
    }));
    const adapter = vi.fn().mockImplementation(async (config: any) => unauthorized(config));
    await expect(api.get("/cart", { adapter })).rejects.toThrow("refresh failed");
    expect(logout).toHaveBeenCalled();
  });

  it("passes through non-401 errors", async () => {
    const adapter = vi.fn().mockImplementation(async (config: any) => {
      const err: any = new Error("Forbidden");
      err.response = { status: 403, data: {} }; err.config = config;
      throw err;
    });
    await expect(api.get("/cart", { adapter })).rejects.toThrow("Forbidden");
  });
});
