import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminLayout from "@/app/admin/layout";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: "/admin/products",
  auth: { isAuthenticated: false, isLoading: true, hydrate: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => mocks.pathname,
}));
vi.mock("@/stores/auth", () => ({
  useAuthStore: (sel?: (s: unknown) => unknown) => (sel ? sel(mocks.auth) : mocks.auth),
}));
vi.mock("@/components/admin/sidebar", () => ({ Sidebar: () => <div>SidebarMock</div> }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.isAuthenticated = false;
  mocks.auth.isLoading = true;
});

describe("AdminLayout", () => {
  it("renders 加载中 while loading", () => {
    render(<AdminLayout><div>body</div></AdminLayout>);
    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("redirects to login when unauthenticated", async () => {
    mocks.auth.isLoading = false;
    render(<AdminLayout><div>body</div></AdminLayout>);
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith(`/login?redirect=${encodeURIComponent("/admin/products")}`));
  });

  it("renders sidebar and children when authenticated", () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    render(<AdminLayout><div>body</div></AdminLayout>);
    expect(screen.getByText("SidebarMock")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});
