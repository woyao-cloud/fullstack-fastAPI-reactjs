"use client";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { SpuForm } from "@/components/admin/spu-form";

export default function NewProductPage() {
  return (
    <PermissionGuard code="product:manage">
      <h1 className="mb-4 text-xl font-semibold">新建商品</h1>
      <SpuForm mode="create" />
    </PermissionGuard>
  );
}
