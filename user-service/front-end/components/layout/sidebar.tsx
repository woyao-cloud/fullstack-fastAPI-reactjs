"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "仪表板", icon: "📊" },
  { href: "/dashboard/users", label: "用户管理", icon: "👥" },
  { href: "/dashboard/departments", label: "部门管理", icon: "🏢" },
  { href: "/dashboard/roles", label: "角色管理", icon: "🔑" },
  { href: "/dashboard/config", label: "系统配置", icon: "⚙️" },
];

const bottomItems = [
  { href: "/dashboard/profile", label: "个人中心", icon: "👤" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 border-r bg-card flex flex-col shrink-0">
      <div className="p-4 font-bold text-lg border-b">用户管理系统</div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <nav className="p-2 border-t space-y-1">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
