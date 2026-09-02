import { expect, test } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

test("admin regional fields use linked standard values", async ({ page }) => {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("Admin Account").fill("admin");
  await page.getByLabel("Password").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`${adminOrigin}/participants/new`);
  const country = page.getByLabel("Country / Region");
  const locale = page.getByLabel("Locale");
  const timezone = page.getByLabel("Timezone");

  await expect(country).toHaveValue("CN");
  await expect(locale).toHaveValue("zh-CN");
  await expect(timezone).toHaveValue("Asia/Shanghai");
  expect(await country.locator("option").count()).toBeGreaterThan(240);

  await country.selectOption("JP");
  await expect(locale).toHaveValue("ja-JP");
  await expect(timezone).toHaveValue("Asia/Tokyo");
});
