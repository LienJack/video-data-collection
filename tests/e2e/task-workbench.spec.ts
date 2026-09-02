import { expect, test } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

test("管理员从任务进入人员与上传工作台", async ({ page }) => {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("Admin Account").fill(env.demoAdminUsername);
  await page.getByLabel("Password").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`${adminOrigin}/tasks?search=TSK-23456784`);
  await expect(page.getByRole("heading", { name: "采集任务" })).toBeVisible();
  const taskRow = page.getByRole("row").filter({ hasText: "TSK-23456784" });
  await expect(taskRow).toContainText("整理桌面");
  await taskRow.getByRole("link", { name: "整理桌面" }).click();

  await expect(page.getByRole("heading", { name: "整理桌面" })).toBeVisible();
  await expect(page.getByText("一个任务对应一组参与者。每个人拥有独立进度、Session 和视频，人员调整不会改写历史。"))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "添加参与者" })).toBeVisible();

  await page.getByRole("link", { name: /参与者/ }).last().click();
  await expect(page.getByRole("heading", { name: "当前参与者" })).toBeVisible();
  await expect(page.getByText("PT-23456789 · AS-23456784", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "替换" })).toBeVisible();

  await page.getByRole("link", { name: /上传视频/ }).last().click();
  await expect(page.getByRole("heading", { name: "上传视频" })).toBeVisible();
  const upload = page.getByRole("article").filter({ hasText: "demo-upload-failed.mp4" });
  await expect(upload).toContainText("Participant Demo · PT-23456789");
  await expect(upload.getByRole("link", { name: "查看上传详情" })).toHaveAttribute("href", "/uploads/UP-23456782");

  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`${adminOrigin}/tasks/TSK-23456784`);
  await expect(page.getByRole("navigation", { name: "主要管理导航" }).last()).toBeVisible();
  const bodyWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(bodyWidth.scroll).toBeLessThanOrEqual(bodyWidth.client);
});
