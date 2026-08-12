import { api } from "./client";
import type { CategoryRequest, CategoryResponse } from "@/types/api";

export const categoriesApi = {
  tree: () => api.get<CategoryResponse[]>("/categories/tree"),
  create: (req: CategoryRequest) => api.post<CategoryResponse>("/categories", req),
  update: (id: string, req: CategoryRequest) => api.put<CategoryResponse>(`/categories/${id}`, req),
  remove: (id: string) => api.delete<void>(`/categories/${id}`),
};
