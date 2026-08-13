import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: "a1", refresh_token: "r1" }),
  });
  useAuthStore.setState({ accessToken: null, user: null, permissions: [], isAuthenticated: false, isLoading: false });
});
afterEach(() => { vi.resetAllMocks(); });

describe("auth store", () => {
  it("hasPermission supports wildcard", () => {
    useAuthStore.setState({ permissions: ["*:*"] });
    expect(useAuthStore.getState().hasPermission("order:manage")).toBe(true);
  });

  it("hasPermission matches exact code", () => {
    useAuthStore.setState({ permissions: ["order:manage", "user:read"] });
    expect(useAuthStore.getState().hasPermission("order:manage")).toBe(true);
    expect(useAuthStore.getState().hasPermission("inventory:manage")).toBe(false);
  });

  it("login stores token and calls /auth/me with Bearer header", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "a1", refresh_token: "r1" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "u1", email: "a@b.c", permissions: ["order:manage"] }) });
    await useAuthStore.getState().login("a@b.c", "secret1");
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.permissions).toContain("order:manage");
    expect(localStorage.getItem("refresh_token")).toBe("r1");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer a1");
  });
});
