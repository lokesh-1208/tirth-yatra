const { test, expect } = require("@playwright/test");
const { loginViaApi, bearer } = require("../../utils/api");
const { uniqueEmail, TEST_OTP, TEST_USER_EMAIL } = require("../../utils/data");

const verify = (request, identifier, otp) => request.post("/auth/otp/verify", { data: { identifier, otp } });

test.describe("Auth API (OTP)", () => {
  test("health endpoint is up", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("dummy user logs in with the fixed OTP via email and via phone", async ({ request }) => {
    for (const identifier of [TEST_USER_EMAIL, "9999999999"]) {
      const sent = await request.post("/auth/otp/request", { data: { identifier } });
      expect(sent.status()).toBe(200);
      const res = await verify(request, identifier, TEST_OTP);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.access_token).toBeTruthy();
      expect(body.user.email).toBe(TEST_USER_EMAIL);
      expect(body.is_new_user).toBe(false);
    }
  });

  test("wrong OTP is rejected", async ({ request }) => {
    await request.post("/auth/otp/request", { data: { identifier: TEST_USER_EMAIL } });
    expect((await verify(request, TEST_USER_EMAIL, "123456")).status()).toBe(401);
  });

  test("first OTP login creates a new account", async ({ request }) => {
    const email = uniqueEmail();
    await request.post("/auth/otp/request", { data: { identifier: email } });
    const body = await (await verify(request, email, TEST_OTP)).json();
    expect(body.is_new_user).toBe(true);
    expect(body.user.email).toBe(email.toLowerCase());
    expect(body.user.name).toBeNull();
  });

  test("invalid identifier gives 422", async ({ request }) => {
    expect((await request.post("/auth/otp/request", { data: { identifier: "not-an-id" } })).status()).toBe(422);
  });

  test("/auth/me needs a valid token", async ({ request }) => {
    expect((await request.get("/auth/me")).status()).toBe(401);
    expect((await request.get("/auth/me", { headers: bearer("garbage") })).status()).toBe(401);
    const { token, email } = await loginViaApi(request);
    const me = await request.get("/auth/me", { headers: bearer(token) });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(email);
  });

  test("profile update persists faith and sect", async ({ request }) => {
    const { token } = await loginViaApi(request);
    const res = await request.patch("/auth/me", {
      headers: bearer(token),
      data: { faith: "jain", sect: "digambar" },
    });
    expect(res.status()).toBe(200);
    const me = await (await request.get("/auth/me", { headers: bearer(token) })).json();
    expect(me.faith).toBe("jain");
    expect(me.sect).toBe("digambar");
  });
});
