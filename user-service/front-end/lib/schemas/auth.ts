import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
});

export const registerSchema = z.object({
  email: z.string().email("请输入有效的邮箱"),
  password: z.string().min(8, "密码至少 8 位"),
  confirmPassword: z.string(),
  first_name: z.string().min(1, "请输入名字"),
  last_name: z.string().min(1, "请输入姓氏"),
  phone: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "两次密码不一致",
  path: ["confirmPassword"],
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
