"use client";
import { useState, useEffect } from "react";
import { departmentApi } from "@/lib/api/departments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserOut } from "@/types/user";

interface Props {
  departmentId: string;
}

export function DepartmentMembers({ departmentId }: Props) {
  const [members, setMembers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await departmentApi.listUsers(departmentId);
        if (!cancelled) setMembers(data);
      } catch (e) {
        if (!cancelled) console.error("Failed to fetch members", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [departmentId]);

  return (
    <Card>
      <CardHeader><CardTitle>部门成员 ({members.length})</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无成员</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-1 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-muted">{m.status}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}