import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";

const fetchMock = vi.fn();

const me = { id: "u1", email: "a@b.c", permissions: ["order:manage"] };
const tokens = { access_token: "a1", refresh_token: "r1" };

beforeEach(() => {
  localStorage.clear();
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockResolvedValue({ ok: true, json: async () => tokens });
  useAuthStore.setState({ accessToken: null, user: null, permissions: [], isAuthenticated: false, isLoading: true });
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

  it("hasAnyPermission matches any code", () => {
    useAuthStore.setState({ permissions: ["user:read"] });
    expect(useAuthStore.getState().hasAnyPermission(["order:manage", "user:read"])).toBe(true);
    expect(useAuthStore.getState().hasAnyPermission(["order:manage"])).toBe(false);
  });

  it("login stores token and calls /auth/me with Bearer header", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => tokens })
      .mockResolvedValueOnce({ ok: true, json: async () => me });
    await useAuthStore.getState().login("a@b.c", "secret1");
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.permissions).toContain("order:manage");
    expect(localStorage.getItem("refresh_token")).toBe("r1");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer a1");
  });

  it("login throws on failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "bad" }) });
    await expect(useAuthStore.getState().login("a@b.c", "x")).rejects.toThrow("bad");
  });

  it("logout clears state and refresh token", () => {
    localStorage.setItem("refresh_token", "r1");
    useAuthStore.setState({ accessToken: "a1", isAuthenticated: true, user: me });
    useAuthStore.getState().logout();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.user).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });

  it("hydrate is a no-op without refresh token", async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("hydrate restores session from refresh token", async () => {
    localStorage.setItem("refresh_token", "r1");
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => tokens })
      .mockResolvedValueOnce({ ok: true, json: async () => me });
    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.user?.email).toBe("a@b.c");
  });

  it("refreshAccessToken returns null when no refresh token", async () => {
    expect(await useAuthStore.getState().refreshAccessToken()).toBeNull();
  });

  it("refreshAccessToken refreshes and stores new token", async () => {
    localStorage.setItem("refresh_token", "r1");
    fetchMock.mockResolvedValue({ ok: true, json: async () => tokens });
    const t = await useAuthStore.getState().refreshAccessToken();
    expect(t).toBe("a1");
    expect(useAuthStore.getState().accessToken).toBe("a1");
    expect(localStorage.getItem("refresh_token")).toBe("r1");
  });

  it("refreshAccessToken logs out on refresh failure", async () => {
    localStorage.setItem("refresh_token", "r1");
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "bad" }) });
    expect(await useAuthStore.getState().refreshAccessToken()).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
