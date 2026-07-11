import api from "./client";
import type { UserCreate, UserListOut, UserOut, UserUpdate } from "@/types/user";

export const userApi = {
  list: (page = 1, size = 20, search?: string) =>
    api.get<UserListOut>("/users", { params: { page, size, ...(search ? { search } : {}) } }).then((r) => r.data),
  get: (id: string) =>
    api.get<UserOut>(`/users/${id}`).then((r) => r.data),
  create: (data: UserCreate) =>
    api.post<UserOut>("/users", data).then((r) => r.data),
  update: (id: string, data: UserUpdate) =>
    api.put<UserOut>(`/users/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/users/${id}`),
  assignRole: (userId: string, roleId: string) =>
    api.post<UserOut>(`/users/${userId}/roles/${roleId}`).then((r) => r.data),
};
