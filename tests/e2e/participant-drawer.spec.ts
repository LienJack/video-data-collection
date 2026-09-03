import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { integrationEnvironment } from "@/scripts/check-support";

const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";
const participantOrigin = process.env.PARTICIPANT_SITE_URL || "http://localhost:3000";

async function loginAdmin(page: Page) {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("Admin Account").fill(env.demoAdminUsername);
  await page.getByLabel("Password").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test("参与者 drawer 保留列表状态并完成查看、复制、编辑和生成密码", async ({ page }) => {
  test.setTimeout(120_000);
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8 });
  const participantPublicId = createPublicId("PT");
  const marker = `Drawer-${randomUUID().slice(0, 8)}`;
  const updatedAlias = `${marker}-updated`;
  let readyPassword = "";

  try {
    await db`
      insert into egocapture.participants (
        public_id, display_alias, management_email, status, consent_status,
        locale, timezone, country_region, notes, is_fixture
      ) values (
        ${participantPublicId}, ${marker}, ${`${marker}@example.com`}, 'draft', 'pending',
        'zh-CN', 'Asia/Shanghai', 'CN', ${marker}, false
      )
    `;

    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: adminOrigin });
    await loginAdmin(page);

    await page.goto(`${adminOrigin}/participants?search=PT-23456789`);
    const fixtureRow = page.getByRole("row").filter({ hasText: "PT-23456789" });
    const fixtureView = fixtureRow.getByRole("button", { name: "查看 PT-23456789" });
    await fixtureView.click();
    let drawer = page.getByRole("dialog", { name: "查看参与者" });
    await expect(drawer).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
    await page.keyboard.press("Tab");
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await expect(drawer.getByText("当前凭据可以直接登录。")).toBeVisible();
    const readyCredential = drawer.getByRole("region", { name: "参与者登录信息" });
    readyPassword = (await readyCredential.locator("code").nth(1).innerText()).trim();
    expect(readyPassword.length).toBeGreaterThanOrEqual(12);
    await readyCredential.getByRole("button", { name: /复制完整登录信息/ }).click();
    const readyBundle = await page.evaluate(() => navigator.clipboard.readText());
    expect(readyBundle).toContain("帐号：PT-23456789");
    expect(readyBundle.split("密码：")[1]?.length ?? 0).toBeGreaterThanOrEqual(12);

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
    await expect(fixtureView).toBeFocused();
    await fixtureRow.getByRole("button", { name: "编辑 PT-23456789" }).click();
    drawer = page.getByRole("dialog", { name: "编辑参与者" });
    await expect(drawer.getByText("Demo Fixture 受保护，公开管理员可以查看，但不能保存修改。")).toBeVisible();
    await expect(drawer.getByRole("button", { name: "保存修改" })).toBeDisabled();
    await drawer.getByRole("button", { name: "关闭参与者侧边栏" }).click();

    const listUrl = `${adminOrigin}/participants?search=${encodeURIComponent(marker)}&status=draft&page=1`;
    await page.goto(listUrl);
    let participantRow = page.getByRole("row").filter({ hasText: participantPublicId });
    const editButton = participantRow.getByRole("button", { name: `编辑 ${participantPublicId}` });
    await editButton.click();
    drawer = page.getByRole("dialog", { name: "编辑参与者" });
    const aliasField = drawer.getByRole("textbox", { name: /Display Alias/ });
    await expect(aliasField).toBeFocused();
    await aliasField.fill(updatedAlias);
    await drawer.getByRole("textbox", { name: /Notes/ }).fill(`${marker}-notes`);
    await drawer.getByRole("button", { name: "保存修改" }).click();
    await expect(drawer).toBeHidden();
    expect(page.url()).toBe(listUrl);
    participantRow = page.getByRole("row").filter({ hasText: participantPublicId });
    await expect(participantRow).toContainText(updatedAlias);

    const viewButton = participantRow.getByRole("button", { name: `查看 ${participantPublicId}` });
    await viewButton.click();
    drawer = page.getByRole("dialog", { name: "查看参与者" });
    await drawer.getByRole("button", { name: "生成登录密码" }).click();
    await expect(drawer.getByText("确定为该参与者生成登录密码吗？")).toBeVisible();
    await drawer.getByRole("button", { name: "确认" }).click();
    await expect(drawer.getByText("等待激活")).toBeVisible();
    await expect(drawer.getByText("密码已生成，但参与者必须先接受邀请完成激活后才能登录。")).toBeVisible();
    await expect(drawer.getByRole("button", { name: /复制完整登录信息/ })).toBeVisible();
    const generatedPassword = (await drawer.getByRole("region", { name: "参与者登录信息" }).locator("code").nth(1).innerText()).trim();

    await page.mouse.click(10, 260);
    await expect(drawer).toBeHidden();
    await expect(viewButton).toBeFocused();

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await viewButton.click();
      drawer = page.getByRole("dialog", { name: "查看参与者" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText(generatedPassword)).toBeVisible();
      const drawerBox = await drawer.boundingBox();
      expect(drawerBox?.x).toBe(0);
      expect(drawerBox?.width).toBe(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(viewButton).toBeFocused();
    }

    await page.goto(`${participantOrigin}/login`);
    await page.getByLabel("Participant ID").fill("PT-23456789");
    await page.getByLabel("Password").fill(readyPassword);
    await page.getByRole("button", { name: "进入我的任务" }).click();
    await expect(page).toHaveURL(/\/tasks$/);
  } finally {
    try {
      await db`
        delete from egocapture.participant_login_credentials
        where participant_id = (select id from egocapture.participants where public_id = ${participantPublicId})
      `;
      await db`delete from egocapture.participants where public_id = ${participantPublicId}`;
    } finally {
      await db.end({ timeout: 2 });
    }
  }
});
