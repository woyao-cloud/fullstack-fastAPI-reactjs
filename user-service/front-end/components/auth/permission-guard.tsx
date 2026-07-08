"use client";
import { useAuthStore } from "@/stores/auth";

interface Props {
  code: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGuard({ code, children, fallback = null }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (hasPermission(code)) return <>{children}</>;
  return <>{fallback}</>;
}

export function usePermission(code: string): boolean {
  return useAuthStore.getState().hasPermission(code);
}

export function useAnyPermission(codes: string[]): boolean {
  return useAuthStore.getState().hasAnyPermission(codes);
}