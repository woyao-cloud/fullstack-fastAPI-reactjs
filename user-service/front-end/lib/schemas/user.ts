import { z } from "zod";

export const userCreateSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
  first_name: z.string().min(1, "请输入名字"),
  last_name: z.string().min(1, "请输入姓氏"),
  phone: z.string().optional(),
  department_id: z.string().uuid().optional().nullable(),
});

export const userUpdateSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).optional(),
});

export type UserCreateFormData = z.infer<typeof userCreateSchema>;
export type UserUpdateFormData = z.infer<typeof userUpdateSchema>;