const crypto = require("crypto");

/** Fixed OTP accepted by the backend for the dummy user and any @qa.tirthyatra.app email (dev/test only). */
const TEST_OTP = "999999";
const TEST_USER_EMAIL = "test@tirthyatra.app";
const QA_DOMAIN = "qa.tirthyatra.app";

/** Unique QA email per test so tests never collide, even in parallel or on reruns. */
const uniqueEmail = (prefix = "qa") => `${prefix}+${Date.now()}-${crypto.randomBytes(3).toString("hex")}@${QA_DOMAIN}`;

module.exports = { TEST_OTP, TEST_USER_EMAIL, QA_DOMAIN, uniqueEmail };
