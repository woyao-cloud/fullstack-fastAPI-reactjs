import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@/stores/auth";

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null, isAuthenticated: false, isLoading: true });
  localStorage.clear();
});

describe("AuthStore", () => {
  it("initial state is not authenticated", () => {
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it("logout clears state and localStorage", () => {
    useAuthStore.setState({ accessToken: "t", user: { id: "1", email: "a@b.com", first_name: "A", last_name: "B", status: "ACTIVE", email_verified: true, created_at: "2026-01-01T00:00:00Z" }, isAuthenticated: true });
    localStorage.setItem("refresh_token", "rt");
    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(localStorage.getItem("refresh_token")).toBeNull();
  });
});
