// Unit tests for the admin section helpers. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  changedFields,
  emptyForm,
  formatCoord,
  formatDate,
  formFromPlace,
  formToInput,
  languageLabel,
  parseLatLngPair,
  publishBlocker,
  recheckLabel,
  todayIso,
  translationForm,
  validateForm,
} from "../src/admin.ts";
import { buildPinMapHtml, parsePinMessage } from "../src/pinMapHtml.ts";

const savedPlace = {
  id: 7,
  name: "Siddhodaya Siddhakshetra",
  faith: "jain",
  sect: "digambar",
  kind: "siddha_kshetra",
  deity: null,
  description: "About text",
  city: "Nemawar",
  district: null,
  state: "Madhya Pradesh",
  address: null,
  pincode: null,
  latitude: 22.435,
  longitude: 76.865,
  how_to_reach: null,
  darshan_timings: null,
  stay_info: null,
  food_info: null,
  landmarks: null,
  status: "draft",
  verified: false,
  verified_on: null,
  recheck_due: null,
  cover_url: null,
  verified_by: null,
  verified_method: null,
  updated_at: null,
  default_language: "en",
  translations: [{ language: "hi", name: "सिद्धोदय", description: null, how_to_reach: null, darshan_timings: null, stay_info: null, food_info: null, landmarks: "घाट" }],
  contacts: [],
  photos: [],
  checks: [],
};

test("validateForm catches what the backend would refuse", () => {
  const errs = validateForm(emptyForm({ name: "X", latitude: "95", longitude: "abc", pincode: "12" }));
  assert.deepEqual(Object.keys(errs).sort(), ["latitude", "longitude", "name", "pincode"]);
  assert.deepEqual(validateForm(emptyForm({ name: "Mandir", latitude: "22.4", longitude: "76.8", pincode: "455339" })), {});
  assert.ok(validateForm(emptyForm({ name: "Mandir", latitude: "", longitude: "76" })).latitude);
});

test("formToInput trims text, turns empty into null and numbers into numbers", () => {
  const input = formToInput(emptyForm({ name: "  Mandir ", latitude: "22.40", longitude: "76.8", deity: "  ", sect: "" }));
  assert.equal(input.name, "Mandir");
  assert.equal(input.latitude, 22.4);
  assert.equal(input.deity, null);
  assert.equal(input.sect, null);
});

test("changedFields sends only what was edited", () => {
  const saved = formFromPlace(savedPlace);
  assert.deepEqual(changedFields(saved, saved), {});
  const edited = { ...saved, darshan_timings: "6 am - 8 pm", latitude: "22.43500" };
  assert.deepEqual(changedFields(saved, edited), { darshan_timings: "6 am - 8 pm" }); // 22.43500 == 22.435
  assert.deepEqual(changedFields(saved, { ...saved, description: "" }), { description: null });
});

test("translationForm fills missing fields with empty strings", () => {
  const hi = translationForm(savedPlace, "hi");
  assert.equal(hi.name, "सिद्धोदय");
  assert.equal(hi.landmarks, "घाट");
  assert.equal(hi.description, "");
  assert.equal(translationForm(savedPlace, "mr").name, "");
});

test("publishBlocker needs at least one check", () => {
  assert.match(publishBlocker({ checks: [] }), /at least one check/);
  assert.equal(publishBlocker({ checks: [{ id: 1 }] }), null);
});

test("recheckLabel", () => {
  const today = new Date(2026, 9, 23); // 23 Oct 2026, local time
  assert.equal(recheckLabel(null, today), "Never checked");
  assert.equal(recheckLabel("2026-10-01", today), "Due now");
  assert.equal(recheckLabel("2026-10-23", today), "Due now");
  assert.equal(recheckLabel("2026-10-24", today), "Due in 1 day");
  assert.equal(recheckLabel("2026-11-10", today), "Due in 18 days");
  assert.equal(recheckLabel("2027-04-23", today), "Due 23 Apr 2027");
});

test("formatDate and todayIso don't shift days", () => {
  assert.equal(formatDate("2026-01-05"), "5 Jan 2026");
  assert.equal(formatDate("2026-12-31T23:59:00"), "31 Dec 2026");
  assert.equal(formatDate(null), "");
  assert.equal(todayIso(new Date(2026, 0, 7)), "2026-01-07");
});

test("parseLatLngPair accepts a pasted pair only when valid", () => {
  assert.deepEqual(parseLatLngPair("22.435, 76.865"), { lat: 22.435, lng: 76.865 });
  assert.deepEqual(parseLatLngPair("-12.5,130"), { lat: -12.5, lng: 130 });
  assert.equal(parseLatLngPair("22.435"), null);
  assert.equal(parseLatLngPair("95, 10"), null);
  assert.equal(parseLatLngPair("abc, def"), null);
});

test("formatCoord rounds to 5 decimals", () => {
  assert.equal(formatCoord(22.4351234), "22.43512");
  assert.equal(formatCoord(76), "76");
});

test("languageLabel falls back to the code", () => {
  assert.equal(languageLabel("hi"), "हिंदी");
  assert.equal(languageLabel("xx"), "xx");
});

test("pin map messages are parsed safely", () => {
  assert.deepEqual(parsePinMessage(JSON.stringify({ type: "pin", lat: 22.4, lng: 76.8 })), { lat: 22.4, lng: 76.8 });
  assert.equal(parsePinMessage(JSON.stringify({ type: "open", id: 3 })), null);
  assert.equal(parsePinMessage("not json"), null);
  assert.equal(parsePinMessage({ type: "pin", lat: "x", lng: 1 }), null);
});

test("pin map html starts at the pin, or at the state centre without one", () => {
  const tiles = "http://localhost:8000/tiles/{z}/{x}/{y}.png";
  assert.match(buildPinMapHtml(22.5, 76.9, tiles), /"has":true,"lat":22\.5,"lng":76\.9/);
  assert.match(buildPinMapHtml(null, null, tiles), /"has":false/);
  assert.ok(buildPinMapHtml(null, null, tiles).includes(`"tiles":"${tiles}"`));
  assert.ok(!buildPinMapHtml(1, 1, "</script><script>alert(1)").includes("</script><script>alert(1)"));
});
