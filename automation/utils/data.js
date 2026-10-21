const crypto = require("crypto");

/** Unique email per test so tests never collide, even in parallel or on reruns. */
const uniqueEmail = (prefix = "qa") => `${prefix}+${Date.now()}-${crypto.randomBytes(3).toString("hex")}@example.com`;

const PASSWORD = "Secret123!";

module.exports = { uniqueEmail, PASSWORD };
