import { z } from "zod";

export const roleCreateSchema = z.object({
  name: z.string().min(1, "请输入角色名称").max(50),
  code: z.string().min(1, "请输入角色代码").max(50),
  description: z.string().optional(),
  permission_ids: z.array(z.string().uuid()).optional(),
});

export const roleUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  permission_ids: z.array(z.string().uuid()).optional(),
  data_scope: z.enum(["ALL", "DEPT", "SELF", "CUSTOM"]).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type RoleCreateFormData = z.infer<typeof roleCreateSchema>;
export type RoleUpdateFormData = z.infer<typeof roleUpdateSchema>;