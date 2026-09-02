import { defineConfig, devices } from "@playwright/test";

const participantOrigin = process.env.PARTICIPANT_SITE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: participantOrigin,
    locale: "zh-CN",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    url: participantOrigin,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-smoke", use: { ...devices["Desktop Safari"] }, testMatch: /smoke\.spec\.ts/ },
  ],
});
