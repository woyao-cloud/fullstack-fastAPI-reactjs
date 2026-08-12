import { api } from "./client";
import type { BrandRequest, BrandResponse, PageResponse } from "@/types/api";

export const brandsApi = {
  list: (page = 0, size = 20) => api.get<PageResponse<BrandResponse>>("/brands", { params: { page, size } }),
  create: (req: BrandRequest) => api.post<BrandResponse>("/brands", req),
  update: (id: string, req: BrandRequest) => api.put<BrandResponse>(`/brands/${id}`, req),
  remove: (id: string) => api.delete<void>(`/brands/${id}`),
};
