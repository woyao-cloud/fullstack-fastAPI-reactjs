"use client";
import { useAuthStore } from "@/stores/auth";

export function PermissionGuard({ code, children }: { code: string; children: React.ReactNode }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(code)) {
    return <p className="p-8 text-center text-muted-foreground">无权限访问该功能（需要 {code}）</p>;
  }
  return <>{children}</>;
}
