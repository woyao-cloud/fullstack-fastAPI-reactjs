import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

describe("LoginPage", () => {
  it("renders login form", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText(/邮箱/i)).toBeDefined();
    expect(screen.getByPlaceholderText(/密码/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /登录/i })).toBeDefined();
  });
});
