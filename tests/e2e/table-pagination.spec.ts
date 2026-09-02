import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { integrationEnvironment } from "@/scripts/check-support";

const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";
const publicIdAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

async function loginAdmin(page: Page) {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("Admin Account").fill(env.demoAdminUsername);
  await page.getByLabel("Password").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function participantPublicIds(runPrefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const high = publicIdAlphabet[Math.floor(index / publicIdAlphabet.length)];
    const low = publicIdAlphabet[index % publicIdAlphabet.length];
    return `PT-${runPrefix}${high}${low}`;
  });
}

async function visibleParticipantIds(page: Page) {
  return await page.locator("tbody tr td:first-child a").allTextContents();
}

test("参与者分页保持筛选、顺序、任意页和浏览器历史", async ({ page }) => {
  test.setTimeout(120_000);
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8 });
  const runPrefix = randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()
    .replaceAll("0", "2")
    .replaceAll("1", "3")
    .replaceAll("I", "J")
    .replaceAll("O", "P");
  const marker = `Pagination-${runPrefix}`;
  const publicIds = participantPublicIds(runPrefix, 27);
  const aliases = publicIds.map((_, index) => `${marker} row ${String(index + 1).padStart(2, "0")}`);

  try {
    await db`
      insert into egocapture.participants ${db(publicIds.map((publicId, index) => ({
        public_id: publicId,
        display_alias: aliases[index],
        status: "draft",
        consent_status: "pending",
        notes: marker,
        is_fixture: true,
      })), "public_id", "display_alias", "status", "consent_status", "notes", "is_fixture")}
    `;

    await loginAdmin(page);
    await page.goto(`${adminOrigin}/participants?search=${encodeURIComponent(marker)}`);

    const pagination = page.getByRole("navigation", { name: "表格分页" });
    await expect(pagination).toContainText("共 27 条 · 第 1 / 2 页");
    await expect(page.locator("tbody tr")).toHaveCount(25);
    expect(await visibleParticipantIds(page)).toEqual(publicIds.slice(0, 25));
    await expect(pagination.getByText("上一页", { exact: true }))
      .toHaveAttribute("aria-disabled", "true");

    const nextHref = await pagination.getByRole("link", { name: "下一页" }).getAttribute("href");
    const nextUrl = new URL(nextHref || "", adminOrigin);
    expect(nextUrl.pathname).toBe("/participants");
    expect(nextUrl.searchParams.get("search")).toBe(marker);
    expect(nextUrl.searchParams.get("page")).toBe("2");

    await pagination.getByRole("spinbutton", { name: "前往页码，范围 1 到 2" }).fill("2");
    await pagination.getByRole("button", { name: "跳转" }).click();
    await expect(page).toHaveURL(new RegExp(`search=${marker}.*page=2`));
    await expect(page.getByRole("navigation", { name: "表格分页" })).toContainText("共 27 条 · 第 2 / 2 页");
    await expect(page.locator("tbody tr")).toHaveCount(2);
    expect(await visibleParticipantIds(page)).toEqual(publicIds.slice(25));

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`search=${marker}(?:$|&)`));
    await expect(page.locator("tbody tr")).toHaveCount(25);
    expect(await visibleParticipantIds(page)).toEqual(publicIds.slice(0, 25));

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`search=${marker}.*page=2`));
    await expect(page.locator("tbody tr")).toHaveCount(2);
    expect(await visibleParticipantIds(page)).toEqual(publicIds.slice(25));

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`search=${marker}(?:$|&)`));

    await page.getByRole("navigation", { name: "表格分页" }).getByRole("link", { name: "下一页" }).click();
    await expect(page).toHaveURL(new RegExp(`search=${marker}.*page=2`));
    expect(await visibleParticipantIds(page)).toEqual(publicIds.slice(25));

    await page.goto(`${adminOrigin}/participants?search=${encodeURIComponent(marker)}&page=99`);
    await expect(page.getByRole("navigation", { name: "表格分页" })).toContainText("共 27 条 · 第 2 / 2 页");
    expect(await visibleParticipantIds(page)).toEqual(publicIds.slice(25));

    await page.getByRole("textbox", { name: "Public ID 或 Alias" }).fill(aliases[26]);
    await page.getByRole("button", { name: "筛选" }).click();
    expect(new URL(page.url()).searchParams.get("page")).toBeNull();
    await expect(page.getByRole("navigation", { name: "表格分页" })).toContainText("共 1 条 · 第 1 / 1 页");
    expect(await visibleParticipantIds(page)).toEqual([publicIds[26]]);
  } finally {
    try {
      await db`delete from egocapture.participants where notes = ${marker}`;
      const [residual] = await db<{ remaining: number }[]>`
        select count(*)::integer as remaining
        from egocapture.participants
        where notes = ${marker}
      `;
      expect(residual?.remaining ?? 0).toBe(0);
    } finally {
      await db.end({ timeout: 2 });
    }
  }
});
