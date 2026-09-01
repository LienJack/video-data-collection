import { expect, test } from "@playwright/test";

test("landing page exposes the product boundary", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /让每段录制/ })).toBeVisible();
  await expect(page.getByText("0 byte")).toBeVisible();
});
