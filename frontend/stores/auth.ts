import { create } from "zustand";
import { api } from "@/lib/api/client";

const REFRESH_KEY = "refresh_token";

export interface UserOut { id: string; email: string; name?: string; }
export interface TokenResponse { access_token: string; refresh_token: string; }

interface AuthState {
  accessToken: string | null;
  user: UserOut | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

async function apiCall<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const data = await apiCall<TokenResponse>("/api/v1/auth/login", { method: "POST", body: { email, password } });
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    const me = await apiCall<{ permissions: string[] } & UserOut>("/api/v1/auth/me", { method: "GET" });
    set({ accessToken: data.access_token, user: me, permissions: me.permissions, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, user: null, permissions: [], isAuthenticated: false, isLoading: false });
  },

  hydrate: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) { set({ isLoading: false }); return; }
    try {
      const t = await get().refreshAccessToken();
      if (!t) return;
      const me = await apiCall<{ permissions: string[] } & UserOut>("/api/v1/auth/me", { method: "GET" });
      set({ user: me, permissions: me.permissions, isAuthenticated: true, isLoading: false });
    } catch {
      get().logout();
      set({ isLoading: false });
    }
  },

  refreshAccessToken: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return null;
    try {
      const data = await apiCall<TokenResponse>("/api/v1/auth/refresh", { method: "POST", body: { refresh_token: rt } });
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      set({ accessToken: data.access_token, isAuthenticated: true });
      return data.access_token;
    } catch {
      get().logout();
      return null;
    }
  },

  hasPermission: (code) => {
    const perms = get().permissions;
    return perms.includes("*:*") || perms.includes(code);
  },
  hasAnyPermission: (codes) => {
    const perms = get().permissions;
    return codes.some((c) => perms.includes("*:*") || perms.includes(c));
  },
}));
