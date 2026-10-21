const { uniqueEmail, TEST_OTP } = require("./data");

const API_URL = (process.env.API_URL || "http://localhost:8000").replace(/\/$/, "");

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

/** Log in via the OTP API (creating the account on first use) and return token + user. */
async function loginViaApi(request, { email = uniqueEmail("api"), name = "QA User", ...profile } = {}) {
  const req = await request.post(`${API_URL}/auth/otp/request`, { data: { identifier: email } });
  if (req.status() !== 200) throw new Error(`otp request failed: ${req.status()} ${await req.text()}`);
  const res = await request.post(`${API_URL}/auth/otp/verify`, { data: { identifier: email, otp: TEST_OTP } });
  if (res.status() !== 200) throw new Error(`otp verify failed: ${res.status()} ${await res.text()}`);
  const body = await res.json();
  let user = body.user;
  if (name) {
    const patch = await request.patch(`${API_URL}/auth/me`, {
      headers: bearer(body.access_token),
      data: { name, ...profile },
    });
    user = await patch.json();
  }
  return { email: email.toLowerCase(), token: body.access_token, user, isNew: body.is_new_user };
}

module.exports = { loginViaApi, bearer };
