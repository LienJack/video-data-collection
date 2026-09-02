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

  await expect(page.locator('input[type="hidden"][name="countryRegion"]')).toHaveValue("CN");
  await expect(page.locator('input[type="hidden"][name="locale"]')).toHaveValue("zh-CN");
  await expect(page.locator('input[type="hidden"][name="timezone"]')).toHaveValue("Asia/Shanghai");
  const countryListId = await country.getAttribute("list");
  const localeListId = await locale.getAttribute("list");
  const timezoneListId = await timezone.getAttribute("list");
  expect(countryListId).toBeTruthy();
  expect(localeListId).toBeTruthy();
  expect(timezoneListId).toBeTruthy();
  expect(await page.locator(`datalist[id="${countryListId}"] option`).count()).toBeGreaterThan(240);

  await country.fill("JP");
  await expect(country).toHaveValue(/Japan/);
  await expect(page.locator('input[type="hidden"][name="countryRegion"]')).toHaveValue("JP");
  await expect(page.locator('input[type="hidden"][name="locale"]')).toHaveValue("ja-JP");
  await expect(page.locator('input[type="hidden"][name="timezone"]')).toHaveValue("Asia/Tokyo");
});
