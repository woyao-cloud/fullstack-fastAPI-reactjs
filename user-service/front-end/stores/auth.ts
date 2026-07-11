import { create } from "zustand";
import type { LoginRequest, RegisterRequest, TokenResponse, UserOut } from "@/types/auth";

const REFRESH_KEY = "refresh_token";

interface AuthState {
  accessToken: string | null;
  user: UserOut | null;
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  hydrate: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

interface MeResponse extends UserOut {
  permissions: string[];
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  permissions: [],
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const data = await apiCall<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password } as LoginRequest),
    });
    localStorage.setItem(REFRESH_KEY, data.refresh_token);
    const me = await apiCall<MeResponse>("/auth/me", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    const { permissions, ...user } = me;
    set({ accessToken: data.access_token, user, permissions, isAuthenticated: true, isLoading: false });
  },

  register: async (req) => {
    await apiCall("/auth/register", { method: "POST", body: JSON.stringify(req) });
    await get().login(req.email, req.password);
  },

  logout: () => {
    localStorage.removeItem(REFRESH_KEY);
    set({ accessToken: null, user: null, permissions: [], isAuthenticated: false, isLoading: false });
  },

  hydrate: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) { set({ isLoading: false }); return; }
    try {
      const data = await apiCall<TokenResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: rt }),
      });
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      const me = await apiCall<MeResponse>("/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const { permissions, ...user } = me;
      set({ accessToken: data.access_token, user, permissions, isAuthenticated: true, isLoading: false });
    } catch {
      get().logout();
      set({ isLoading: false });
    }
  },

  refreshAccessToken: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) return null;
    try {
      const data = await apiCall<TokenResponse>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token: rt }),
      });
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      set({ accessToken: data.access_token, isAuthenticated: true });
      return data.access_token;
    } catch {
      get().logout();
      return null;
    }
  },

  hasPermission: (code: string) => {
    const perms = get().permissions;
    return perms.includes("*:*") || perms.includes(code);
  },

  hasAnyPermission: (codes: string[]) => {
    const perms = get().permissions;
    return codes.some((c) => perms.includes("*:*") || perms.includes(c));
  },
}));
