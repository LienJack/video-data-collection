import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { createPublicId } from "@egocapture/core/domain/public-id";
import { defaultTaskInstructions } from "@egocapture/core/domain/task-template";
import { integrationEnvironment } from "@/scripts/check-support";

const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

test("草稿任务可以维护发布前参与者名单", async ({ page }) => {
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8 });
  const suffix = randomUUID().slice(0, 8);
  const alias = `Draft Roster ${suffix}`;
  const secondaryAlias = `Draft Roster Secondary ${suffix}`;
  const southRegion = `华南-${suffix}`;
  const eastRegion = `华东-${suffix}`;
  const participantPublicId = createPublicId("PT");
  const secondaryParticipantPublicId = createPublicId("PT");
  const defaultDevicePublicId = createPublicId("DEV");
  let participantPostCount = 0;
  let taskPublicId = "";

  try {
    const participantId = randomUUID();
    await db`
      insert into egocapture.participants (
        id, public_id, display_alias, status, consent_status, country_region, is_fixture, created_by
      )
      select
        ${participantId}::uuid, ${participantPublicId}, ${alias},
        'active', 'valid', ${southRegion}, true, profile.id
      from egocapture.profiles profile
      join auth.users auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email = ${env.demoAdminEmail}
      limit 1
    `;
    const defaultDeviceId = randomUUID();
    await db`
      insert into egocapture.devices (
        id, public_id, manufacturer, model, device_type, status, is_fixture
      ) values (
        ${defaultDeviceId}::uuid, ${defaultDevicePublicId}, 'Synthetic', 'Draft Roster Camera',
        'action_camera', 'active', true
      )
    `;
    await db`
      insert into egocapture.device_assignments (device_id, participant_id, assigned_by)
      select ${defaultDeviceId}::uuid, ${participantId}::uuid, profile.id
      from egocapture.profiles profile
      join auth.users auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email = ${env.demoAdminEmail}
      limit 1
    `;
    await db`
      update egocapture.participants
      set default_device_id = ${defaultDeviceId}::uuid
      where id = ${participantId}::uuid
    `;
    await db`
      insert into egocapture.participants (
        id, public_id, display_alias, status, consent_status, country_region, is_fixture, created_by
      )
      select
        ${randomUUID()}::uuid, ${secondaryParticipantPublicId}, ${secondaryAlias},
        'active', 'valid', ${eastRegion}, true, profile.id
      from egocapture.profiles profile
      join auth.users auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email = ${env.demoAdminEmail}
      limit 1
    `;

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${adminOrigin}/login`);
    await page.getByLabel("Admin Account").fill(env.demoAdminUsername);
    await page.getByLabel("Password").fill(env.demoAdminPassword);
    await page.getByRole("button", { name: "进入管理控制台" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const instructions = structuredClone(defaultTaskInstructions);
    instructions.title = `Draft Roster Task ${suffix}`;
    const createResponse = await page.request.post(`${adminOrigin}/api/admin/tasks`, {
      headers: {
        origin: adminOrigin,
        "content-type": "application/json",
        "idempotency-key": randomUUID(),
      },
      data: { instructions },
    });
    expect(createResponse.status()).toBe(201);
    const created = await createResponse.json() as { data: { taskPublicId: string } };
    taskPublicId = created.data.taskPublicId;

    await page.goto(`${adminOrigin}/tasks/${taskPublicId}?tab=participants`);
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().endsWith(`/api/admin/tasks/${taskPublicId}/participants`)) participantPostCount += 1;
    });
    await expect(page.getByRole("heading", { name: instructions.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "添加参与者" })).toBeEnabled();
    await expect(page.getByText("这个任务还没有参与者")).toBeVisible();

    await page.getByRole("button", { name: "添加参与者" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const desktopDialogBox = await dialog.boundingBox();
    expect(desktopDialogBox).not.toBeNull();
    expect(Math.abs(desktopDialogBox!.x + desktopDialogBox!.width / 2 - 640)).toBeLessThanOrEqual(2);
    expect(Math.abs(desktopDialogBox!.y + desktopDialogBox!.height / 2 - 450)).toBeLessThanOrEqual(2);
    await expect(dialog.getByRole("button", { name: "下一步：设备与设置" })).toBeDisabled();
    await expect(dialog.getByRole("heading", { name: "每人设备" })).toHaveCount(0);

    await dialog.getByRole("button", { name: "关闭添加参与者窗口" }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "添加参与者" }).click();
    const mobileDialogBox = await dialog.boundingBox();
    expect(mobileDialogBox).not.toBeNull();
    expect(Math.abs(mobileDialogBox!.y + mobileDialogBox!.height - 838)).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByRole("button", { name: "关闭添加参与者窗口" }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "添加参与者" }).click();

    const participantList = dialog.getByTestId("participant-list");
    const lastParticipant = dialog.getByTestId("participant-option").last();
    await lastParticipant.scrollIntoViewIfNeeded();
    const participantListBox = await participantList.boundingBox();
    const lastParticipantBox = await lastParticipant.boundingBox();
    expect(participantListBox).not.toBeNull();
    expect(lastParticipantBox).not.toBeNull();
    expect(lastParticipantBox!.y + lastParticipantBox!.height).toBeLessThanOrEqual(participantListBox!.y + participantListBox!.height + 1);

    const regionFilter = dialog.getByTestId("region-filter-trigger");
    await regionFilter.focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("checkbox", { name: southRegion }).focus();
    await page.keyboard.press("Space");
    await expect(dialog.getByText("显示 1 人，已选择 0 人", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: `选择 ${alias}` })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: `选择 ${secondaryAlias}` })).toHaveCount(0);
    await dialog.getByRole("checkbox", { name: eastRegion }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByText("显示 2 人，已选择 0 人", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: `选择 ${secondaryAlias}` })).toBeVisible();
    await dialog.getByLabel("搜索参与者").fill(alias);
    await expect(dialog.getByRole("checkbox", { name: `选择 ${alias}` })).toBeVisible();
    await expect(dialog.getByRole("checkbox", { name: `选择 ${secondaryAlias}` })).toHaveCount(0);
    await dialog.getByLabel("搜索参与者").fill("");
    await dialog.getByRole("button", { name: "清空地区筛选" }).click();
    await expect(regionFilter).toContainText("全部地区");
    await regionFilter.click();

    await page.getByRole("checkbox", { name: `选择 ${alias}` }).check();
    await dialog.getByLabel("搜索参与者").press("Enter");
    expect(participantPostCount).toBe(0);
    await expect(dialog.getByRole("heading", { name: "选择人员" })).toBeVisible();
    await regionFilter.click();
    await dialog.getByRole("checkbox", { name: eastRegion }).click();
    await expect(dialog.getByRole("checkbox", { name: `选择 ${alias}` })).toHaveCount(0);
    await expect(dialog.getByText("已选择 1 人", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "清空地区筛选" }).click();
    await regionFilter.click();
    await page.getByRole("checkbox", { name: `选择 ${secondaryAlias}` }).check();
    const nextStep = page.getByRole("button", { name: "下一步：设备与设置" });
    await nextStep.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("heading", { name: "每人设备" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "选择人员，已完成" })).toBeVisible();
    const settingsDialogBox = await dialog.boundingBox();
    expect(settingsDialogBox).not.toBeNull();
    expect(Math.abs(settingsDialogBox!.x + settingsDialogBox!.width / 2 - 640)).toBeLessThanOrEqual(2);
    expect(Math.abs(settingsDialogBox!.y + settingsDialogBox!.height / 2 - 450)).toBeLessThanOrEqual(2);
    await expect(dialog.getByLabel(alias)).toHaveValue(defaultDevicePublicId);
    await dialog.getByLabel(alias).selectOption("");
    await expect(dialog.getByLabel(secondaryAlias)).toHaveValue("");
    const dueAtValue = await dialog.getByLabel("截止时间").inputValue();
    await dialog.getByLabel("分配备注").fill(`往返保留-${suffix}`);
    await dialog.getByRole("button", { name: "选择人员，已完成" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("checkbox", { name: `选择 ${alias}` })).toBeChecked();
    await dialog.getByRole("checkbox", { name: `选择 ${secondaryAlias}` }).uncheck();
    await dialog.getByRole("button", { name: "设备与设置", exact: true }).click();
    await expect(dialog.getByLabel(secondaryAlias)).toHaveCount(0);
    await expect(dialog.getByLabel("截止时间")).toHaveValue(dueAtValue);
    await expect(dialog.getByLabel("分配备注")).toHaveValue(`往返保留-${suffix}`);
    const submitRoster = page.getByRole("button", { name: "加入发布名单" });
    await expect(submitRoster).toBeEnabled();
    await submitRoster.click();
    await expect(dialog).not.toBeVisible();
    expect(participantPostCount).toBe(1);

    await expect(page.getByText(`${participantPublicId} · 草稿名单`, { exact: true })).toBeVisible();
    await expect(page.getByText("待发布", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `移除 ${alias}` }).click();
    await page.getByRole("button", { name: "确认移除" }).click();
    await expect(page.getByText("这个任务还没有参与者")).toBeVisible();

    await page.getByRole("button", { name: "添加参与者" }).click();
    await page.getByRole("checkbox", { name: `选择 ${alias}` }).check();
    await page.getByRole("button", { name: "下一步：设备与设置" }).click();
    await expect(submitRoster).toBeEnabled();
    await submitRoster.click();
    await expect(dialog).not.toBeVisible();

    const publishResponse = await page.request.post(
      `${adminOrigin}/api/admin/tasks/${taskPublicId}/publish`,
      { headers: { origin: adminOrigin, "idempotency-key": randomUUID() } },
    );
    expect(publishResponse.status()).toBe(201);
    const published = await publishResponse.json() as {
      data: { version: number; materializedParticipantCount: number };
    };
    expect(published.data).toMatchObject({ version: 1, materializedParticipantCount: 1 });

    await page.goto(`${adminOrigin}/tasks/${taskPublicId}?tab=participants`);
    const participantRow = page.getByRole("row").filter({ hasText: alias });
    await expect(participantRow).toContainText("版本 1");
    await expect(participantRow).toContainText("待确认");
    await expect(participantRow).toContainText(/AS-[23456789A-Z]+/);
  } finally {
    if (taskPublicId) {
      await db`update egocapture.tasks set is_fixture = true where public_id = ${taskPublicId}`;
    }
    await db`update egocapture.participants set is_fixture = true where public_id = ${participantPublicId}`;
    await db`update egocapture.participants set is_fixture = true where public_id = ${secondaryParticipantPublicId}`;
    await db.end({ timeout: 2 });
  }
});
