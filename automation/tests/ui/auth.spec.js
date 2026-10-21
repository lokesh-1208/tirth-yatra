const { test, expect } = require("@playwright/test");
const { LoginPage, RegisterPage, AppShell } = require("../../pages");
const { uniqueEmail, PASSWORD } = require("../../utils/data");

test.describe("Login & registration (web UI)", () => {
  test("unauthenticated visitor is sent to the login screen", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await expect(login.email).toBeVisible();
  });

  test("empty login shows a validation message", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.submit.click();
    await expect(login.error).toContainText("enter your email and password");
  });

  test("wrong credentials show an error and stay on login", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(uniqueEmail("nobody"), "wrong-password");
    await expect(login.error).toContainText("Incorrect email or password");
    await expect(login.submit).toBeVisible();
  });

  test("register validates password length", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.goRegister.click();
    const reg = new RegisterPage(page);
    await reg.register({ name: "QA", email: uniqueEmail(), password: "123" });
    await expect(reg.error).toContainText("at least 6 characters");
  });

  test("new user can register, lands in the app, logs out and logs back in", async ({ page }) => {
    const email = uniqueEmail("ui");
    const login = new LoginPage(page);
    const shell = new AppShell(page);

    await login.goto();
    await login.goRegister.click();
    await new RegisterPage(page).register({ name: "UI Tester", email, password: PASSWORD, sect: "digambar" });
    await shell.expectLoggedIn();

    await shell.open("profile");
    await expect(page.getByTestId("profile-name")).toHaveText("UI Tester");
    await expect(page.getByTestId("profile-email")).toHaveText(email.toLowerCase());

    await page.getByTestId("logout").click();
    await expect(login.submit).toBeVisible();

    await login.login(email, PASSWORD);
    await shell.expectLoggedIn();
  });

  test("session survives a page reload", async ({ page }) => {
    const login = new LoginPage(page);
    const shell = new AppShell(page);
    await login.goto();
    await login.goRegister.click();
    await new RegisterPage(page).register({ name: "Reload", email: uniqueEmail("ui"), password: PASSWORD });
    await shell.expectLoggedIn();
    await page.reload();
    await shell.expectLoggedIn();
  });
});
