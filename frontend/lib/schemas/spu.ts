import { z } from "zod";

export const skuSchema = z.object({
  specs: z.record(z.string(), z.string()),
  price: z.coerce.number().positive("价格必须大于 0"),
  skuCode: z.string().min(1, "SKU 编码必填"),
  barCode: z.string().optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  images: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export const spuSchema = z.object({
  name: z.string().min(1, "商品名必填").max(200, "商品名最多 200 字"),
  description: z.string().optional().nullable(),
  categoryId: z.string().min(1, "请选择分类"),
  brandId: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  images: z.array(z.string()).default([]),
  specsTemplate: z.array(z.object({ key: z.string().min(1), values: z.array(z.string()) })).default([]),
  tags: z.array(z.string()).default([]),
  skus: z.array(skuSchema).min(1, "至少一个 SKU"),
});

export type SpuFormValues = z.infer<typeof spuSchema>;
