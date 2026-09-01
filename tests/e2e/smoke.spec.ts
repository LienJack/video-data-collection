import { expect, test } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

test("landing page exposes the product boundary", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /让每段录制/ })).toBeVisible();
  await expect(page.getByText("0 byte")).toBeVisible();
});

test("WebKit can send a file directly to the Storage TUS data plane", async ({ page, browserName }) => {
  test.skip(browserName !== "webkit", "WebKit-specific upload smoke");
  const env = integrationEnvironment();
  await page.goto("/login");
  await page.getByLabel("Participant ID").fill("PT-23456789");
  await page.getByLabel("Password").fill(env.demoParticipantPassword);
  await page.getByRole("button", { name: "进入我的任务" }).click();
  await expect(page).toHaveURL(/\/participant\/tasks$/);
  await page.goto("/participant/uploads");
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
