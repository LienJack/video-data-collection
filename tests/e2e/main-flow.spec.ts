import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { integrationEnvironment } from "@/scripts/check-support";

const tinyMp4 = Buffer.from(
  "AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMWbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAkB0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAEAAAABAAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAG4bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABY21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAASNzdGJsAAAAv3N0c2QAAAAAAAAAAQAAAK9hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAEAAQABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDAgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANWF2Y0MBZAAK/+EAGGdkAAqs2UQmwEQAAAMABAAAAwAIPEiWWAEABmjr48siwP34+AAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAWuAAAAAAAAAAYc3R0cwAAAAAAAAABAAAAAQAAQAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAEAAAABAAAAFHN0c3oAAAAAAAAC1wAAAAEAAAAUc3RjbwAAAAAAAAABAAADRgAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjIuMTIuMTAwAAAACGZyZWUAAALfbWRhdAAAAq0GBf//qdxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjUgcjMyMjIgYjM1NjA1YSAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjUgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0yIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2FkYXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtleWludD0yNTAga2V5aW50X21pbj0xIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAImWIhAAV//73ye/Apuvb3rW/k89I+HvGUA+sGavr20h/+zE=",
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
  await page.getByLabel("参与者 ID").fill(participantPublicId);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "进入我的任务" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
}

async function loginAdmin(page: Page, password: string) {
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("管理员账号").fill("admin");
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

function publicId(text: string, prefix: "PT" | "DEV" | "TSK" | "AS" | "RS" | "UP" | "RV") {
  const result = text.match(new RegExp(`(${prefix}-[23456789A-Z]+)`))?.[1];
  if (!result) throw new Error(`${prefix} Public ID missing from ${text}`);
  return result;
}

test("Admin 建档到 Participant 上传与不可变纠正的完整闭环", async ({ page }) => {
  test.setTimeout(300_000);
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
    await page.getByLabel("显示别名").fill(alias);
    await page.getByLabel("备注").fill("Synthetic Playwright acceptance identity without PII");
    await page.getByRole("button", { name: "创建草稿参与者" }).click();
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
    await page.getByPlaceholder("制造商").fill("Synthetic");
    await page.getByPlaceholder("型号").fill("E2E Check Cam");
    await page.getByPlaceholder("固件版本").fill("1.0.0-e2e");
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
    await page.getByLabel("参与者").selectOption(participantPublicId);
    await page.getByLabel("已发布任务版本").selectOption(`${taskPublicId}:1`);
    await page.getByLabel("首选设备").selectOption(devicePublicId);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const localTomorrow = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await page.getByLabel("截止时间").fill(localTomorrow);
    await page.getByRole("button", { name: "创建任务分配" }).click();
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
    await expect(page.getByText(new RegExp(`${assignmentPublicId} · 版本 1 · 已分配`))).toBeVisible();
    await expect(page.getByRole("heading", { name: "必须展示" })).toBeVisible();
    await expect(page.getByText("E2E 标识牌", { exact: true })).toBeVisible();
    await expect(page.getByText("展示 E2E 任务开始状态", { exact: true })).toBeVisible();
    await expect(page.getByText(/1440p · 30 FPS/)).toBeVisible();
    await expect(page.getByText("目标规格：", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "上传与恢复" })).toBeVisible();
    await page.getByRole("button", { name: "我已阅读并确认这个版本" }).click();
    await page.getByRole("button", { name: "创建会话并显示标记" }).click();
    await expect(page).toHaveURL(/\/sessions\/RS-/);
    const sessionPublicId = publicId(page.url(), "RS");
    await expect(page.getByRole("img", { name: /签名二维码/ })).toBeVisible();
    await page.getByRole("button", { name: "我已拍摄二维码" }).click();
    await expect(page.getByText(/已确认：/)).toBeVisible();

    await page.goto(`${participantOrigin}/tasks/${assignmentPublicId}`);
    await expect(page.getByRole("heading", { name: "展示二维码" })).toBeVisible();
    await expect(page.getByRole("img", { name: `录制会话 ${sessionPublicId} 的签名二维码` })).toBeVisible();
    const sessionUploadLink = page.getByRole("link", { name: "上传视频" });
    await expect(sessionUploadLink).toHaveAttribute("href", `/uploads?session=${sessionPublicId}`);
    await sessionUploadLink.click();
    await expect(page).toHaveURL(`/uploads?session=${sessionPublicId}`);
    await expect(page.getByLabel("已绑定录制会话")).toContainText(sessionPublicId);

    await page.goto(`${participantOrigin}/sessions/${sessionPublicId}`);
    await page.getByRole("link", { name: "上传文件 →" }).click();
    await expect(page).toHaveURL(`/uploads?session=${sessionPublicId}`);
    await expect(page.getByLabel("已绑定录制会话")).toContainText(sessionPublicId);

    await page.goto(`${participantOrigin}/uploads`);
    await page.locator('input[type="file"]').setInputFiles({ name: `e2e-${suffix}.mp4`, mimeType: "video/mp4", buffer: tinyMp4 });
    const uploadCard = page.getByRole("article").filter({ hasText: `e2e-${suffix}.mp4` });
    await uploadCard.getByLabel("录制会话").selectOption("unable");
    const metadataResponse = page.waitForResponse((response) => response.url().includes("/extract-metadata") && response.request().method() === "POST");
    await uploadCard.getByRole("button", { name: "开始直传存储" }).click();
    await expect(uploadCard.getByText("已验证", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect((await metadataResponse).status()).toBeLessThan(500);
    const detailsLink = uploadCard.getByRole("link", { name: "查看服务端状态" });
    uploadPublicId = publicId((await detailsLink.getAttribute("href")) || "", "UP");
    await detailsLink.click();
    await expect(page.getByText("尚未匹配", { exact: true })).toBeVisible();

    await logout(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginAdmin(page, env.demoAdminPassword);
    await page.goto(`${adminOrigin}/uploads/${uploadPublicId}`);
    await expect(page.getByText("无法确定", { exact: true })).toBeVisible();
    const unmatchedReview = page.getByRole("link").filter({ hasText: "尚未匹配" }).first();
    const reviewPublicId = publicId((await unmatchedReview.textContent()) || "", "RV");
    await unmatchedReview.click();
    await page.getByLabel("录制会话", { exact: true }).selectOption(sessionPublicId);
    await page.getByLabel("设备", { exact: true }).selectOption(devicePublicId);
    await expect(page.getByLabel("变更预览")).toContainText(`变更前 未匹配 / —`);
    await expect(page.getByLabel("变更预览")).toContainText(`变更后 ${sessionPublicId} / ${devicePublicId}`);
    const correctionReason = `Playwright ${suffix} verified and corrected the synthetic participant upload.`;
    await page.getByLabel("原因", { exact: true }).fill(correctionReason);
    await page.getByRole("button", { name: "提交不可变决定" }).click();
    await expect(page.getByText("管理员已纠正", { exact: true })).toBeVisible();
    await expect(page.getByRole("article").filter({ hasText: "未匹配" }).filter({ hasText: "历史" })).toBeVisible();

    await page.goto(`${adminOrigin}/records?tab=activity&pageSize=50&search=${reviewPublicId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const audit = page.getByRole("row")
      .filter({ hasText: "review_case.correct_match" })
      .filter({ hasText: reviewPublicId })
      .first();
    await expect(audit).toContainText(correctionReason, { timeout: 60_000 });
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
