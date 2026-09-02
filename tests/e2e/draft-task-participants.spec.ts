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
  const participantPublicId = createPublicId("PT");
  let taskPublicId = "";

  try {
    const participantId = randomUUID();
    await db`
      insert into egocapture.participants (
        id, public_id, display_alias, status, consent_status, is_fixture, created_by
      )
      select
        ${participantId}::uuid, ${participantPublicId}, ${alias},
        'active', 'valid', true, profile.id
      from egocapture.profiles profile
      join auth.users auth_user on auth_user.id = profile.auth_user_id
      where auth_user.email = ${env.demoAdminEmail}
      limit 1
    `;

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
    await expect(page.getByRole("heading", { name: instructions.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "添加参与者" })).toBeEnabled();
    await expect(page.getByText("这个任务还没有参与者")).toBeVisible();

    await page.getByRole("button", { name: "添加参与者" }).click();
    await page.getByRole("checkbox", { name: `选择 ${alias}` }).check();
    await page.getByRole("button", { name: "加入发布名单" }).click();
    await expect(page.getByText("已加入发布名单")).toBeVisible();
    await page.getByRole("button", { name: "完成" }).click();

    await expect(page.getByText(`${participantPublicId} · 草稿名单`, { exact: true })).toBeVisible();
    await expect(page.getByText("待发布", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `移除 ${alias}` }).click();
    await page.getByRole("button", { name: "确认移除" }).click();
    await expect(page.getByText("这个任务还没有参与者")).toBeVisible();

    await page.getByRole("button", { name: "添加参与者" }).click();
    await page.getByRole("checkbox", { name: `选择 ${alias}` }).check();
    await page.getByRole("button", { name: "加入发布名单" }).click();
    await expect(page.getByText("已加入发布名单")).toBeVisible();
    await page.getByRole("button", { name: "完成" }).click();

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
    await db.end({ timeout: 2 });
  }
});
