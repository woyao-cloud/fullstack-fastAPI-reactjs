"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { roleCreateSchema, roleUpdateSchema, type RoleCreateFormData, type RoleUpdateFormData } from "@/lib/schemas/role";
import { roleApi } from "@/lib/api/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PermissionOut, RoleOut } from "@/types/user";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  role?: RoleOut;
  allPermissions: PermissionOut[];
}

export function RoleFormDialog({ open, onOpenChange, onSaved, role, allPermissions }: Props) {
  const [error, setError] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<Set<string>>(
    new Set(role?.permissions.map((p) => p.id) ?? [])
  );
  const isEdit = !!role;

  const form = useForm<RoleCreateFormData | RoleUpdateFormData>({
    resolver: zodResolver(isEdit ? roleUpdateSchema : roleCreateSchema),
    defaultValues: isEdit ? {
      name: role!.name,
      code: role!.code,
      description: role!.description ?? "",
      data_scope: role!.data_scope as "ALL" | "DEPT" | "SELF" | "CUSTOM" | undefined,
      status: role!.status as "ACTIVE" | "INACTIVE" | undefined,
    } : {
      name: "",
      code: "",
      description: "",
    },
  });

  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;

  const togglePerm = (id: string) => {
    setSelectedPerms((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const onSubmit = async (data: RoleCreateFormData | RoleUpdateFormData) => {
    try {
      setError("");
      const payload = { ...data, permission_ids: Array.from(selectedPerms) };
      if (isEdit && role) {
        await roleApi.update(role.id, payload as RoleUpdateFormData);
      } else {
        await roleApi.create(payload as RoleCreateFormData);
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑角色" : "创建角色"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">角色名称</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-red-500 text-sm">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="code">角色代码</Label>
            <Input id="code" {...register("code")} />
            {errors.code && <p className="text-red-500 text-sm">{errors.code.message}</p>}
          </div>
          <div>
            <Label htmlFor="description">描述</Label>
            <Input id="description" {...register("description")} />
          </div>
          {isEdit && (
            <div>
              <Label htmlFor="data_scope">数据范围</Label>
              <select id="data_scope" {...register("data_scope")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                <option value="ALL">ALL</option>
                <option value="DEPT">DEPT</option>
                <option value="SELF">SELF</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
            </div>
          )}
          {isEdit && (
            <div>
              <Label htmlFor="status">状态</Label>
              <select id="status" {...register("status")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
          <div>
            <Label>权限</Label>
            <div className="border rounded-md p-2 max-h-40 overflow-y-auto grid grid-cols-2 gap-1">
              {allPermissions.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={selectedPerms.has(p.id)} onChange={() => togglePerm(p.id)} />
                  {p.code}
                </label>
              ))}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isEdit ? "保存" : "创建"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}