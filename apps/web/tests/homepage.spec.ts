import { expect, test } from "@playwright/test";

test("homepage is usable with a healthy API", async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Start a new run" })).toBeVisible();
  await expect(page.getByText("API online", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start run" })).toBeEnabled();

  const screenshotPath = testInfo.outputPath("homepage.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("homepage", { path: screenshotPath, contentType: "image/png" });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
