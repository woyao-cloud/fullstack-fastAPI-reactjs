export type SpuStatus = "draft" | "active" | "inactive";
export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "SHIPPED" | "COMPLETED" | "CLOSED" | "REFUNDING" | "REFUNDED";

export interface PageResponse<T> { items: T[]; total: number; page: number; size: number; }

export interface CategoryResponse { id: string; name: string; slug: string; parentId: string | null; sortOrder: number; icon: string | null; isActive: boolean; children: CategoryResponse[]; }
export interface BrandResponse { id: string; name: string; logoUrl: string | null; description: string | null; sortOrder: number; }
export interface SkuResponse { id: string; specs: Record<string, string>; price: string; skuCode: string; barCode: string | null; weight: string | null; images: string[]; isActive: boolean; available: number; }
export interface SpuResponse { id: string; name: string; description: string | null; category: CategoryResponse | null; brand: BrandResponse | null; status: SpuStatus; coverImage: string | null; images: string[]; specsTemplate: { key: string; values: string[] }[]; tags: string[]; skus: SkuResponse[]; }
export interface SpuCreateRequest { name: string; description?: string | null; categoryId: string; brandId?: string | null; coverImage?: string | null; images?: string[]; specsTemplate?: { key: string; values: string[] }[]; tags?: string[]; skus: { specs: Record<string, string>; price: string; skuCode: string; barCode?: string | null; weight?: string | null; images?: string[]; isActive: boolean }[]; }
export interface CategoryRequest { name: string; slug: string; parentId?: string | null; sortOrder: number; icon?: string | null; isActive: boolean; }
export interface BrandRequest { name: string; logoUrl?: string | null; description?: string | null; sortOrder: number; }
export interface InventoryStock { skuId: string; quantity: number; frozen: number; available: number; }
export interface CartItem { skuId: string; quantity: number; checked: boolean; productName: string; skuSpec: string; price: string; }
export interface OrderItemResponse { skuId: string; productName: string; skuSpec: string; price: string; quantity: number; subtotal: string; }
export interface OrderResponse { id: string; orderNo: string; status: OrderStatus; totalAmount: string; paidAt: string | null; closedAt: string | null; items: OrderItemResponse[]; }
export interface CreateOrderRequest { lines: { skuId: string; quantity: number }[]; }
