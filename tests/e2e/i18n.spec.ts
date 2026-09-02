import { expect, test, type Page } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

const participantOrigin = process.env.PARTICIPANT_SITE_URL || "http://localhost:3000";
const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

async function selectLocale(page: Page, locale: "zh-CN" | "en" | "ja") {
  await page.locator("#ui-locale").selectOption(locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

test("language selection preserves the URL and persists locale, metadata, and document language", async ({ page, context }) => {
  await page.goto(`${participantOrigin}/?source=i18n#workflow`);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page).toHaveTitle("EgoCapture — 参与者采集门户");

  await selectLocale(page, "en");
  await expect(page).toHaveURL(`${participantOrigin}/?source=i18n#workflow`);
  await expect(page).toHaveTitle("EgoCapture — Participant portal");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Capture what happened.");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await selectLocale(page, "ja");
  await expect(page).toHaveTitle("EgoCapture — 参加者ポータル");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("現場を動画に。");

  const cookie = (await context.cookies(participantOrigin)).find((item) => item.name === "egocapture-locale");
  expect(cookie).toMatchObject({ value: "ja", httpOnly: true, sameSite: "Lax", path: "/" });
});

test("Accept-Language is used on the first request when no locale cookie exists", async ({ browser }) => {
  const context = await browser.newContext({ locale: "ja-JP" });
  const page = await context.newPage();
  await page.goto(`${participantOrigin}/login`);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.getByLabel("参加者 ID")).toBeVisible();
  await context.close();
});

test("Admin navigation, errors, and System Guide assets follow the selected locale", async ({ page }) => {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login?source=i18n`);
  await selectLocale(page, "en");
  await expect(page).toHaveURL(`${adminOrigin}/login?source=i18n`);
  await page.getByLabel("Admin account").fill(env.demoAdminUsername);
  await page.getByLabel("Password").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "Open admin console" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("navigation", { name: "Primary admin navigation" }).first()).toContainText("Collection tasks");

  await page.goto(`${adminOrigin}/participants`);
  await expect(page.getByRole("heading", { level: 1, name: "Participants" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Participant filters" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^View PT-/ }).first()).toBeVisible();

  await page.goto(`${adminOrigin}/system-guide`);
  await expect(page.getByRole("heading", { level: 1, name: "System guide" })).toBeVisible();
  await expect(page.locator("main iframe").first()).toHaveAttribute("src", /\/system-guide\/diagrams\/en\//);

  await selectLocale(page, "ja");
  await expect(page.getByRole("heading", { level: 1, name: "システムガイド" })).toBeVisible();
  await expect(page.locator("main iframe").first()).toHaveAttribute("src", /\/system-guide\/diagrams\/ja\//);

  await page.goto(`${adminOrigin}/participants`);
  await expect(page.getByRole("heading", { level: 1, name: "参加者" })).toBeVisible();
  await expect(page.getByRole("form", { name: "参加者の絞り込み" })).toBeVisible();
  await page.getByRole("button", { name: /^PT-.+ を表示$/ }).first().click();
  await expect(page.getByRole("dialog", { name: "参加者を表示" })).toBeVisible();
  await page.getByRole("button", { name: "参加者サイドパネルを閉じる" }).click();

  await page.evaluate(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error(String(response.status));
  });
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("管理者アカウント").fill("not-a-user");
  await page.getByLabel("パスワード").fill("not-a-valid-password");
  await page.getByRole("button", { name: "管理コンソールを開く" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "アカウントまたはパスワードが正しくありません" }),
  ).toBeVisible();
});
