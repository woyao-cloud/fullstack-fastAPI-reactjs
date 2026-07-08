"use client";
import { useState, useEffect } from "react";
import { auditLogApi, type AuditLogOut } from "@/lib/api/audit-logs";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Props {
  mode: "admin" | "my";
}

export function AuditLogList({ mode }: Props) {
  const [logs, setLogs] = useState<AuditLogOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, unknown> = { page, size: pageSize };
        if (actionFilter) params.action = actionFilter;
        const res = mode === "admin"
          ? await auditLogApi.list(params)
          : await auditLogApi.my(params);
        if (!cancelled) { setLogs(res.items); setTotal(res.total); }
      } catch (e) {
        if (!cancelled) console.error("Failed to fetch audit logs", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, actionFilter, mode]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">全部操作</option>
          <option value="LOGIN">登录</option>
          <option value="REGISTER">注册</option>
          <option value="CREATE">创建</option>
          <option value="UPDATE">更新</option>
          <option value="DELETE">删除</option>
        </select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              {mode === "admin" && <TableHead>用户</TableHead>}
              <TableHead>操作</TableHead>
              <TableHead>资源</TableHead>
              <TableHead>结果</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={mode === "admin" ? 6 : 5} className="text-center py-8">加载中...</TableCell></TableRow>
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={mode === "admin" ? 6 : 5} className="text-center py-8">暂无日志</TableCell></TableRow>
            ) : (
              logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("zh-CN")}</TableCell>
                  {mode === "admin" && <TableCell>{l.username || l.user_id?.slice(0, 8) || "-"}</TableCell>}
                  <TableCell>{l.action}</TableCell>
                  <TableCell className="text-xs">{l.resource}{l.resource_id ? `/${l.resource_id.slice(0, 8)}` : ""}</TableCell>
                  <TableCell>{l.result}</TableCell>
                  <TableCell className="text-xs">{l.ip_address || "-"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>上一页</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>下一页</Button>
          </div>
        </div>
      )}
    </div>
  );
}