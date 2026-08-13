"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { productsApi } from "@/lib/api/products";
import type { SpuResponse, SpuStatus } from "@/types/api";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { SpuForm } from "@/components/admin/spu-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<SpuStatus, string> = { draft: "草稿", active: "在售", inactive: "下架" };

function EditContent({ id }: { id: string }) {
  const [spu, setSpu] = useState<SpuResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productsApi.detail(id)
      .then((r) => setSpu(r.data))
      .catch(() => toast.error("加载商品失败"))
      .finally(() => setLoading(false));
  }, [id]);

  const toggle = async () => {
    if (!spu) return;
    const target: SpuStatus = spu.status === "active" ? "inactive" : "active";
    try {
      await productsApi.changeStatus(spu.id, target);
      setSpu({ ...spu, status: target });
      toast.success(target === "active" ? "已上架" : "已下架");
    } catch {
      toast.error("操作失败");
    }
  };

  if (loading) return <p className="text-muted-foreground">加载中…</p>;
  if (!spu) return <p className="text-muted-foreground">商品不存在</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">编辑商品</h1>
        <Badge variant="outline">{STATUS_LABEL[spu.status]}</Badge>
        <Button variant="outline" size="sm" className="ml-auto" onClick={toggle}>
          {spu.status === "active" ? "下架" : "上架"}
        </Button>
      </div>
      <SpuForm key={spu.id} mode="edit" id={id} initial={spu} />
    </div>
  );
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <PermissionGuard code="product:manage">
      <EditContent id={id} />
    </PermissionGuard>
  );
}
