import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { integrationEnvironment } from "@/scripts/check-support";

const tinyMp4 = Buffer.from(
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMPbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAjl0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAGxbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABXG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAARxzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDAgbGliYTI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwAraEJsBEAAAAwAQAAADACDxImoBAAVozgOcgAAAABBwYXNwAAAAAQAAAAEAAAAUYnJ0cgAAAAAAABOoAAAAAAAAABhzdHRzAAAAAAAAAAEAAAABAABAAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAAJ1AAAAAQAAABRzdGNvAAAAAAAAAAEAAAM/AAAAYnVkdGEAAABabWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAtaWxzdAAAACWpdG9vAAAAHWRhdGEAAAABAAAAAExhdmY2Mi4xMi4xMDAAAAAIZnJlZQAAAn1tZGF0AAACUwYF//9P3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE2NSByMzIyMiBiMzU2MDVhIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAyNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTAgcmVmPTEgZGVibG9jaz0wOjA6MCBhbmFseXNlPTA6MCBtZT1kaWEgc3VibWU9MCBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0wIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MCA4eDhkY3Q9MCBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0wIHRocmVhZHM9MiBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY2ZyYW1lcz0wIHdlaWdodHA9MCBrZXlpbnQ9MjUwIGtleWludF9taW49MSBzY2VuZWN1dD0wIGludHJhX3JlZnJlc2g9MCByYz1jcmYgbWJ0cmVlPTAgY3JmPTQwLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MACAAAAAGmWIhDoRigAGY4GOAAbk5OTr7u7u7u7u7u7w",
  "base64",
);

const participantOrigin = process.env.PARTICIPANT_SITE_URL || "http://localhost:3000";
const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

async function logout(page: Page) {
  await page.evaluate(async () => {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error(`logout failed: ${response.status}`);
  });
}

async function loginParticipant(page: Page, participantPublicId: string, password: string) {
  await page.goto(`${participantOrigin}/login`);
  await page.getByLabel("Participant ID").fill(participantPublicId);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "进入我的任务" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
}

async function loginAdmin(page: Page, password: string) {
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("Admin Account").fill("admin");
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function publicId(text: string, prefix: "PT" | "DEV" | "TSK" | "AS" | "RS" | "UP" | "RV") {
  const result = text.match(new RegExp(`(${prefix}-[23456789A-Z]+)`))?.[1];
  if (!result) throw new Error(`${prefix} Public ID missing from ${text}`);
  return result;
}

test("Admin 建档到 Participant 上传与不可变纠正的完整闭环", async ({ page }) => {
  test.setTimeout(180_000);
  const env = integrationEnvironment();
  const db = postgres(env.databaseUrl, { max: 1, prepare: false, connect_timeout: 8 });
  const suffix = randomUUID().slice(0, 8);
  const alias = `E2E Participant ${suffix}`;
  const taskTitle = `E2E Full Flow ${suffix}`;
  let participantPassword = "";
  let participantPublicId = "";
  let devicePublicId = "";
  let taskPublicId = "";
  let uploadPublicId = "";
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginAdmin(page, env.demoAdminPassword);

    await page.goto(`${adminOrigin}/participants/new`);
    await page.getByLabel("Display Alias").fill(alias);
    await page.getByLabel("Notes").fill("Synthetic Playwright acceptance identity without PII");
    await page.getByRole("button", { name: "创建 Draft Participant" }).click();
    await expect(page).toHaveURL(/\/participants\/PT-/);
    participantPublicId = publicId(page.url(), "PT");
    const credentialResponse = await page.request.get(
      `${adminOrigin}/api/admin/participants/${participantPublicId}`,
    );
    expect(credentialResponse.ok()).toBe(true);
    const credentialPayload = await credentialResponse.json() as {
      data?: { loginCredential?: { password?: string | null; status?: string; canLogin?: boolean } };
    };
    participantPassword = credentialPayload.data?.loginCredential?.password || "";
    expect(participantPassword).toHaveLength(16);
    expect(credentialPayload.data?.loginCredential).toMatchObject({
      status: "pending_activation",
      canLogin: false,
    });

    await page.getByRole("button", { name: "生成 / 重发邀请" }).click();
    const invitationLink = page.locator('a[href*="/invite/"]');
    await expect(invitationLink).toBeVisible();
    const invitationUrl = await invitationLink.getAttribute("href");
    if (!invitationUrl) throw new Error("Invitation URL missing");

    await logout(page);
    await page.goto(invitationUrl);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await page.getByRole("button", { name: "接受邀请并进入任务" }).click();
    await expect(page).toHaveURL(/\/tasks$/);

    await logout(page);
    await loginAdmin(page, env.demoAdminPassword);
    await page.goto(`${adminOrigin}/participants/${participantPublicId}`);
    await page.getByPlaceholder("Manufacturer").fill("Synthetic");
    await page.getByPlaceholder("Model").fill("E2E Check Cam");
    await page.getByPlaceholder("Firmware").fill("1.0.0-e2e");
    await page.getByRole("button", { name: "登记设备" }).click();
    await expect(page.getByText("Synthetic E2E Check Cam")).toBeVisible();
    devicePublicId = publicId(await page.locator("body").innerText(), "DEV");

    await page.goto(`${adminOrigin}/tasks/new`);
    const titleInput = page.getByLabel("任务标题 *");
    const descriptionInput = page.getByLabel("任务描述 *");
    await titleInput.focus();
    await expect(titleInput).toBeFocused();
    await page.keyboard.type(taskTitle);
    await expect(titleInput).toHaveValue(taskTitle);
    await titleInput.press("Tab");
    await expect(descriptionInput).toBeFocused();
    await page.keyboard.type("Playwright creates, publishes, assigns, records and uploads this frozen instruction version.");
    await page.getByLabel("目标分辨率 *").selectOption("__custom");
    await page.getByLabel("自定义分辨率").fill("1440p");
    const mustShowGroup = page.getByRole("group", { name: "必须展示" });
    await mustShowGroup.getByLabel("添加自定义选项").focus();
    await page.keyboard.type("E2E 标识牌");
    await page.keyboard.press("Enter");
    await page.getByLabel("添加说明模块").selectOption("steps");
    const stepsGroup = page.getByRole("group", { name: "具体执行步骤" });
    await stepsGroup.getByRole("button", { name: "添加步骤" }).click();
    await stepsGroup.getByLabel("操作说明 *").fill("展示 E2E 任务开始状态");
    await page.getByRole("button", { name: "创建草稿" }).click();
    await expect(page).toHaveURL(/\/tasks\/TSK-/);
    taskPublicId = publicId(page.url(), "TSK");
    await page.getByRole("link", { name: "任务说明" }).click();
    await page.getByRole("button", { name: "发布新版本" }).click();
    await expect(page.getByText("版本 1", { exact: true })).toBeVisible();

    await page.goto(`${adminOrigin}/assignments/new`);
    await page.getByLabel("Participant").selectOption(participantPublicId);
    await page.getByLabel("Published TaskVersion").selectOption(`${taskPublicId}:1`);
    await page.getByLabel("Preferred Device").selectOption(devicePublicId);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localTomorrow = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await page.getByLabel("Due At").fill(localTomorrow);
    await page.getByRole("button", { name: "创建 Assignment" }).click();
    await expect(page).toHaveURL(/\/assignments$/);
    await page.goto(`${adminOrigin}/assignments?search=${participantPublicId}`);
    const assignmentCard = page.getByRole("row").filter({ hasText: participantPublicId });
    await expect(assignmentCard).toContainText(taskTitle);
    const assignmentPublicId = publicId(await assignmentCard.innerText(), "AS");

    await logout(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginParticipant(page, participantPublicId, participantPassword);
    const absentAdminApi = await page.request.get(`${participantOrigin}/api/admin/audit-events`);
    expect(absentAdminApi.status()).toBe(404);
    await page.getByRole("link", { name: new RegExp(taskTitle) }).click();
    await expect(page.getByText(new RegExp(`${assignmentPublicId} · Version 1 · assigned`))).toBeVisible();
    await expect(page.getByRole("heading", { name: "必须展示" })).toBeVisible();
    await expect(page.getByText("E2E 标识牌", { exact: true })).toBeVisible();
    await expect(page.getByText("展示 E2E 任务开始状态", { exact: true })).toBeVisible();
    await expect(page.getByText(/1440p · 30 FPS/)).toBeVisible();
    await expect(page.getByText("目标规格：", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "上传与恢复" })).toBeVisible();
    await page.getByRole("button", { name: "我已阅读并确认这个版本" }).click();
    await page.getByRole("button", { name: "创建 Session 并显示 Marker" }).click();
    await expect(page).toHaveURL(/\/sessions\/RS-/);
    const sessionPublicId = publicId(page.url(), "RS");
    await expect(page.getByRole("img", { name: /签名二维码/ })).toBeVisible();
    await page.getByRole("button", { name: "我已拍摄二维码" }).click();
    await expect(page.getByText(/已确认：/)).toBeVisible();

    await page.getByRole("link", { name: "上传文件 →" }).click();
    await page.locator('input[type="file"]').setInputFiles({ name: `e2e-${suffix}.mp4`, mimeType: "video/mp4", buffer: tinyMp4 });
    const uploadCard = page.getByRole("article").filter({ hasText: `e2e-${suffix}.mp4` });
    await uploadCard.getByLabel("Recording Session").selectOption("unable");
    const metadataResponse = page.waitForResponse((response) => response.url().includes("/extract-metadata") && response.request().method() === "POST");
    await uploadCard.getByRole("button", { name: "开始直传 Storage" }).click();
    await expect(uploadCard.getByText("verified", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect((await metadataResponse).status()).toBeLessThan(500);
    const detailsLink = uploadCard.getByRole("link", { name: "查看服务端状态" });
    uploadPublicId = publicId((await detailsLink.getAttribute("href")) || "", "UP");
    await detailsLink.click();
    await expect(page.getByText("unmatched", { exact: true })).toBeVisible();

    await logout(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginAdmin(page, env.demoAdminPassword);
    await page.goto(`${adminOrigin}/uploads/${uploadPublicId}`);
    await expect(page.getByText("Unable to Determine", { exact: true })).toBeVisible();
    const unmatchedReview = page.getByRole("link").filter({ hasText: "unmatched" }).first();
    const reviewPublicId = publicId((await unmatchedReview.textContent()) || "", "RV");
    await unmatchedReview.click();
    await page.getByLabel("Session", { exact: true }).selectOption(sessionPublicId);
    await page.getByLabel("Device", { exact: true }).selectOption(devicePublicId);
    await expect(page.getByLabel("Change Preview")).toContainText(`Before Unmatched / —`);
    await expect(page.getByLabel("Change Preview")).toContainText(`After ${sessionPublicId} / ${devicePublicId}`);
    const correctionReason = `Playwright ${suffix} verified and corrected the synthetic participant upload.`;
    await page.getByLabel("Reason", { exact: true }).fill(correctionReason);
    await page.getByRole("button", { name: "提交不可变决策" }).click();
    await expect(page.getByText("admin_corrected", { exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "unmatched" }).filter({ hasText: "historical" })).toBeVisible();

    await page.goto(`${adminOrigin}/audit`);
    const audit = page.getByRole("row").filter({ hasText: "review_case.correct_match" }).first();
    await expect(audit).toContainText(reviewPublicId);
    await expect(audit).toContainText(correctionReason);
  } finally {
    if (participantPublicId) {
      await db`update egocapture.participants set is_fixture = true where public_id = ${participantPublicId}`;
      await db`update egocapture.devices set is_fixture = true where id in (
        select device_id from egocapture.device_assignments where participant_id = (
          select id from egocapture.participants where public_id = ${participantPublicId}
        )
      )`;
      await db`update egocapture.video_assets set is_fixture = true where participant_id = (
        select id from egocapture.participants where public_id = ${participantPublicId}
      )`;
      await db`update egocapture.review_cases review set is_fixture = true where review.video_asset_id in (
        select id from egocapture.video_assets where participant_id = (
          select id from egocapture.participants where public_id = ${participantPublicId}
        )
      ) or review.assignment_id in (
        select id from egocapture.assignments where participant_id = (
          select id from egocapture.participants where public_id = ${participantPublicId}
        )
      )`;
    }
    if (taskPublicId) await db`update egocapture.tasks set is_fixture = true where public_id = ${taskPublicId}`;
    await db.end({ timeout: 2 });
  }
});
