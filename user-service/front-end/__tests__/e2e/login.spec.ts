import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("请输入邮箱")).toBeVisible();
    await expect(page.getByPlaceholder("请输入密码")).toBeVisible();
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible();
  });

  test("should show validation errors for empty form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "登录" }).click();
    // Zod validation should show error messages
    await expect(page.getByText("请输入有效的邮箱")).toBeVisible();
  });

  test("should navigate to register page", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("去注册").click();
    await expect(page).toHaveURL("/register");
    await expect(page.getByRole("button", { name: "注册" })).toBeVisible();
  });

  test("should show register page", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByPlaceholder("请输入邮箱")).toBeVisible();
    await expect(page.getByPlaceholder("请输入密码")).toBeVisible();
    await expect(page.getByPlaceholder("请确认密码")).toBeVisible();
    await expect(page.getByRole("button", { name: "注册" })).toBeVisible();
  });

  test("should navigate back to login from register", async ({ page }) => {
    await page.goto("/register");
    await page.getByText("去登录").click();
    await expect(page).toHaveURL("/login");
  });
});
