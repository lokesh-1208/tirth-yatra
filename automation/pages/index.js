const { expect } = require("@playwright/test");
const { TEST_OTP } = require("../utils/data");

class LoginPage {
  constructor(page) {
    this.page = page;
    this.identifier = page.getByTestId("login-identifier");
    this.sendOtp = page.getByTestId("login-send-otp");
    this.otp = page.getByTestId("login-otp");
    this.verify = page.getByTestId("login-verify");
    this.sentTo = page.getByTestId("login-sent-to");
    this.error = page.getByTestId("login-error");
    this.change = page.getByTestId("login-change");
    this.resend = page.getByTestId("login-resend");
  }

  async goto() {
    await this.page.goto("/");
    await expect(this.sendOtp).toBeVisible();
  }

  async requestOtp(identifier) {
    await this.identifier.fill(identifier);
    await this.sendOtp.click();
  }

  async login(identifier, otp = TEST_OTP) {
    await this.requestOtp(identifier);
    await expect(this.otp).toBeVisible();
    await this.otp.fill(otp);
    await this.verify.click();
  }
}

/** Shown once after the first OTP login of a brand-new account. */
class OnboardingPage {
  constructor(page) {
    this.page = page;
    this.name = page.getByTestId("onboarding-name");
    this.submit = page.getByTestId("onboarding-submit");
    this.error = page.getByTestId("onboarding-error");
  }

  async complete({ name, sect }) {
    await this.name.fill(name);
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
      yatras: page.getByTestId("tab-yatras"),
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

module.exports = { LoginPage, OnboardingPage, AppShell };
