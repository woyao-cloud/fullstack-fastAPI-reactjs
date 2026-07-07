import api from "./client";
import type { DepartmentCreate, DepartmentListOut, DepartmentOut, DepartmentTreeNode, DepartmentUpdate } from "@/types/user";

export const departmentApi = {
  list: (page = 1, size = 20) =>
    api.get<DepartmentListOut>("/departments", { params: { page, size } }).then((r) => r.data),
  getTree: () =>
    api.get<DepartmentTreeNode[]>("/departments/tree").then((r) => r.data),
  getSubtree: (id: string) =>
    api.get<DepartmentTreeNode[]>(`/departments/${id}/subtree`).then((r) => r.data),
  get: (id: string) =>
    api.get<DepartmentOut>(`/departments/${id}`).then((r) => r.data),
  create: (data: DepartmentCreate) =>
    api.post<DepartmentOut>("/departments", data).then((r) => r.data),
  update: (id: string, data: DepartmentUpdate) =>
    api.put<DepartmentOut>(`/departments/${id}`, data).then((r) => r.data),
  move: (id: string, parentId: string | null) =>
    api.post<DepartmentOut>(`/departments/${id}/move`, { parent_id: parentId }).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/departments/${id}`),
  listUsers: (id: string) =>
    api.get(`/departments/${id}/users`).then((r) => r.data),
};
