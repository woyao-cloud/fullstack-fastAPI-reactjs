import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/admin/sidebar";
import { useAuthStore } from "@/stores/auth";

const mocks = vi.hoisted(() => ({ push: vi.fn(), pathname: "/admin/products" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ permissions: ["*:*"], isAuthenticated: true });
});

describe("Sidebar", () => {
  it("renders nav items filtered by permission", () => {
    useAuthStore.setState({ permissions: ["product:manage"] });
    render(<Sidebar />);
    expect(screen.getByText("商品管理")).toBeInTheDocument();
    expect(screen.getByText("分类管理")).toBeInTheDocument();
    expect(screen.queryByText("订单管理")).not.toBeInTheDocument();
    expect(screen.queryByText("库存查询")).not.toBeInTheDocument();
  });

  it("shows all items for wildcard permission", () => {
    useAuthStore.setState({ permissions: ["*:*"] });
    render(<Sidebar />);
    expect(screen.getByText("订单管理")).toBeInTheDocument();
    expect(screen.getByText("库存查询")).toBeInTheDocument();
  });

  it("logs out and navigates home", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: /退出登录/ }));
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(mocks.push).toHaveBeenCalledWith("/");
  });
});
