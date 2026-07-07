import { z } from "zod";

export const departmentCreateSchema = z.object({
  name: z.string().min(1, "请输入部门名称").max(100),
  code: z.string().min(1, "请输入部门代码").max(50),
  parent_id: z.string().uuid().optional().nullable(),
  sort_order: z.number().int().optional(),
  manager_id: z.string().uuid().optional().nullable(),
});

export const departmentUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(50).optional(),
  sort_order: z.number().int().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type DepartmentCreateFormData = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdateFormData = z.infer<typeof departmentUpdateSchema>;