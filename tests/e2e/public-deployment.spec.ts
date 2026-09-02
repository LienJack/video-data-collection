import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import { integrationEnvironment } from "@/scripts/check-support";
import { DEMO_CATALOG } from "@/scripts/fixtures/demo-catalog";

const participantOrigin = process.env.PARTICIPANT_SITE_URL || "http://localhost:3000";
const adminOrigin = process.env.ADMIN_SITE_URL || "http://localhost:3001";
const publicAcceptance = process.env.PUBLIC_ACCEPTANCE === "1";

type LoginFixture = {
  locale: "zh-CN" | "en" | "ja";
  browserLocale: string;
  participantPublicId: string;
};

const loginFixtures: readonly LoginFixture[] = [
  { locale: "zh-CN", browserLocale: "zh-CN", participantPublicId: DEMO_CATALOG.people.find((person) => person.key === "cn-lin-xiaoyu")!.publicId },
  { locale: "en", browserLocale: "en-US", participantPublicId: DEMO_CATALOG.people.find((person) => person.key === "us-emily-carter")!.publicId },
  { locale: "ja", browserLocale: "ja-JP", participantPublicId: DEMO_CATALOG.people.find((person) => person.key === "jp-sato-misaki")!.publicId },
];

async function logout(context: BrowserContext, origin: string) {
  const response = await context.request.post(`${origin}/api/auth/logout`, {
    headers: { origin },
  });
  expect(response.ok()).toBe(true);
}

async function verifyParticipantLogin(browser: Browser, fixture: LoginFixture, password: string) {
  const context = await browser.newContext({ locale: fixture.browserLocale });
  const page = await context.newPage();
  try {
    await page.goto(`${participantOrigin}/login`);
    await expect(page.locator("html")).toHaveAttribute("lang", fixture.locale);
    await page.locator('input[name="identity"]').fill(fixture.participantPublicId);
    await page.locator('input[name="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(`${participantOrigin}/tasks`);
    await expect(page.locator("html")).toHaveAttribute("lang", fixture.locale);

    const authCookies = (await context.cookies(participantOrigin))
      .filter((cookie) => cookie.name.startsWith("egocapture-participant-auth"));
    expect(authCookies.length).toBeGreaterThan(0);
    expect(authCookies.every((cookie) => cookie.secure && cookie.httpOnly)).toBe(true);
    expect((await context.cookies(adminOrigin)).some((cookie) => cookie.name.startsWith("egocapture-participant-auth"))).toBe(false);
    await logout(context, participantOrigin);
  } finally {
    await context.close();
  }
}

test.describe("public deployment acceptance", () => {
  test.skip(!publicAcceptance, "Set PUBLIC_ACCEPTANCE=1 to run against the reviewed public deployment.");

  test("both applications are healthy and route-isolated", async ({ request }) => {
    for (const origin of [participantOrigin, adminOrigin]) {
      const response = await request.get(`${origin}/api/health`);
      expect(response.ok()).toBe(true);
      await expect(response.json()).resolves.toMatchObject({
        data: { status: "ok", database: true, migrationCount: 24 },
      });
    }

    expect((await request.get(`${participantOrigin}/api/admin/audit-events`)).status()).toBe(404);
    expect((await request.get(`${adminOrigin}/api/participant/assignments`)).status()).toBe(404);
  });

  test("Chinese, US-English, and Japanese demo identities log in with isolated secure cookies", async ({ browser }) => {
    const env = integrationEnvironment();
    for (const fixture of loginFixtures) {
      await verifyParticipantLogin(browser, fixture, env.demoParticipantPassword);
    }
  });

  test("admin login uses the separate production cookie and locale persists", async ({ browser }) => {
    const env = integrationEnvironment();
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    try {
      await page.goto(`${adminOrigin}/login?source=public-acceptance`);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await page.locator("#ui-locale").selectOption("ja");
      await expect(page.locator("html")).toHaveAttribute("lang", "ja");
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", "ja");

      await page.locator('input[name="identity"]').fill(env.demoAdminUsername);
      await page.locator('input[name="password"]').fill(env.demoAdminPassword);
      await page.locator('button[type="submit"]').click();
      await expect(page).toHaveURL(`${adminOrigin}/dashboard`);

      const authCookies = (await context.cookies(adminOrigin))
        .filter((cookie) => cookie.name.startsWith("egocapture-admin-auth"));
      expect(authCookies.length).toBeGreaterThan(0);
      expect(authCookies.every((cookie) => cookie.secure && cookie.httpOnly)).toBe(true);
      expect((await context.cookies(participantOrigin)).some((cookie) => cookie.name.startsWith("egocapture-admin-auth"))).toBe(false);
    } finally {
      await context.close();
    }
  });
});
