"use client";
import { useState, useEffect } from "react";
import { configApi } from "@/lib/api/config";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";

const groupLabels: Record<string, string> = {
  MAIL: "邮件配置",
  SECURITY: "安全策略",
  PERFORMANCE: "性能配置",
  SYSTEM: "系统参数",
};

const groupDescriptions: Record<string, string> = {
  MAIL: "SMTP 邮件服务器配置",
  SECURITY: "密码策略、登录限制与会话管理",
  PERFORMANCE: "缓存 TTL、连接池、API 阈值",
  SYSTEM: "站点名称、语言、联系邮箱",
};

export default function ConfigPage() {
  const [groups, setGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const data = await configApi.listGroups();
        setGroups(data);
      } catch (e) {
        console.error("Failed to fetch config groups", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">系统配置</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {groups.map((group) => (
          <Card
            key={group}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push(`/config/${group.toLowerCase()}`)}
          >
            <CardHeader>
              <CardTitle>{groupLabels[group] || group}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{groupDescriptions[group] || ""}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}