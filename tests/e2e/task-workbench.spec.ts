import { expect, test } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";
import { DEMO_CATALOG } from "@/scripts/fixtures/demo-catalog";

const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";
const task = DEMO_CATALOG.tasks.find((candidate) => candidate.key === "us-brew-coffee")!;
const scenario = DEMO_CATALOG.scenarios.find((candidate) => candidate.key === "failed-retry-us")!;
const participant = DEMO_CATALOG.people.find((candidate) => candidate.key === scenario.participantKey)!;

test("管理员从任务进入人员与上传工作台", async ({ page }) => {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("管理员账号").fill(env.demoAdminUsername);
  await page.getByLabel("密码").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`${adminOrigin}/tasks?search=${task.publicId}`);
  await expect(page.getByRole("heading", { name: "采集任务" })).toBeVisible();
  const taskRow = page.getByRole("row").filter({ hasText: task.publicId });
  await expect(taskRow).toContainText(task.instructions.title);
  await taskRow.getByRole("link", { name: task.instructions.title }).click();

  await expect(page.getByRole("heading", { name: task.instructions.title })).toBeVisible();
  await expect(page.getByText("一个任务对应一组参与者。每个人拥有独立进度、录制会话和视频，人员调整不会改写历史。"))
    .toBeVisible();
  await expect(page.getByRole("button", { name: "添加参与者" })).toBeVisible();

  await page.getByRole("link", { name: /参与者/ }).last().click();
  await expect(page.getByRole("heading", { name: "当前参与者" })).toBeVisible();
  const participantRow = page.getByRole("row").filter({ hasText: `${participant.publicId} · ${scenario.assignmentPublicId}` });
  await expect(participantRow).toBeVisible();
  await expect(participantRow.getByRole("button", { name: "替换" })).toBeVisible();

  await page.getByRole("link", { name: /上传视频/ }).last().click();
  await expect(page.getByRole("heading", { name: "上传视频" })).toBeVisible();
  const upload = page.getByRole("article").filter({ hasText: `fixture-${scenario.key}.mp4` });
  await expect(upload).toContainText(`${participant.displayAlias} · ${participant.publicId}`);
  await expect(upload.getByRole("link", { name: "查看上传详情" })).toHaveAttribute("href", `/uploads/${scenario.uploadPublicId}`);

  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`${adminOrigin}/tasks/${task.publicId}`);
  await expect(page.getByRole("navigation", { name: "主要管理导航" }).last()).toBeVisible();
  const bodyWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(bodyWidth.scroll).toBeLessThanOrEqual(bodyWidth.client);
});
