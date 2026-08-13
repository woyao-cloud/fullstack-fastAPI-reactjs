import { z } from "zod";

/**
 * 商品搜索 URL searchParams 校验（商城列表 / 管理端表单可复用）。
 * 全部字段可选；page/size 由字符串 coerce 为数字并带默认值。
 * 注意: backend `ProductQueryService.search` 未实现 sort 排序, 调用方请勿透传 sort。
 */
export const productSearchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: z.string().optional(),
  page: z.coerce.number().int().min(0).default(0),
  size: z.coerce.number().int().min(1).max(100).default(12),
});
