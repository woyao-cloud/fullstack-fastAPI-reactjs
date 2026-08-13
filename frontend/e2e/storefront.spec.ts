import { test, expect } from "@playwright/test";

// 前置: 本机已 `docker compose up`（网关 + 三服务 + user-service）并跑过
// `scripts/test-data/load-test-data.sh`；且 user-service 中已有
// `admin@example.com / password` 账号并具备 `product:manage` + `order:manage` 权限
// （参考 plan-fix ④：账号/权限需在 user-service 中补建并赋权）。
test("浏览→加购→下单→支付→我的订单", async ({ page }) => {
  // 前置: 本机已 docker compose up（三服务+网关+user-service）+ load-test-data.sh
  await page.goto("/");
  // 首页无 h1、商品名渲染在 CardTitle 内(非 data-testid) — 直接断言商品链接可见
  await expect(page.locator("a[href^='/products/']").first()).toBeVisible();
  await page.locator("a[href^='/products/']").first().click();
  await page.getByRole("button", { name: "加入购物车" }).click();   // 未登录 → 跳登录
  await page.waitForURL(/\/login/);
  await page.getByLabel("邮箱").fill("admin@example.com");           // 以测试数据中的用户登录
  await page.getByLabel("密码").fill("password");
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL(/\/products\//);
  await page.getByRole("button", { name: "加入购物车" }).click();
  await page.goto("/cart");
  await page.getByRole("button", { name: "去结算" }).click();
  await page.getByRole("button", { name: "提交订单" }).click();
  await page.waitForURL(/\/orders\//);
  await page.getByRole("button", { name: "支付" }).click();
  await expect(page.getByText("已支付")).toBeVisible();
});
