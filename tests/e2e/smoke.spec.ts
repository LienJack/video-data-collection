import { expect, test } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";
import { DEMO_CATALOG } from "@/scripts/fixtures/demo-catalog";

const participantOrigin = process.env.PARTICIPANT_SITE_URL || "http://localhost:3000";
const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

test("landing page exposes the product boundary", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "视频记录现场。 每段素材都有清晰来路。" })).toBeVisible();
  await expect(page.getByText("直传私有存储")).toBeVisible();
});

test("participant and admin deployments stay isolated on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${participantOrigin}/login`);
  await expect(page.getByLabel("参与者 ID")).toBeVisible();
  await expect(page.getByLabel("管理员账号")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto(`${adminOrigin}/login`);
  await expect(page.getByLabel("管理员账号")).toBeVisible();
  await expect(page.getByLabel("参与者 ID")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  expect((await page.request.get(`${participantOrigin}/api/admin/audit-events`)).status()).toBe(404);
  expect((await page.request.get(`${adminOrigin}/api/participant/assignments`)).status()).toBe(404);
});

test("WebKit can send a file directly to the Storage TUS data plane", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "WebKit-specific upload smoke");
  const env = integrationEnvironment();
  await page.goto("/login");
  await page.getByLabel("参与者 ID").fill(DEMO_CATALOG.people.find((person) => person.key === "cn-lin-xiaoyu")!.publicId);
  await page.getByLabel("密码").fill(env.demoParticipantPassword);
  await page.getByRole("button", { name: "进入我的任务" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await page.goto("/uploads");
  await page.locator('input[type="file"]').setInputFiles({
    name: "webkit-storage-smoke.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("Synthetic WebKit TUS transfer smoke; intentionally not a decodable video."),
  });
  const upload = page.getByRole("article").filter({ hasText: "webkit-storage-smoke.mp4" });
  await upload.getByLabel("录制会话").selectOption("unable");
  await upload.getByRole("button", { name: "开始直传存储" }).click();
  await expect(upload.getByText("已验证", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(upload.getByRole("link", { name: "查看服务端状态" })).toBeVisible();
});
