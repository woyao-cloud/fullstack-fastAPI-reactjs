import api from "./client";
import type { PermissionOut, RoleCreate, RoleOut, RoleUpdate } from "@/types/user";

export const roleApi = {
  list: () =>
    api.get<RoleOut[]>("/roles").then((r) => r.data),
  get: (id: string) =>
    api.get<RoleOut>(`/roles/${id}`).then((r) => r.data),
  create: (data: RoleCreate) =>
    api.post<RoleOut>("/roles", data).then((r) => r.data),
  update: (id: string, data: RoleUpdate) =>
    api.put<RoleOut>(`/roles/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/roles/${id}`),
  listPermissions: () =>
    api.get<PermissionOut[]>("/permissions").then((r) => r.data),
};
