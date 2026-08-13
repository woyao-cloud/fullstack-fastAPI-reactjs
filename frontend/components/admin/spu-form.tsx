"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { spuSchema, type SpuFormValues } from "@/lib/schemas/spu";
import { SkuEditor, type SkuRow } from "@/components/admin/sku-editor";
import { productsApi } from "@/lib/api/products";
import { categoriesApi } from "@/lib/api/categories";
import { brandsApi } from "@/lib/api/brands";
import type { CategoryResponse, SpuCreateRequest, SpuResponse } from "@/types/api";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const splitCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

const emptySku = (): SkuRow => ({ specs: {}, price: 0, skuCode: "", barCode: null, weight: null, images: [], isActive: true });

function flattenCategories(cats: CategoryResponse[], depth = 0): { id: string; name: string; depth: number }[] {
  const out: { id: string; name: string; depth: number }[] = [];
  for (const c of cats) {
    out.push({ id: c.id, name: c.name, depth });
    if (c.children?.length) out.push(...flattenCategories(c.children, depth + 1));
  }
  return out;
}

// 从 RHF 的 errors.skus 提取可展示文案(数组级 min(1) 或首个 SKU 内联错误)
function getSkuError(errors: unknown): string {
  if (!errors || typeof errors !== "object") return "";
  const e = (errors as { skus?: unknown }).skus;
  if (!e) return "";
  if (Array.isArray(e)) {
    for (const item of e) {
      if (item && typeof item === "object" && "message" in item && (item as { message?: string }).message) {
        return String((item as { message: string }).message);
      }
    }
    return "";
  }
  if (typeof e === "object" && "message" in e) return String((e as { message?: string }).message ?? "");
  return "";
}

// 规格模板: key + 逗号分隔可选值(本地原始文本, 输入即提交保持表单新鲜)
function SpecValuesInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(() => value.join(", "));
  return (
    <Input
      placeholder="可选值，逗号分隔" className="flex-1" value={text}
      onChange={(e) => { setText(e.target.value); onChange(splitCsv(e.target.value)); }}
      onBlur={() => onChange(splitCsv(text))}
    />
  );
}

function SpecsTemplateEditor({ value, onChange }: {
  value: { key: string; values: string[] }[];
  onChange: (v: { key: string; values: string[] }[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.map((spec, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder="规格名（如 颜色）" className="w-40" value={spec.key}
            onChange={(e) => onChange(value.map((s, j) => (j === i ? { ...s, key: e.target.value } : s)))} />
          <SpecValuesInput value={spec.values}
            onChange={(v) => onChange(value.map((s, j) => (j === i ? { ...s, values: v } : s)))} />
          <Button type="button" variant="ghost" size="sm"
            onClick={() => onChange(value.filter((_, j) => j !== i))}>删除</Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...value, { key: "", values: [] }])}>添加规格模板</Button>
    </div>
  );
}

export function SpuForm({ mode, id, initial }: { mode: "create" | "edit"; id?: string; initial?: SpuResponse }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [imagesText, setImagesText] = useState(initial?.images?.join(", ") ?? "");
  const [tagsText, setTagsText] = useState(initial?.tags?.join(", ") ?? "");

  const defaultValues: SpuFormValues = {
    name: initial?.name ?? "",
    description: initial?.description ?? null,
    categoryId: initial?.category?.id ?? "",
    brandId: initial?.brand?.id ?? null,
    coverImage: initial?.coverImage ?? null,
    images: initial?.images ?? [],
    specsTemplate: initial?.specsTemplate ?? [],
    tags: initial?.tags ?? [],
    skus: initial && initial.skus.length
      ? initial.skus.map((s) => ({
          specs: s.specs, price: Number(s.price), skuCode: s.skuCode, barCode: s.barCode,
          weight: s.weight == null ? null : Number(s.weight), images: s.images, isActive: s.isActive,
        }))
      : [emptySku()],
  };

  // zod 的 z.coerce/.default 使 _input 与 _output 类型分叉; 表单全程以输出类型 SpuFormValues 为准
  const resolver = zodResolver(spuSchema) as unknown as Resolver<SpuFormValues>;
  const form = useForm<SpuFormValues>({ resolver, defaultValues });

  useEffect(() => {
    categoriesApi.tree().then((r) => setCategories(r.data)).catch(() => toast.error("加载分类失败"));
    brandsApi.list(0, 200).then((r) => setBrands(r.data.items)).catch(() => toast.error("加载品牌失败"));
  }, []);

  const onSubmit = async (values: SpuFormValues) => {
    try {
      const parsed = spuSchema.parse({ ...values, images: splitCsv(imagesText), tags: splitCsv(tagsText) });
      setSubmitting(true);
      // 后端契约: skus[].price/weight 为字符串, zod 内部为 number, 提交前转回
      const payload: SpuCreateRequest = {
        name: parsed.name,
        description: parsed.description ?? null,
        categoryId: parsed.categoryId,
        brandId: parsed.brandId ?? null,
        coverImage: parsed.coverImage ?? null,
        images: parsed.images,
        specsTemplate: parsed.specsTemplate,
        tags: parsed.tags,
        skus: parsed.skus.map((s) => ({
          specs: s.specs,
          price: String(s.price),
          skuCode: s.skuCode,
          barCode: s.barCode ?? null,
          weight: s.weight == null ? null : String(s.weight),
          images: s.images,
          isActive: s.isActive,
        })),
      };
      if (mode === "create") {
        await productsApi.create(payload);
        toast.success("创建成功");
      } else {
        await productsApi.update(id!, payload);
        toast.success("保存成功");
      }
      router.push("/admin/products");
    } catch {
      toast.error("保存失败，请检查表单");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem>
              <FormLabel>商品名 *</FormLabel>
              <FormControl><Input placeholder="商品名称" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="categoryId" render={({ field }) => (
            <FormItem>
              <FormLabel>分类 *</FormLabel>
              <FormControl>
                <select {...field} className="w-full rounded border px-2 py-1 text-sm">
                  <option value="">请选择分类</option>
                  {flattenCategories(categories).map((c) => (
                    <option key={c.id} value={c.id}>{"　".repeat(c.depth)}{c.name}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="brandId" render={({ field }) => (
            <FormItem>
              <FormLabel>品牌</FormLabel>
              <FormControl>
                <select value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)}
                  className="w-full rounded border px-2 py-1 text-sm">
                  <option value="">请选择品牌</option>
                  {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <FormField control={form.control} name="coverImage" render={({ field }) => (
            <FormItem>
              <FormLabel>封面图 URL</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} value={field.value ?? ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel>描述</FormLabel>
            <FormControl><Textarea placeholder="商品描述" {...field} value={field.value ?? ""} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">图片 URL（逗号分隔）</span>
            <Input value={imagesText} onChange={(e) => setImagesText(e.target.value)}
              placeholder="https://a.jpg, https://b.jpg" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">标签（逗号分隔）</span>
            <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="热卖, 新品" />
          </label>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">规格模板</span>
          <Controller control={form.control} name="specsTemplate" render={({ field }) => (
            <SpecsTemplateEditor value={field.value} onChange={field.onChange} />
          )} />
        </div>

        <div className="space-y-2">
          <span className="text-sm font-medium">SKU 列表 *</span>
          <Controller control={form.control} name="skus" render={({ field }) => (
            <SkuEditor value={field.value} onChange={field.onChange} />
          )} />
          {getSkuError(form.formState.errors) && (
            <p className="text-sm text-destructive">{getSkuError(form.formState.errors)}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "保存中…" : mode === "create" ? "创建商品" : "保存修改"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
        </div>
      </form>
    </Form>
  );
}
