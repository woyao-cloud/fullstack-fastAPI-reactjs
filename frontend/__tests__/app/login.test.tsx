import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

const mocks = vi.hoisted(() => ({ push: vi.fn(), searchParams: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const EMAIL = "admin@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = new URLSearchParams();
  useAuthStore.setState({ accessToken: null, user: null, permissions: [], isAuthenticated: false, isLoading: false });
  vi.spyOn(useAuthStore.getState(), "login").mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByLabelText("邮箱")).toBeInTheDocument();
    expect(screen.getByLabelText("密码")).toBeInTheDocument();
  });

  it("shows validation errors for invalid input", async () => {
    render(<LoginPage />);
    // 注: base-ui 的 type="email" 输入在 jsdom 中不转发非法值给 RHF,
    // 因此这里以空表单提交验证错误展示（与真实行为一致）。
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(screen.getByText("邮箱格式不正确")).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText("密码至少 6 位")).toBeInTheDocument();
    expect(useAuthStore.getState().login).not.toHaveBeenCalled();
  });

  it("logs in and navigates to the redirect target", async () => {
    mocks.searchParams = new URLSearchParams("redirect=/cart");
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: EMAIL } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(useAuthStore.getState().login).toHaveBeenCalledWith(EMAIL, "secret1"));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/cart"));
    expect(toast.success).toHaveBeenCalledWith("登录成功");
  });

  it("navigates to /admin when no redirect is present", async () => {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: EMAIL } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin"));
  });

  it("rejects external redirect target and falls back to /admin", async () => {
    mocks.searchParams = new URLSearchParams("redirect=//evil.com");
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: EMAIL } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin"));
  });

  it("shows an error toast when login fails", async () => {
    (useAuthStore.getState().login as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("账号或密码错误"));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: EMAIL } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret1" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("账号或密码错误"));
  });
});
