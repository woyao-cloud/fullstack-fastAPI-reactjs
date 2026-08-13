import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1).max(100, "分类名最多 100 字"),
  slug: z.string().min(1).max(100),
  parentId: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  icon: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});
export type CategoryFormValues = z.infer<typeof categorySchema>;

export const brandSchema = z.object({
  name: z.string().min(1).max(100, "品牌名最多 100 字"),
  logoUrl: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
});
export type BrandFormValues = z.infer<typeof brandSchema>;
