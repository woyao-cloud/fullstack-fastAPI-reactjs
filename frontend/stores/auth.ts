import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  refreshAccessToken: () => Promise<string | null>;
  logout: () => void;
}

/**
 * 占位实现（Task 6）——只保证 client.ts 编译与模块可导入。
 * Task 7 将替换为真实 auth store（内部用 fetch，不依赖本 client，避免循环依赖）。
 */
export const useAuthStore = create<AuthState>(() => ({
  accessToken: null,
  refreshAccessToken: async () => null,
  logout: () => {},
}));
