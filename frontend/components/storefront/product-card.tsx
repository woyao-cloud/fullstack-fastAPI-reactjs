"use client";
import Link from "next/link";
import type { SpuResponse } from "@/types/api";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ProductCard({ product }: { product: SpuResponse }) {
  const active = product.status === "active";
  const minPrice = product.skus.length
    ? Math.min(...product.skus.map((s) => Number(s.price)))
    : 0;
  return (
    <Link href={`/products/${product.id}`}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          {/* coverImage 或占位块 */}
          <CardTitle className="text-base">{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground line-clamp-2">{product.description}</CardContent>
        <CardFooter className="flex items-center justify-between">
          <span className="font-semibold text-primary">¥{minPrice.toFixed(2)} 起</span>
          <Badge variant={active ? "default" : "secondary"}>{active ? "在售" : "下架"}</Badge>
        </CardFooter>
      </Card>
    </Link>
  );
}
