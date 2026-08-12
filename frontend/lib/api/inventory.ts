import { api } from "./client";
import type { InventoryStock } from "@/types/api";

export const inventoryApi = {
  get: (skuId: string) => api.get<InventoryStock>(`/inventory/${skuId}`),
};
