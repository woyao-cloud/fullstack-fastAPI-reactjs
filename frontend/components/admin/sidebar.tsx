"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  BadgeCheck,
  Boxes,
  ShoppingCart,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}

const navItems: NavItem[] = [
  { label: "仪表板", href: "/admin", icon: LayoutDashboard },
  { label: "商品管理", href: "/admin/products", icon: Package, permission: "product:manage" },
  { label: "分类管理", href: "/admin/categories", icon: FolderTree },
  { label: "品牌管理", href: "/admin/brands", icon: BadgeCheck },
  { label: "库存查询", href: "/admin/inventory", icon: Boxes, permission: "inventory:manage" },
  { label: "订单管理", href: "/admin/orders", icon: ShoppingCart, permission: "order:manage" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const hasAnyPermission = useAuthStore((s) => s.hasAnyPermission);

  const visible = navItems.filter((item) => !item.permission || hasAnyPermission([item.permission]));

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <aside className="flex w-60 flex-col border-r bg-sidebar p-4">
      <nav className="flex flex-1 flex-col gap-1">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent",
                active && "bg-sidebar-accent font-medium"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Button variant="outline" className="mt-4 w-full justify-start gap-2" onClick={handleLogout}>
        <LogOut className="size-4" />
        退出登录
      </Button>
    </aside>
  );
}
