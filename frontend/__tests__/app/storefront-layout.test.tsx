import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StorefrontLayout from "@/app/(storefront)/layout";
import { useAuthStore } from "@/stores/auth";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ isAuthenticated: false, user: null, permissions: [], isLoading: false });
});

describe("StorefrontLayout", () => {
  it("shows 登录 link when anonymous", () => {
    render(<StorefrontLayout><div>body</div></StorefrontLayout>);
    expect(screen.getByText("登录")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "购物车" })).toBeInTheDocument();
  });

  it("shows user menu when authenticated and logs out", () => {
    const logout = vi.spyOn(useAuthStore.getState(), "logout");
    useAuthStore.setState({ isAuthenticated: true, user: { id: "u1", email: "a@b.c" } });
    render(<StorefrontLayout><div>body</div></StorefrontLayout>);
    fireEvent.click(screen.getByText("a@b.c"));
    expect(screen.getByText("我的订单")).toBeInTheDocument();
    expect(screen.getByText("后台入口")).toBeInTheDocument();
    fireEvent.click(screen.getByText("登出"));
    expect(logout).toHaveBeenCalled();
    expect(mocks.push).toHaveBeenCalledWith("/");
  });

  it("submits a search query", () => {
    render(<StorefrontLayout><div>body</div></StorefrontLayout>);
    fireEvent.change(screen.getByLabelText("搜索商品"), { target: { value: "手机" } });
    fireEvent.submit(document.querySelector("form")!);
    expect(mocks.push).toHaveBeenCalledWith("/?q=%E6%89%8B%E6%9C%BA");
  });

  it("submitting empty search goes to home", () => {
    render(<StorefrontLayout><div>body</div></StorefrontLayout>);
    fireEvent.submit(document.querySelector("form")!);
    expect(mocks.push).toHaveBeenCalledWith("/");
  });
});
