"use client";
import { useState, useEffect, use } from "react";
import { configApi } from "@/lib/api/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const groupPrefixes: Record<string, string> = {
  mail: "mail",
  security: "security",
  performance: "performance",
  system: "system",
};

const groupNames: Record<string, string> = {
  mail: "邮件配置",
  security: "安全策略",
  performance: "性能配置",
  system: "系统参数",
};

export default function ConfigGroupPage({ params }: { params: Promise<{ group: string }> }) {
  const { group } = use(params);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const prefix = groupPrefixes[group] || group;

  useEffect(() => {
    (async () => {
      try {
        const data = await configApi.getGroup(group.toUpperCase());
        setValues(data.values);
      } catch (e) {
        console.error("Failed to fetch config group", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [group]);

  const handleSave = async (key: string) => {
    setSaving(key);
    setMessage("");
    try {
      await configApi.updateValue(`${prefix}.${key}`, { value: values[key] as string | number | boolean | Record<string, unknown> });
      setMessage("保存成功");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">加载中...</p>;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/config" className="text-sm text-muted-foreground hover:underline">&larr; 返回</Link>
        <h1 className="text-2xl font-bold">{groupNames[group] || group}</h1>
      </div>

      {message && <p className="text-sm mb-4 text-green-600">{message}</p>}

      <div className="space-y-4">
        {Object.entries(values).map(([key, value]) => (
          <Card key={key}>
            <CardHeader>
              <CardTitle className="text-sm font-mono">{prefix}.{key}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                value={String(value ?? "")}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave(key)}
                disabled={saving === key}
              >
                {saving === key ? "保存中..." : "保存"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}