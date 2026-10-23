// Unit tests for the report helpers. Run: npm run test:unit
import assert from "node:assert/strict";
import { test } from "node:test";

import { MESSAGE_MAX, REPORT_STATUS_LABEL, reportProblem, TOPIC_LABEL, TOPICS, toReportInput } from "../src/reports.ts";

const correction = (over = {}) => ({ kind: "correction", placeId: 4, topic: "timings", message: "Aarti is at 7 pm", placeName: "", area: "", ...over });
const missing = (over = {}) => ({ kind: "new_place", topic: "", message: "Old mandir near the river", placeName: "Village Mandir", area: " Harda ", ...over });

test("topics match the backend list and all have labels", () => {
  assert.deepEqual(TOPICS, ["timings", "contact", "location", "name", "stay", "food", "closed", "other"]);
  for (const t of TOPICS) assert.ok(TOPIC_LABEL[t]);
  assert.equal(REPORT_STATUS_LABEL.open, "We are looking into it");
});

test("a correction needs a place, a topic and a real message", () => {
  assert.equal(reportProblem(correction()), null);
  assert.match(reportProblem(correction({ placeId: undefined })), /Open the place/);
  assert.match(reportProblem(correction({ topic: "" })), /what is wrong/);
  assert.match(reportProblem(correction({ message: "  bad " })), /a little more/);
  assert.match(reportProblem(correction({ message: "x".repeat(MESSAGE_MAX + 1) })), /under/);
});

test("a missing place needs its name", () => {
  assert.equal(reportProblem(missing()), null);
  assert.match(reportProblem(missing({ placeName: "  " })), /name of the missing place/);
});

test("toReportInput sends only what the backend expects", () => {
  assert.deepEqual(toReportInput(correction({ message: "  Aarti is at 7 pm  " })), {
    kind: "correction",
    place_id: 4,
    topic: "timings",
    message: "Aarti is at 7 pm",
  });
  assert.deepEqual(toReportInput(missing()), {
    kind: "new_place",
    topic: "other",
    place_name: "Village Mandir",
    area: "Harda",
    message: "Old mandir near the river",
  });
  assert.equal(toReportInput(missing({ area: " " })).area, undefined);
});
