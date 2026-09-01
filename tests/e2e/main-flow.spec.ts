import { expect, test, type Page } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

const tinyMp4 = Buffer.from(
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMPbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjl0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAGxbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABXG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAARxzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwAraEJsBEAAAAwAQAAADACDxImoBAAVozgOcgAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAABOoAAAAAAAAABhzdHRzAAAAAAAAAAEAAAABAABAAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAJ1AAAAAQAAABRzdGNvAAAAAAAAAAEAAAM/AAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2Mi4xMi4xMDAAAAAIZnJlZQAAAn1tZGF0AAACUwYF//9P3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTEgZGVibG9jaz0wOjA6MCBhbmFseXNlPTA6MCBtZT1kaWEgc3VibWU9MCBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0wIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MCA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0wIHRocmVhZHM9MiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTAgaW50cmFfcmVmcmVzaD0wIHJjPWNyZiBtYnRyZWU9MCBjcmY9NDAuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0wAIAAAAAaZYiEOhGKAAZjgY4ABuTk5OuuuuuuuuuuuvA=",
  "base64",
);

async function logout(page: Page) {
  await page.evaluate(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error(`logout failed: ${response.status}`);
  });
}

async function loginParticipant(page: Page, password: string) {
  await page.goto("/login");
  await page.getByLabel("Participant ID").fill("PT-23456789");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "进入我的任务" }).click();
  await expect(page).toHaveURL(/\/participant\/tasks$/);
}

async function loginAdmin(page: Page, password: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "管理员" }).click();
  await page.getByLabel("Admin Email").fill("admin.demo@egocapture.invalid");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test("真实 Participant 上传与 Admin 不可变纠正闭环", async ({ page }) => {
  const env = integrationEnvironment();
  await page.setViewportSize({ width: 390, height: 844 });
  await loginParticipant(page, env.demoParticipantPassword);

  const unauthorized = await page.request.get("/api/admin/audit-events");
  expect(unauthorized.status()).toBe(403);

  await page.getByRole("link", { name: /Demo Only：上传 5～20 秒测试视频/ }).click();
  await expect(page.getByText(/AS-23456782 · Version 1 · assigned/)).toBeVisible();
  await page.getByRole("button", { name: "我已阅读并确认这个版本" }).click();
  await expect(page.getByRole("heading", { name: "创建 Recording Session" })).toBeVisible();
  await page.getByRole("button", { name: "创建 Session 并显示 Marker" }).click();
  await expect(page).toHaveURL(/\/participant\/sessions\/RS-/);
  const sessionPublicId = page.url().match(/(RS-[23456789A-Z]+)/)?.[1];
  if (!sessionPublicId) throw new Error("Recording Session Public ID missing from redirect URL");
  await expect(page.getByRole("img", { name: /签名二维码/ })).toBeVisible();
  await page.getByRole("button", { name: "我已拍摄二维码" }).click();
  await expect(page.getByText(/已确认：/)).toBeVisible();

  await page.getByRole("link", { name: "上传文件 →" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "playwright-real-mobile.mp4",
    mimeType: "video/mp4",
    buffer: tinyMp4,
  });
  const uploadCard = page.getByRole("article").filter({ hasText: "playwright-real-mobile.mp4" });
  await expect(uploadCard.getByText("ready", { exact: true })).toBeVisible();
  await uploadCard.getByLabel("Recording Session").selectOption("unable");
  const metadataResponse = page.waitForResponse((response) =>
    response.url().includes("/extract-metadata") && response.request().method() === "POST",
  );
  await uploadCard.getByRole("button", { name: "开始直传 Storage" }).click();
  await expect(uploadCard.getByText("verified", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect((await metadataResponse).status()).toBeLessThan(500);
  const detailsLink = uploadCard.getByRole("link", { name: "查看服务端状态" });
  const uploadHref = await detailsLink.getAttribute("href");
  const uploadPublicId = uploadHref?.match(/(UP-[23456789A-Z]+)/)?.[1];
  if (!uploadPublicId) throw new Error("Upload Public ID missing from details link");
  await detailsLink.click();
  await expect(page.getByText("verified", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/MPEG-4.*AVC/)).toBeVisible();
  await expect(page.getByText("unmatched", { exact: true })).toBeVisible();

  await logout(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginAdmin(page, env.demoAdminPassword);
  await page.goto(`/admin/uploads/${uploadPublicId}`);
  await expect(page.getByText("verified", { exact: true })).toBeVisible();
  await expect(page.getByText(/unmatched \/ metadata_unavailable/)).toBeVisible();
  const unmatchedReview = page.getByRole("link").filter({ hasText: "unmatched" }).first();
  await expect(unmatchedReview).toBeVisible();
  const reviewPublicId = (await unmatchedReview.textContent())?.match(/(RV-[23456789A-Z]+)/)?.[1];
  if (!reviewPublicId) throw new Error("ReviewCase Public ID missing from related review link");
  await unmatchedReview.click();

  await page.getByLabel("Session", { exact: true }).selectOption(sessionPublicId);
  await page.getByLabel("Device", { exact: true }).selectOption("DEV-23456789");
  await page.getByLabel("Reason", { exact: true }).fill("Playwright verified the participant claim and corrected it to the declared session.");
  await page.getByRole("button", { name: "提交不可变决策" }).click();
  await expect(page.getByText("此 ReviewCase 已终结；历史仍可查看。")).toBeVisible();
  await expect(page.getByText("admin_corrected", { exact: true })).toBeVisible();
  const historicalDecision = page.getByRole("article")
    .filter({ hasText: "unmatched" })
    .filter({ hasText: "historical" });
  await expect(historicalDecision).toBeVisible();

  await page.goto("/admin/audit");
  const audit = page.getByRole("article").filter({ hasText: "review_case.correct_match" }).first();
  await expect(audit).toContainText(reviewPublicId);
  await expect(audit).toContainText("Playwright verified the participant claim");
});
