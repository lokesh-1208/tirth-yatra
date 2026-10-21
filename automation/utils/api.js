const { uniqueEmail, PASSWORD } = require("./data");

/** Register a fresh user through the API and return credentials + token. */
async function registerViaApi(request, overrides = {}) {
  const email = overrides.email || uniqueEmail("api");
  const res = await request.post("/auth/register", {
    data: { name: "QA User", email, password: PASSWORD, ...overrides },
  });
  if (res.status() !== 201) throw new Error(`register failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  return { email, password: PASSWORD, token: body.access_token, user: body.user };
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { registerViaApi, bearer };
