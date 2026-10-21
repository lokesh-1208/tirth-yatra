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
    const first = page.getByTestId("route-list").locator('[data-testid^="place-card-"]').first();
    await expect(first).toBeVisible();
    await expect(first).toContainText("km detour");
  });

  test("Plan Route shows a map with the route and a pin per place", async ({ page }) => {
    await new AppShell(page).open("plan");
    await page.getByTestId("route-start").fill("Jabalpur");
    await page.getByTestId("route-end").fill("Nemawar");
    await page.getByTestId("detour-50").click();
    await page.getByTestId("route-submit").click();

    await expect(page.getByTestId("route-map")).toBeVisible();
    const map = page.frameLocator('[data-testid="route-map"]');
    await expect(map.locator(".leaflet-container")).toBeVisible();
    await expect(map.locator(".leaflet-overlay-pane path")).toHaveCount(1); // route line
    const cards = await page.getByTestId("route-list").locator('[data-testid^="place-card-"]').count();
    await expect(map.locator(".leaflet-marker-icon")).toHaveCount(cards + 2); // + start and end
  });

  test("location fields suggest places and a suggestion can be picked", async ({ page }) => {
    await new AppShell(page).open("plan");
    await page.getByTestId("route-start").fill("jabal");
    await page.getByTestId("route-start-suggestion-0").click();
    await expect(page.getByTestId("route-start")).toHaveValue(/Jabalpur/);
    await expect(page.getByTestId("route-start-suggestions")).toHaveCount(0);
  });

  test("Plan Route shows an error for an unknown city", async ({ page }) => {
    await new AppShell(page).open("plan");
    await page.getByTestId("route-start").fill("Zzqxwvk");
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
    // Wait for the save request to finish, otherwise Saved may load before the server has it.
    const saved = page.waitForResponse((r) => r.url().includes("/save") && r.request().method() === "POST");
    await page.locator('[data-testid^="save-btn-"]').first().click();
    await saved;

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
