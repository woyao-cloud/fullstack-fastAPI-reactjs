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
    <div>
      <h1 className="text-2xl font-bold mb-6">仪表板</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader><CardTitle>欢迎</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg">{user?.first_name} {user?.last_name}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>状态</CardTitle></CardHeader>
          <CardContent>
            <p>你已成功登录系统。</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>操作</CardTitle></CardHeader>
          <CardContent>
            <Button onClick={() => { logout(); router.push("/login"); }}>登出</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
