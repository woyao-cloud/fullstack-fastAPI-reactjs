"use client";
import { AuditLogList } from "@/components/audit-logs/audit-log-list";

export default function AuditLogsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">审计日志</h1>
      <AuditLogList mode="admin" />
    </div>
  );
}