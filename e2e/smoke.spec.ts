import { expect, test } from "@playwright/test";

test.describe("Poscal smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("hasSeenOnboarding", "true");
    });
  });

  test("calculator shell loads for returning users", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Buy" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Sell" })).toBeVisible();
  });

  test("sign-in page renders auth form", async ({ page }) => {
    await page.goto("/signin");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/email/i).or(page.locator('input[type="email"]')).first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("unauthenticated journal redirects to sign-in", async ({ page }) => {
    await page.goto("/journal");
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("unauthenticated signals redirects to sign-in", async ({ page }) => {
    await page.goto("/signals");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("upgrade path sends guests to sign-in with next", async ({ page }) => {
    await page.goto("/upgrade?tier=premium&redirectPath=%2Fjournal");
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.url()).toMatch(/next=/);
  });

  test("welcome onboarding is reachable for first-time users", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("hasSeenOnboarding");
    });
    await page.goto("/");
    await expect(page).toHaveURL(/\/welcome/);
  });
});
