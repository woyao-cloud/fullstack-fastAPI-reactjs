"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userCreateSchema, userUpdateSchema, type UserCreateFormData, type UserUpdateFormData } from "@/lib/schemas/user";
import { userApi } from "@/lib/api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { UserOut } from "@/types/user";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  user?: UserOut;
}

export function UserFormDialog({ open, onOpenChange, onSaved, user }: Props) {
  const [error, setError] = useState("");
  const isEdit = !!user;

  const form = useForm<UserCreateFormData | UserUpdateFormData>({
    resolver: zodResolver(isEdit ? userUpdateSchema : userCreateSchema),
    defaultValues: isEdit ? {
      first_name: user!.first_name,
      last_name: user!.last_name,
      phone: user!.phone ?? "",
      status: user!.status as "ACTIVE" | "INACTIVE" | "LOCKED" | undefined,
    } : {
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone: "",
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  const onSubmit = async (data: UserCreateFormData | UserUpdateFormData) => {
    try {
      setError("");
      if (isEdit && user) {
        await userApi.update(user.id, data as UserUpdateFormData);
      } else {
        await userApi.create(data as UserCreateFormData);
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑用户" : "创建用户"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!isEdit && (
            <>
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" type="email" {...register("email")} />
                {"email" in errors && errors.email && <p className="text-red-500 text-sm">{errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input id="password" type="password" {...register("password")} />
                {"password" in errors && errors.password && <p className="text-red-500 text-sm">{errors.password.message}</p>}
              </div>
            </>
          )}
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="first_name">姓</Label>
              <Input id="first_name" {...register("first_name")} />
              {errors.first_name && <p className="text-red-500 text-sm">{errors.first_name.message}</p>}
            </div>
            <div className="flex-1">
              <Label htmlFor="last_name">名</Label>
              <Input id="last_name" {...register("last_name")} />
              {errors.last_name && <p className="text-red-500 text-sm">{errors.last_name.message}</p>}
            </div>
          </div>
          <div>
            <Label htmlFor="phone">手机号</Label>
            <Input id="phone" {...register("phone")} />
          </div>
          {isEdit && (
            <div>
              <Label htmlFor="status">状态</Label>
              <select id="status" {...register("status")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="LOCKED">LOCKED</option>
              </select>
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isEdit ? "保存" : "创建"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}