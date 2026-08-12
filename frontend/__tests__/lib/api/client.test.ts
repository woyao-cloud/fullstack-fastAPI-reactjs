import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { api } from "@/lib/api/client";
import { useAuthStore } from "@/stores/auth";

vi.mock("@/stores/auth", () => ({
  useAuthStore: { getState: vi.fn() },
}));

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
    const adapter = vi.fn().mockResolvedValue({ data: {}, status: 200, statusText: "OK", headers: {}, config: {} });
    const resp = await api.get("/products/search", { adapter });
    expect(adapter.mock.calls[0][0].headers.Authorization).toBe("Bearer token-1");
  });

  it("refreshes and replays on 401 once", async () => {
    let calls = 0;
    const adapter = vi.fn().mockImplementation(async (config: any) => {
      calls++;
      if (calls === 1) {
        const err: any = new Error("Unauthorized");
        err.response = { status: 401, data: {} }; err.config = config;
        throw err;
      }
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    });
    const resp = await api.get("/cart", { adapter });
    expect(resp.data).toEqual({ ok: true });
    expect(calls).toBe(2);
    expect(adapter.mock.calls[1][0].headers.Authorization).toBe("Bearer token-2");
  });
});
