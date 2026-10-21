const { test, expect } = require("@playwright/test");
const { LoginPage, OnboardingPage, AppShell } = require("../../pages");
const { uniqueEmail, TEST_USER_EMAIL } = require("../../utils/data");

test.describe("OTP login (web UI)", () => {
  test("unauthenticated visitor is sent to the login screen", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.identifier).toBeVisible();
  });

  test("empty identifier shows a validation message", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.sendOtp.click();
    await expect(login.error).toContainText("Enter your email or mobile number");
  });

  test("invalid identifier is rejected by the server", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.requestOtp("not-an-id");
    await expect(login.error).toContainText("valid");
  });

  test("wrong OTP shows an error and stays on the OTP step", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(TEST_USER_EMAIL, "123456");
    await expect(login.error).toContainText("Invalid or expired OTP");
    await expect(login.verify).toBeVisible();
  });

  test("dummy user logs in with email, logs out, and logs in again with phone", async ({ page }) => {
    const login = new LoginPage(page);
    const shell = new AppShell(page);
    await login.goto();
    await login.login(TEST_USER_EMAIL);
    await shell.expectLoggedIn();

    await shell.open("profile");
    await expect(page.getByTestId("profile-name")).toHaveText("Test Yatri");

    await page.getByTestId("logout").click();
    await expect(login.sendOtp).toBeVisible();

    await login.login("9999999999");
    await shell.expectLoggedIn();
  });

  test("Change goes back to the identifier step", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.requestOtp(TEST_USER_EMAIL);
    await expect(login.sentTo).toContainText(TEST_USER_EMAIL);
    await login.change.click();
    await expect(login.sendOtp).toBeVisible();
  });

  test("new user completes onboarding and lands in the app", async ({ page }) => {
    const email = uniqueEmail("ui");
    const login = new LoginPage(page);
    await login.goto();
    await login.login(email);

    const onboarding = new OnboardingPage(page);
    await onboarding.submit.click();
    await expect(onboarding.error).toContainText("enter your name");
    await onboarding.complete({ name: "UI Tester", sect: "digambar" });

    const shell = new AppShell(page);
    await shell.expectLoggedIn();
    await shell.open("profile");
    await expect(page.getByTestId("profile-name")).toHaveText("UI Tester");
    await expect(page.getByTestId("profile-email")).toHaveText(email.toLowerCase());
  });

  test("session survives a page reload", async ({ page }) => {
    const login = new LoginPage(page);
    const shell = new AppShell(page);
    await login.goto();
    await login.login(TEST_USER_EMAIL);
    await shell.expectLoggedIn();
    await page.reload();
    await shell.expectLoggedIn();
  });
});
