import { expect, test } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

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
  await expect(page.getByLabel("Participant ID")).toBeVisible();
  await expect(page.getByLabel("Admin Account")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await page.goto(`${adminOrigin}/login`);
  await expect(page.getByLabel("Admin Account")).toBeVisible();
  await expect(page.getByLabel("Participant ID")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  expect((await page.request.get(`${participantOrigin}/api/admin/audit-events`)).status()).toBe(404);
  expect((await page.request.get(`${adminOrigin}/api/participant/assignments`)).status()).toBe(404);
});

test("WebKit can send a file directly to the Storage TUS data plane", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "WebKit-specific upload smoke");
  const env = integrationEnvironment();
  await page.goto("/login");
  await page.getByLabel("Participant ID").fill("PT-23456789");
  await page.getByLabel("Password").fill(env.demoParticipantPassword);
  await page.getByRole("button", { name: "进入我的任务" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await page.goto("/uploads");
  await page.locator('input[type="file"]').setInputFiles({
    name: "webkit-storage-smoke.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("Synthetic WebKit TUS transfer smoke; intentionally not a decodable video."),
  });
  const upload = page.getByRole("article").filter({ hasText: "webkit-storage-smoke.mp4" });
  await upload.getByLabel("Recording Session").selectOption("unable");
  await upload.getByRole("button", { name: "开始直传 Storage" }).click();
  await expect(upload.getByText("verified", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(upload.getByRole("link", { name: "查看服务端状态" })).toBeVisible();
});
