"use client";
import { AuditLogList } from "@/components/audit-logs/audit-log-list";

export default function MyHistoryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">我的操作历史</h1>
      <AuditLogList mode="my" />
    </div>
  );
}