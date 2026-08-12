import { api } from "./client";
import type { CartItem } from "@/types/api";

export const cartApi = {
  list: () => api.get<CartItem[]>("/cart"),
  add: (skuId: string, quantity: number) => api.post<void>("/cart", { skuId, quantity }),
  remove: (skuId: string) => api.delete<void>(`/cart/${skuId}`),
};
