"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { departmentCreateSchema, departmentUpdateSchema, type DepartmentCreateFormData, type DepartmentUpdateFormData } from "@/lib/schemas/department";
import { departmentApi } from "@/lib/api/departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DepartmentOut } from "@/types/user";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  department?: DepartmentOut;
  parentId?: string | null;
}

export function DepartmentFormDialog({ open, onOpenChange, onSaved, department, parentId }: Props) {
  const [error, setError] = useState("");
  const isEdit = !!department;

  const form = useForm<DepartmentCreateFormData | DepartmentUpdateFormData>({
    resolver: zodResolver(isEdit ? departmentUpdateSchema : departmentCreateSchema),
    defaultValues: isEdit ? {
      name: department!.name,
      code: department!.code,
      sort_order: department!.sort_order,
      manager_id: department!.manager_id,
      status: department!.status as "ACTIVE" | "INACTIVE" | undefined,
    } : {
      name: "",
      code: "",
      sort_order: 0,
      parent_id: parentId ?? null,
      manager_id: null,
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  const onSubmit = async (data: DepartmentCreateFormData | DepartmentUpdateFormData) => {
    try {
      setError("");
      if (isEdit && department) {
        await departmentApi.update(department.id, data as DepartmentUpdateFormData);
      } else {
        await departmentApi.create(data as DepartmentCreateFormData);
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
          <DialogTitle>{isEdit ? "编辑部门" : "创建部门"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">部门名称</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="code">部门代码</Label>
            <Input id="code" {...register("code")} />
            {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
          </div>
          <div>
            <Label htmlFor="sort_order">排序</Label>
            <Input id="sort_order" type="number" {...register("sort_order", { valueAsNumber: true })} />
          </div>
          {isEdit && (
            <div>
              <Label htmlFor="status">状态</Label>
              <select id="status" {...register("status")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
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