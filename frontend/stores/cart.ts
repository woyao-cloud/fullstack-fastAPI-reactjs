import { create } from "zustand";

interface CartUiState {
  checkedBySku: Record<string, boolean>;
  setInitial: (skuIds: string[], initialChecked: boolean[]) => void;
  toggle: (skuId: string) => void;
  toggleAll: (skuIds: string[], checked: boolean) => void;
}

export const useCartStore = create<CartUiState>((set) => ({
  checkedBySku: {},
  setInitial: (skuIds, initialChecked) =>
    set((s) => {
      const next = { ...s.checkedBySku };
      skuIds.forEach((id, i) => { next[id] = initialChecked[i]; });
      return { checkedBySku: next };
    }),
  toggle: (skuId) => set((s) => ({ checkedBySku: { ...s.checkedBySku, [skuId]: !s.checkedBySku[skuId] } })),
  toggleAll: (skuIds, checked) => {
    const next: Record<string, boolean> = {};
    skuIds.forEach((id) => { next[id] = checked; });
    set((s) => ({ checkedBySku: { ...s.checkedBySku, ...next } }));
  },
}));
