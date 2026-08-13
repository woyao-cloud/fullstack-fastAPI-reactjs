"use client";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { brandsApi } from "@/lib/api/brands";
import type { BrandResponse, PageResponse } from "@/types/api";
import { brandSchema, type BrandFormValues } from "@/lib/schemas/admin";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EMPTY: BrandFormValues = { name: "", logoUrl: "", description: "", sortOrder: 0 };

function BrandsContent() {
  const [data, setData] = useState<PageResponse<BrandResponse> | null>(null);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<BrandResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  // zod 的 z.coerce/.default 使 _input 与 _output 类型分叉; 表单全程以输出类型 BrandFormValues 为准
  const resolver = zodResolver(brandSchema) as unknown as Resolver<BrandFormValues>;
  const { register, handleSubmit, reset, formState: { errors } } = useForm<BrandFormValues>({
    resolver, defaultValues: EMPTY,
  });

  const load = useCallback(() => {
    brandsApi.list(page, 10).then((r) => setData(r.data)).catch(() => setData(null));
  }, [page]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setShowForm(true); reset(EMPTY); };
  const openEdit = (b: BrandResponse) => {
    setEditing(b); setShowForm(true);
    reset({ name: b.name, logoUrl: b.logoUrl ?? "", description: b.description ?? "", sortOrder: b.sortOrder });
  };
  const save = async (values: BrandFormValues) => {
    const payload = { ...values, logoUrl: values.logoUrl || null, description: values.description || null };
    try {
      if (editing) await brandsApi.update(editing.id, payload);
      else await brandsApi.create(payload);
      toast.success("已保存"); setShowForm(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "保存失败"); }
  };
  const remove = async (b: BrandResponse) => {
    if (!window.confirm(`确定删除「${b.name}」？`)) return;
    try { await brandsApi.remove(b.id); toast.success("已删除"); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "删除失败"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={openCreate}>新建品牌</Button></div>
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-muted-foreground">
          <th className="py-2">名称</th><th>描述</th><th>排序</th><th className="text-right">操作</th>
        </tr></thead>
        <tbody>
          {(data?.items ?? []).map((b) => (
            <tr key={b.id} className="border-b">
              <td className="py-2">{b.name}</td>
              <td className="text-muted-foreground">{b.description ?? "—"}</td>
              <td>{b.sortOrder}</td>
              <td className="space-x-2 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>编辑</Button>
                <Button variant="ghost" size="sm" onClick={() => remove(b)}>删除</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {data && data.total > data.size && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">第 {page + 1} / {Math.max(1, Math.ceil(data.total / data.size))} 页</span>
          <Button variant="outline" size="sm"
            disabled={(page + 1) * data.size >= data.total} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}
      {showForm && (
        <Card className="max-w-md">
          <CardHeader><CardTitle className="text-base">{editing ? "编辑品牌" : "新建品牌"}</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(save)} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="bname">名称</Label>
                <Input id="bname" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="logo">Logo URL</Label>
                <Input id="logo" {...register("logoUrl")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="desc">描述</Label>
                <Input id="desc" {...register("description")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sort">排序</Label>
                <Input id="sort" type="number" {...register("sortOrder")} />
              </div>
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

export default function BrandsPage() {
  return (
    <PermissionGuard code="product:manage">
      <h1 className="mb-4 text-xl font-semibold">品牌管理</h1>
      <BrandsContent />
    </PermissionGuard>
  );
}
