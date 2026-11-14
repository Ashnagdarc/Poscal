import { expect, test } from "@playwright/test";

test("calculator works with account backend unavailable and an existing session", async ({ page }) => {
  const errors: string[] = [];
  const accountRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/convex|\/api\/(auth|journal|subscription)/i.test(request.url())) {
      accountRequests.push(request.url());
    }
  });
  await page.route(/convex|\/api\//i, (route) => route.abort());
  await page.addInitScript(() => {
    localStorage.setItem("__convexAuthJWT_https://convex.poscalfx.com", "existing-session");
    localStorage.setItem("hasSeenOnboarding", "true");
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Poscal is under maintenance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Journaling temporarily unavailable" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Account balance/ }).click();
  for (const digit of "10000") await page.getByRole("button", { name: digit, exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("button", { name: /Account balance/ })).toContainText("10,000");
  await page.getByRole("button", { name: /Stop loss/i }).click();
  await page.getByRole("spinbutton", { name: "Stop loss in pips" }).fill("20");
  await page.getByRole("button", { name: "Set 20 pips", exact: true }).click();
  await expect(page.getByText("0.50", { exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(accountRequests).toEqual([]);
});

for (const path of ["/signin", "/signup", "/forgot-password", "/verify-email", "/journal", "/journal/trade/saved-trade", "/journal/day/2026-11-14", "/calculator/history", "/profile", "/admin/users", "/pro"]) {
  test(`maintenance blocks direct account route ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Account access is paused." })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.getByRole("link", { name: "Use the calculator" }).click();
    await expect(page.getByRole("button", { name: "Journaling temporarily unavailable" })).toBeDisabled();
  });
}
