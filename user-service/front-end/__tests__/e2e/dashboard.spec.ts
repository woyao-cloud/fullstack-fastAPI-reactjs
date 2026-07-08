import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });

  test("should redirect to login for protected routes", async ({ page }) => {
    await page.goto("/dashboard/users");
    await expect(page).toHaveURL("/login");
  });

  test("should show sidebar navigation", async ({ page }) => {
    await page.goto("/login");
    // Sidebar should not be visible on login page
    await expect(page.getByText("用户管理系统")).not.toBeVisible();
  });
});
