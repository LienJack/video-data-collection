import { expect, test, type Page } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

const participantOrigin = process.env.PARTICIPANT_SITE_URL || "http://localhost:3000";
const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

const articleIds = [
  "system-architecture",
  "system-workflow",
  "resumable-upload",
  "live-capture",
] as const;

async function loginAdmin(page: Page) {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("Admin Account").fill(env.demoAdminUsername);
  await page.getByLabel("Password").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("系统说明直达地址继承 Admin 登录保护", async ({ page }) => {
  await page.goto(`${adminOrigin}/system-guide`);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Admin Account")).toBeVisible();
});

test("Admin 右上角入口打开包含四篇文章与四张交互图的说明中心", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loginAdmin(page);

  const entry = page.locator('a[href="/system-guide"]:visible');
  await expect(entry).toHaveCount(1);
  await expect(entry).toHaveText("系统说明");
  await entry.focus();
  await expect(entry).toBeFocused();
  await entry.press("Enter");

  await expect(page).toHaveURL(/\/system-guide$/);
  await expect(page.getByRole("heading", { level: 1, name: "系统说明" })).toBeVisible();
  await expect(page.locator('a[href="/system-guide"]:visible')).toHaveAttribute("aria-current", "page");

  const protectedPageResponse = await page.request.get(`${adminOrigin}/dashboard`);
  expect(protectedPageResponse.ok()).toBe(true);
  expect(protectedPageResponse.headers()["x-frame-options"]).toBe("DENY");
  expect(protectedPageResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");

  const articles = page.locator("main article");
  await expect(articles).toHaveCount(4);
  for (const articleId of articleIds) {
    await expect(page.locator(`article#${articleId}`)).toBeVisible();
    await expect(page.locator(`a[href="#${articleId}"]`)).toBeVisible();
  }

  const diagramFrames = page.locator("main iframe");
  await expect(diagramFrames).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(diagramFrames.nth(index)).toHaveAttribute("title", /\S+/);
    await expect(diagramFrames.nth(index)).toHaveAttribute("src", /^\/system-guide\/diagrams\/.+\.html$/);

    const diagramPath = await diagramFrames.nth(index).getAttribute("src");
    expect(diagramPath).toBeTruthy();
    const diagramResponse = await page.request.get(new URL(diagramPath!, adminOrigin).toString());
    expect(diagramResponse.ok()).toBe(true);
    expect(diagramResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");
    expect(diagramResponse.headers()["content-security-policy"]).toContain("frame-ancestors 'self'");
    await expect(diagramFrames.nth(index).contentFrame().locator("body")).toBeVisible();
  }

  const interactiveLinks = page.getByRole("link", { name: /打开交互图/ });
  await expect(interactiveLinks).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(interactiveLinks.nth(index)).toHaveAttribute("target", "_blank");
  }

  await page.locator('a[href="#live-capture"]').click();
  await expect(page).toHaveURL(/#live-capture$/);
  await expect(page.locator("article#live-capture")).toBeInViewport();
});

test("移动端保留独立说明入口且不改变五项主导航", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginAdmin(page);

  const entry = page.locator('header a[href="/system-guide"]:visible');
  await expect(entry).toHaveCount(1);
  await expect(entry).toHaveAccessibleName("系统说明");
  const target = await entry.boundingBox();
  expect(target).not.toBeNull();
  expect(target!.width).toBeGreaterThanOrEqual(44);
  expect(target!.height).toBeGreaterThanOrEqual(44);

  await entry.click();
  await expect(page).toHaveURL(/\/system-guide$/);
  await expect(entry).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "主要管理导航" }).getByRole("link")).toHaveCount(5);
  const pageWidth = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);
});

test("Participant 登录后的产品界面不暴露系统说明入口", async ({ page }) => {
  const env = integrationEnvironment();
  await page.goto(`${participantOrigin}/login`);
  await page.getByLabel("Participant ID").fill("PT-23456789");
  await page.getByLabel("Password").fill(env.demoParticipantPassword);
  await page.getByRole("button", { name: "进入我的任务" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("link", { name: "系统说明" })).toHaveCount(0);
  await expect(page.locator('a[href="/system-guide"]')).toHaveCount(0);
});
