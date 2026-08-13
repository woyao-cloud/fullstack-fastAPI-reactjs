import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PermissionGuard } from "@/components/shared/permission-guard";
import { useAuthStore } from "@/stores/auth";

beforeEach(() => {
  useAuthStore.setState({ permissions: [] });
});

describe("PermissionGuard", () => {
  it("renders children when permitted", () => {
    useAuthStore.setState({ permissions: ["product:manage"] });
    render(<PermissionGuard code="product:manage"><div>内容</div></PermissionGuard>);
    expect(screen.getByText("内容")).toBeInTheDocument();
  });

  it("shows denial message without permission", () => {
    render(<PermissionGuard code="product:manage"><div>内容</div></PermissionGuard>);
    expect(screen.getByText(/无权限访问该功能/)).toBeInTheDocument();
    expect(screen.queryByText("内容")).not.toBeInTheDocument();
  });

  it("allows wildcard permission", () => {
    useAuthStore.setState({ permissions: ["*:*"] });
    render(<PermissionGuard code="order:manage"><div>内容</div></PermissionGuard>);
    expect(screen.getByText("内容")).toBeInTheDocument();
  });
});
