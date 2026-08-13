"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { categoriesApi } from "@/lib/api/categories";
import type { CategoryResponse } from "@/types/api";
import { categorySchema, type CategoryFormValues } from "@/lib/schemas/admin";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { CategoryTree } from "@/components/admin/category-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function CategoriesContent() {
  const [tree, setTree] = useState<CategoryResponse[]>([]);
  const [editing, setEditing] = useState<CategoryResponse | null>(null);
  const [addingParent, setAddingParent] = useState<CategoryResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  // zod 的 z.coerce/.default 使 _input 与 _output 类型分叉; 表单全程以输出类型 CategoryFormValues 为准
  const resolver = zodResolver(categorySchema) as unknown as Resolver<CategoryFormValues>;
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryFormValues>({
    resolver,
    defaultValues: { name: "", slug: "", sortOrder: 0, isActive: true },
  });

  const load = useCallback(() => {
    categoriesApi.tree().then((r) => setTree(r.data)).catch(() => setTree([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = (parent: CategoryResponse | null) => {
    setEditing(null); setAddingParent(parent); setShowForm(true);
    reset({ name: "", slug: "", parentId: parent?.id ?? null, sortOrder: 0, isActive: true });
  };
  const openEdit = (c: CategoryResponse) => {
    setEditing(c); setAddingParent(null); setShowForm(true);
    reset({ name: c.name, slug: c.slug, parentId: c.parentId, sortOrder: c.sortOrder, isActive: c.isActive });
  };

  const save = async (values: CategoryFormValues) => {
    try {
      // 后端 nullable 约定: 空字符串的 parentId/icon 需转为 null
      const payload = { ...values, parentId: values.parentId || null, icon: values.icon || null };
      if (editing) await categoriesApi.update(editing.id, payload);
      else await categoriesApi.create(payload);
      toast.success("已保存"); setShowForm(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
  };

  const remove = async (c: CategoryResponse) => {
    if (!window.confirm(`确定删除「${c.name}」？`)) return;
    try { await categoriesApi.remove(c.id); toast.success("已删除"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "删除失败"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">顶级分类 {tree.length} 个（含子级递归）</p>
        <Button onClick={() => openCreate(null)}>新建顶级分类</Button>
      </div>
      <CategoryTree nodes={tree} onEdit={openEdit} onAdd={(c) => openCreate(c)} onRemove={remove} />
      {showForm && (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-base">
            {editing ? "编辑分类" : addingParent ? `在「${addingParent.name}」下添加子级` : "新建顶级分类"}
          </CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(save)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">名称</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="slug">slug</Label>
                <Input id="slug" {...register("slug")} />
                {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="sortOrder">排序</Label>
                <Input id="sortOrder" type="number" {...register("sortOrder")} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" {...register("isActive")} /> 启用
              </label>
              <div className="flex gap-2">
                <Button type="submit">保存</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>取消</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <PermissionGuard code="product:manage">
      <h1 className="mb-4 text-xl font-semibold">分类管理</h1>
      <CategoriesContent />
    </PermissionGuard>
  );
}
