import { api } from "./client";
import type { PageResponse, SpuCreateRequest, SpuResponse, SpuStatus } from "@/types/api";

export interface ProductSearchParams { q?: string; category?: string; brand?: string; minPrice?: string; maxPrice?: string; sort?: string; page?: number; size?: number; }

export const productsApi = {
  search: (params: ProductSearchParams) =>
    api.get<PageResponse<SpuResponse>>("/products/search", { params }),
  detail: (id: string) => api.get<SpuResponse>(`/products/${id}`),
  create: (req: SpuCreateRequest) => api.post<SpuResponse>("/products", req),
  update: (id: string, req: SpuCreateRequest) => api.put<SpuResponse>(`/products/${id}`, req),
  changeStatus: (id: string, status: SpuStatus) => api.patch<void>(`/products/${id}/status`, status),
  remove: (id: string) => api.delete<void>(`/products/${id}`),
};
