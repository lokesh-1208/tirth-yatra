const { test, expect } = require("@playwright/test");
const { LoginPage, AppShell } = require("../../pages");
const { uniqueEmail } = require("../../utils/data");
const { loginViaApi } = require("../../utils/api");

test.describe("My Yatras and place detail (web UI)", () => {
  test.beforeEach(async ({ page, request }) => {
    const { email } = await loginViaApi(request, { email: uniqueEmail("ui"), name: "Yatra Tester" });
    const login = new LoginPage(page);
    await login.goto();
    await login.login(email);
    await new AppShell(page).expectLoggedIn();
  });

  test("My Yatras starts empty", async ({ page }) => {
    await new AppShell(page).open("yatras");
    await expect(page.getByText("No yatras yet")).toBeVisible();
    await expect(page.getByTestId("yatras-plan")).toBeVisible();
  });

  test("a planned route can be saved as a yatra, stops ticked off, renamed and deleted", async ({ page }) => {
    const shell = new AppShell(page);
    await shell.open("plan");
    await page.getByTestId("route-start").fill("Jabalpur");
    await page.getByTestId("route-end").fill("Nemawar");
    await page.getByTestId("detour-50").click();
    await page.getByTestId("route-submit").click();
    await expect(page.getByTestId("route-summary")).toBeVisible();

    await page.getByTestId("route-save-yatra").click();
    await expect(page.getByTestId("yatra-name")).toHaveText("Jabalpur to Nemawar");
    const stops = page.locator('[data-testid^="yatra-stop-"]');
    expect(await stops.count()).toBeGreaterThan(0);
    await stops.first().click();
    await expect(page.getByText("1 visited")).toBeVisible();

    await page.getByTestId("yatra-rename").click();
    await page.getByTestId("yatra-rename-input").fill("Summer yatra");
    await page.getByTestId("yatra-rename-save").click();
    await expect(page.getByTestId("yatra-name")).toHaveText("Summer yatra");

    await page.goBack();
    await shell.open("yatras");
    const cards = page.locator('[data-testid^="yatra-card-"]');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Summer yatra");
    await expect(cards.first()).toContainText("1 of");

    await cards.first().click();
    await page.getByTestId("yatra-delete").click();
    await page.getByTestId("yatra-delete-confirm").click();
    await shell.open("yatras");
    await expect(page.getByText("No yatras yet")).toBeVisible();
  });

  test("Explore can be filtered by place type", async ({ page }) => {
    const cards = page.locator('[data-testid^="place-card-"]');
    await expect(cards.first()).toBeVisible();
    const total = await cards.count();
    await page.getByTestId("kind-tirth").click();
    await expect.poll(() => cards.count()).toBeLessThan(total);
    for (const card of await cards.all()) await expect(card).toContainText("Tirth");
    await page.getByTestId("kind-all").click();
    await expect(cards).toHaveCount(total);
  });

  test("place detail tabs show placeholders until data is added", async ({ page }) => {
    await page.locator('[data-testid^="place-card-"]').first().click();
    await expect(page.getByTestId("detail-name")).toBeVisible();
    for (const tab of ["darshan", "stay", "food"]) {
      await page.getByTestId(`detail-tab-${tab}`).click();
      await expect(page.getByText("Not added yet").first()).toBeVisible();
    }
    await expect(page.getByTestId("detail-call")).toBeDisabled();
  });
});
