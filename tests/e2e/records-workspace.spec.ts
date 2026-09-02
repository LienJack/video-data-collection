import { expect, test } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";

const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";

async function loginAdmin(page: import("@playwright/test").Page) {
  const env = integrationEnvironment();
  await page.goto(`${adminOrigin}/login`);
  await page.getByLabel("Admin Account").fill(env.demoAdminUsername);
  await page.getByLabel("Password").fill(env.demoAdminPassword);
  await page.getByRole("button", { name: "进入管理控制台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeEach(async ({ page }) => {
  await loginAdmin(page);
});

test("统一入口展示视频记录、准确异常入口和一跳处理", async ({ page }) => {
  await page.getByRole("link", { name: "采集记录", exact: true }).first().click();
  await expect(page).toHaveURL(/\/records$/);
  await expect(page.getByRole("heading", { name: "采集记录", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "视频记录", level: 2 })).toBeVisible();

  const uploadFailure = page.getByRole("link", { name: /上传失败/ });
  await expect(uploadFailure).toHaveAttribute("href", "/review?caseType=upload_failed");
  const missing = page.getByRole("link", { name: /缺少上传/ });
  await expect(missing).toHaveAttribute("href", "/participants?missing=yes");

  const failedUpload = page.getByRole("row").filter({ hasText: "demo-upload-failed.mp4" });
  await expect(failedUpload).toContainText("Participant Demo");
  const reviewLink = failedUpload.getByRole("link", { name: "处理异常" });
  await expect(reviewLink).toHaveAttribute("href", /\/review\/RV-/);
  await reviewLink.focus();
  await expect(reviewLink).toBeFocused();
  await reviewLink.press("Enter");
  await expect(page).toHaveURL(/\/review\/RV-/);
  await page.goBack();

  const search = page.getByRole("textbox", { name: "搜索视频记录" });
  await search.fill("不存在的视频记录");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "当前筛选没有视频记录" })).toBeVisible();
  const clearFilters = page.getByRole("link", { name: "清除筛选" }).last();
  await clearFilters.focus();
  await expect(clearFilters).toBeFocused();
  await clearFilters.press("Enter");
  await expect(page).toHaveURL(/\/records\?tab=videos$/);

  await page.goto(`${adminOrigin}/records?tab=unknown&page=not-a-page&transferStatus=unknown`);
  await expect(page.getByRole("heading", { name: "视频记录", level: 2 })).toBeVisible();
  await expect(page.getByLabel("传输状态")).toHaveValue("");
  await expect(page.getByRole("navigation", { name: "表格分页" })).toContainText("第 1 /");
});

test("会话页默认开放、可查历史并保留关闭原因校验", async ({ page }) => {
  await page.goto(`${adminOrigin}/records?tab=sessions`);
  await expect(page.getByRole("heading", { name: "录制会话", level: 2 })).toBeVisible();
  await expect(page.getByLabel("会话状态")).toHaveValue("open");
  const session = page.getByRole("row").filter({ hasText: "RS-23456789" });
  await expect(session).toContainText("匹配视频");
  await expect(session.getByRole("link", { name: "查看相关视频" })).toHaveAttribute("href", "/records?tab=videos&search=RS-23456789");

  const closeSession = session.getByRole("button", { name: "关闭 Session" });
  await closeSession.focus();
  await expect(closeSession).toBeFocused();
  await closeSession.press("Enter");
  await session.getByPlaceholder("关闭原因，至少 10 字符").fill("太短");
  await session.getByRole("button", { name: "确认关闭" }).click();
  await expect(session.getByText("关闭原因至少 10 个字符")).toBeVisible();

  await page.getByLabel("会话状态").selectOption("closed");
  await page.getByRole("textbox", { name: "搜索录制会话" }).fill("不存在的已关闭会话");
  await page.getByRole("button", { name: "筛选" }).click();
  await expect(page).toHaveURL(/tab=sessions.*search=.*status=closed/);
  await expect(page.getByRole("heading", { name: "当前筛选没有录制会话" })).toBeVisible();
});

test("操作记录提供中文摘要、分类筛选和完整证据", async ({ page }) => {
  await page.goto(`${adminOrigin}/records?tab=activity`);
  await expect(page.getByRole("heading", { name: "操作记录", level: 2 })).toBeVisible();
  const firstEvent = page.getByRole("row").filter({ hasText: "已记录" }).first();
  await expect(firstEvent).toBeVisible();
  await firstEvent.getByText("查看变更详情").click();
  await expect(firstEvent.getByText(/原始动作：/)).toBeVisible();
  await expect(firstEvent.getByText(/Request ID：/)).toBeVisible();

  await page.getByLabel("动作分类").selectOption("session");
  await page.getByRole("button", { name: "筛选" }).click();
  await expect(page).toHaveURL(/tab=activity.*category=session/);
  await expect(page.getByText("关闭录制会话").or(page.getByText("创建录制会话")).first()).toBeVisible();
});

test("旧列表地址临时跳转且上传详情保持原路由", async ({ page }) => {
  await page.goto(`${adminOrigin}/uploads?search=demo-upload-failed.mp4&transferStatus=failed`);
  await expect(page).toHaveURL(/\/records\?tab=videos&search=demo-upload-failed\.mp4&transferStatus=failed/);
  await page.goto(`${adminOrigin}/sessions?status=all&search=RS-23456789`);
  await expect(page).toHaveURL(/\/records\?tab=sessions&search=RS-23456789&status=all/);
  await page.goto(`${adminOrigin}/sessions?status=open`);
  await expect(page).toHaveURL(/\/records\?tab=sessions&status=open/);
  await page.goto(`${adminOrigin}/audit?category=session`);
  await expect(page).toHaveURL(/\/records\?tab=activity&category=session/);

  await page.goto(`${adminOrigin}/uploads/UP-23456782`);
  await expect(page).toHaveURL(/\/uploads\/UP-23456782$/);
  await expect(page.getByRole("link", { name: "采集记录", exact: true }).first()).toHaveAttribute("aria-current", "page");
});

test("窄屏与键盘路径不会产生页面级横向滚动", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto(`${adminOrigin}/records`);
  const bodyWidth = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(bodyWidth.scroll).toBeLessThanOrEqual(bodyWidth.client);

  const sessionsTab = page.getByRole("navigation", { name: "采集记录视图" }).getByRole("link", { name: "录制会话" });
  await sessionsTab.focus();
  await expect(sessionsTab).toBeFocused();
  await sessionsTab.press("Enter");
  await expect(page).toHaveURL(/tab=sessions/);
  await expect(page.getByRole("link", { name: "采集记录", exact: true }).last()).toBeVisible();
});
