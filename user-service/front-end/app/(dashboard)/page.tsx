"use client";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader><CardTitle>欢迎, {user?.first_name}!</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-4">你已成功登录。</p>
          <Button onClick={() => { logout(); router.push("/login"); }}>登出</Button>
        </CardContent>
      </Card>
    </div>
  );
}
