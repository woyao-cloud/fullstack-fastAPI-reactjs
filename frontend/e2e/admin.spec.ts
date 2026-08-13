import { test, expect } from "@playwright/test";

// 前置: 本机已 `docker compose up`（网关 + 三服务 + user-service）并跑过
// `scripts/test-data/load-test-data.sh`；且 user-service 中已有
// `admin@example.com / password` 账号并具备 `order:manage` 权限
// （参考 plan-fix ④：账号/权限需在 user-service 中补建并赋权）。
test("后台登录→商品列表→发货", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForURL(/\/login/);
  await page.getByLabel("邮箱").fill("admin@example.com");
  await page.getByLabel("密码").fill("password");
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/admin/);
  await expect(page.getByText("商品管理")).toBeVisible();
  await page.goto("/admin/orders");
  await expect(page.getByText(/订单号|NO/).first()).toBeVisible();
});
