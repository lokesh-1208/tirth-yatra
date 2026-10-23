// Unit tests for user management and activity-log helpers. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import { auditLink, auditSentence, deleteConfirmed, displayName, isStaff, timeAgo, userState } from "../src/adminUsers.ts";

const now = new Date("2026-10-23T10:00:00Z");

test("userState: locked beats a login block, which beats active", () => {
  assert.equal(userState({ is_locked: true, login_blocked_until: "2026-10-23T10:30:00" }, now).key, "locked");
  assert.equal(userState({ is_locked: false, login_blocked_until: "2026-10-23T10:30:00" }, now).key, "blocked");
  assert.equal(userState({ is_locked: false, login_blocked_until: "2026-10-23T09:30:00" }, now).key, "active"); // block ran out
  assert.equal(userState({ is_locked: false, login_blocked_until: null }, now).label, "Active");
});

test("timeAgo reads backend UTC times without a zone mark", () => {
  assert.equal(timeAgo(null, now), "Never");
  assert.equal(timeAgo("2026-10-23T09:59:30", now), "Just now");
  assert.equal(timeAgo("2026-10-23T09:48:00", now), "12 min ago");
  assert.equal(timeAgo("2026-10-23T07:00:00Z", now), "3 h ago");
  assert.equal(timeAgo("2026-10-22T08:00:00", now), "Yesterday");
  assert.equal(timeAgo("2026-10-18T10:00:00", now), "5 days ago");
  assert.equal(timeAgo("2026-03-12T10:00:00", now), "12 Mar 2026");
});

test("displayName falls back to email, phone, then id", () => {
  assert.equal(displayName({ id: 3, name: "Asha", email: "a@x.in", phone: null }), "Asha");
  assert.equal(displayName({ id: 3, name: null, email: null, phone: "+919999999999" }), "+919999999999");
  assert.equal(displayName({ id: 3, name: null, email: null, phone: null }), "User #3");
});

test("isStaff", () => {
  assert.equal(isStaff("admin"), true);
  assert.equal(isStaff("curator"), true);
  assert.equal(isStaff("pilgrim"), false);
  assert.equal(isStaff(null), false);
});

const entry = (over) => ({
  id: 1,
  actor_id: 2,
  actor_name: "Test Curator",
  action: "place.status",
  target_type: "place",
  target_id: 9,
  target_label: "Siddhodaya Siddhakshetra",
  details: { old: "draft", new: "live" },
  created_at: "2026-10-23T09:00:00",
  ...over,
});

test("auditSentence reads like a sentence", () => {
  assert.equal(auditSentence(entry()), "Test Curator changed the status of Siddhodaya Siddhakshetra (draft → live)");
  assert.equal(
    auditSentence(entry({ action: "place.update", details: { fields: ["darshan_timings", "landmarks"] } })),
    "Test Curator edited Siddhodaya Siddhakshetra (fields: darshan timings, landmarks)"
  );
  assert.equal(
    auditSentence(entry({ action: "user.lock", target_type: "user", target_label: "Ravi", details: { reason: "Spam" } })),
    "Test Curator locked Ravi (Spam)"
  );
  assert.equal(auditSentence(entry({ actor_name: null, action: "x.unknown", details: null, target_label: null })), "Someone x.unknown place #9");
});

test("auditLink points to the right admin screen", () => {
  assert.equal(auditLink(entry()), "/admin/place/9");
  assert.equal(auditLink(entry({ target_type: "user", action: "user.lock" })), "/admin/user/9");
  assert.equal(auditLink(entry({ target_type: "user", action: "user.delete" })), null); // account is gone
  assert.equal(auditLink(entry({ target_type: "lead" })), "/admin/leads");
  assert.equal(auditLink(entry({ target_type: "report" })), "/admin/reviews");
  assert.equal(auditLink(entry({ target_id: null })), null);
});

test("deleteConfirmed needs the word DELETE", () => {
  assert.equal(deleteConfirmed(" delete "), true);
  assert.equal(deleteConfirmed("DELETE"), true);
  assert.equal(deleteConfirmed("yes"), false);
  assert.equal(deleteConfirmed(""), false);
});
