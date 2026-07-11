import api from "./client";

export interface AuditLogOut {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  detail: string | null;
  ip_address: string | null;
  result: string;
  created_at: string;
}

export interface AuditLogListOut {
  items: AuditLogOut[];
  total: number;
  page: number;
  size: number;
}

export const auditLogApi = {
  list: (params: { page?: number; size?: number; user_id?: string; action?: string; resource?: string; date_from?: string; date_to?: string }) =>
    api.get<AuditLogListOut>("/audit-logs", { params }).then((r) => r.data),
  my: (params: { page?: number; size?: number; action?: string; date_from?: string; date_to?: string }) =>
    api.get<AuditLogListOut>("/audit-logs/my", { params }).then((r) => r.data),
};
