"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart } from "lucide-react";
import { useAuthStore } from "@/stores/auth";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => { hydrate(); }, [hydrate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
  };

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
    router.push("/");
  };

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="container mx-auto flex h-14 items-center gap-4 px-4">
          <Link href="/" className="shrink-0 font-semibold">商城</Link>
          <form onSubmit={handleSearch} className="w-full max-w-md">
            <div className="flex items-center gap-2 rounded-md border px-2 focus-within:ring-1 focus-within:ring-ring">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索商品"
                className="h-9 w-full bg-transparent text-sm outline-none"
                aria-label="搜索商品"
              />
            </div>
          </form>
          <div className="ml-auto flex items-center gap-3">
            {/* Task 10 才有 cart store; 现在仅入口链接 */}
            <Link href="/cart" aria-label="购物车" className="text-muted-foreground hover:text-foreground">
              <ShoppingCart className="size-5" />
            </Link>
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {user.email}
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border bg-card py-1 shadow-md">
                      <Link
                        href="/orders"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        我的订单
                      </Link>
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        后台入口
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        登出
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">登录</Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
