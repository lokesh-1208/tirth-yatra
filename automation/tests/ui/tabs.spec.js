const { test, expect } = require("@playwright/test");
const { LoginPage, AppShell } = require("../../pages");
const { uniqueEmail } = require("../../utils/data");
const { loginViaApi } = require("../../utils/api");

test.describe("Tabs (web UI)", () => {
  test.beforeEach(async ({ page, request }) => {
    // Fresh, already-onboarded user per test so saved places never leak between tests.
    const { email } = await loginViaApi(request, { email: uniqueEmail("ui"), name: "Tab Tester" });
    const login = new LoginPage(page);
    await login.goto();
    await login.login(email);
    await new AppShell(page).expectLoggedIn();
  });

  test("Explore lists places and search filters them", async ({ page }) => {
    const cards = page.locator('[data-testid^="place-card-"]');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    expect(total).toBeGreaterThan(1);

    await page.getByTestId("explore-search").fill("bhopal");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Bhopal");

    await page.getByTestId("explore-search").fill("zzzz-no-match");
    await expect(page.getByText("No places found")).toBeVisible();
  });

  test("Plan Route finds places between two cities", async ({ page }) => {
    await new AppShell(page).open("plan");
    await page.getByTestId("route-start").fill("Jabalpur");
    await page.getByTestId("route-end").fill("Nemawar");
    await page.getByTestId("detour-50").click();
    await page.getByTestId("route-submit").click();

    await expect(page.getByTestId("route-summary")).toContainText("Jabalpur → Nemawar");
    await expect(page.locator('[data-testid^="place-card-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="place-card-"]').first()).toContainText("km detour");
  });

  test("Plan Route shows an error for an unknown city", async ({ page }) => {
    await new AppShell(page).open("plan");
    await page.getByTestId("route-start").fill("Atlantis");
    await page.getByTestId("route-end").fill("Nemawar");
    await page.getByTestId("route-submit").click();
    await expect(page.getByTestId("route-error")).toContainText("Unknown start location");
  });

  test("saving a place makes it appear in Saved, and removing it empties the list", async ({ page }) => {
    const shell = new AppShell(page);
    await shell.open("saved");
    await expect(page.getByText("Nothing saved yet")).toBeVisible();

    await shell.open("explore");
    const firstCard = page.locator('[data-testid^="place-card-"]').first();
    await expect(firstCard).toBeVisible();
    const placeName = (await firstCard.locator("text=/./").first().innerText()).trim();
    await page.locator('[data-testid^="save-btn-"]').first().click();

    await shell.open("saved");
    const savedCards = page.getByTestId("saved-list").locator('[data-testid^="place-card-"]');
    await expect(savedCards).toHaveCount(1);
    await expect(savedCards.first()).toContainText(placeName);

    await page.getByTestId("saved-list").locator('[data-testid^="save-btn-"]').first().click();
    await expect(page.getByText("Nothing saved yet")).toBeVisible();
  });

  test("place detail shows the unverified warning for seed data", async ({ page }) => {
    await page.locator('[data-testid^="place-card-"]').first().click();
    await expect(page.getByTestId("detail-name")).toBeVisible();
    await expect(page.getByTestId("detail-unverified")).toBeVisible();
  });

  test("profile preferences can be saved", async ({ page }) => {
    const shell = new AppShell(page);
    await shell.open("profile");
    await page.getByTestId("profile-faith-jain").click();
    await page.getByTestId("profile-sect-shvetambar").click();
    await page.getByTestId("profile-save").click();
    await expect(page.getByTestId("profile-msg")).toHaveText("Preferences saved");
  });
});
