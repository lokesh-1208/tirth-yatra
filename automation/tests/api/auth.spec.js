const { test, expect } = require("@playwright/test");
const { registerViaApi, bearer } = require("../../utils/api");
const { uniqueEmail, PASSWORD } = require("../../utils/data");

test.describe("Auth API", () => {
  test("health endpoint is up", async ({ request }) => {
    const res = await request.get("/health");
    expect(res.ok()).toBeTruthy();
    expect(await res.json()).toEqual({ status: "ok" });
  });

  test("register returns token and user", async ({ request }) => {
    const email = uniqueEmail();
    const res = await request.post("/auth/register", { data: { name: "Lokesh", email, password: PASSWORD } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.access_token).toBeTruthy();
    expect(body.user.email).toBe(email.toLowerCase());
    expect(body.user).not.toHaveProperty("hashed_password");
  });

  test("duplicate email is rejected with 409", async ({ request }) => {
    const { email } = await registerViaApi(request);
    const res = await request.post("/auth/register", { data: { name: "Dup", email, password: PASSWORD } });
    expect(res.status()).toBe(409);
  });

  test("login works with correct password, fails with wrong one", async ({ request }) => {
    const { email, password } = await registerViaApi(request);
    const ok = await request.post("/auth/login", { data: { email, password } });
    expect(ok.status()).toBe(200);
    const bad = await request.post("/auth/login", { data: { email, password: "wrong-password" } });
    expect(bad.status()).toBe(401);
  });

  test("validation: short password and bad email give 422", async ({ request }) => {
    const short = await request.post("/auth/register", {
      data: { name: "A", email: uniqueEmail(), password: "123" },
    });
    expect(short.status()).toBe(422);
    const badEmail = await request.post("/auth/register", {
      data: { name: "A", email: "not-an-email", password: PASSWORD },
    });
    expect(badEmail.status()).toBe(422);
  });

  test("/auth/me needs a valid token", async ({ request }) => {
    expect((await request.get("/auth/me")).status()).toBe(401);
    expect((await request.get("/auth/me", { headers: bearer("garbage") })).status()).toBe(401);
    const { token, email } = await registerViaApi(request);
    const me = await request.get("/auth/me", { headers: bearer(token) });
    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(email.toLowerCase());
  });

  test("profile update persists faith and sect", async ({ request }) => {
    const { token } = await registerViaApi(request);
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
