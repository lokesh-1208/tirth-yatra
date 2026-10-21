const { expect } = require("@playwright/test");

class LoginPage {
  constructor(page) {
    this.page = page;
    this.email = page.getByTestId("login-email");
    this.password = page.getByTestId("login-password");
    this.submit = page.getByTestId("login-submit");
    this.error = page.getByTestId("login-error");
    this.goRegister = page.getByTestId("go-register");
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.submit).toBeVisible();
  }

  async login(email, password) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

class RegisterPage {
  constructor(page) {
    this.page = page;
    this.name = page.getByTestId("register-name");
    this.email = page.getByTestId("register-email");
    this.password = page.getByTestId("register-password");
    this.submit = page.getByTestId("register-submit");
    this.error = page.getByTestId("register-error");
  }

  async register({ name, email, password, sect }) {
    await this.name.fill(name);
    await this.email.fill(email);
    await this.password.fill(password);
    if (sect) await this.page.getByTestId(`sect-${sect}`).click();
    await this.submit.click();
  }
}

class AppShell {
  constructor(page) {
    this.page = page;
    this.tabs = {
      explore: page.getByTestId("tab-explore"),
      plan: page.getByTestId("tab-plan"),
      saved: page.getByTestId("tab-saved"),
      profile: page.getByTestId("tab-profile"),
    };
  }

  async expectLoggedIn() {
    await expect(this.tabs.explore).toBeVisible();
  }

  async open(tab) {
    await this.tabs[tab].click();
  }
}

module.exports = { LoginPage, RegisterPage, AppShell };
