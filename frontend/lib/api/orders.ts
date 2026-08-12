import { api, internalApi } from "./client";
import type { CreateOrderRequest, OrderResponse, OrderStatus, PageResponse } from "@/types/api";

export const ordersApi = {
  create: (req: CreateOrderRequest) => api.post<OrderResponse>("/orders", req),
  list: (status?: OrderStatus, page = 0, size = 20) =>
    api.get<PageResponse<OrderResponse>>("/orders", { params: { status, page, size } }),
  get: (id: string) => api.get<OrderResponse>(`/orders/${id}`),
  pay: (id: string) => api.post<void>(`/orders/${id}/pay`),
  cancel: (id: string) => api.post<void>(`/orders/${id}/cancel`),
  refund: (id: string) => api.post<void>(`/orders/${id}/refund`),
};

export const adminOrdersApi = {
  list: (status?: OrderStatus, page = 0, size = 20) =>
    internalApi.get<PageResponse<OrderResponse>>("/orders", { params: { status, page, size } }),
  get: (id: string) => internalApi.get<OrderResponse>(`/orders/${id}`),
  ship: (id: string) => internalApi.post<void>(`/orders/${id}/ship`),
  refund: (id: string) => internalApi.post<void>(`/orders/${id}/refund`),
};
