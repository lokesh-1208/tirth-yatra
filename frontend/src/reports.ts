// Pilgrim reports: labels and checks. Pure, no runtime imports (unit tested in unit/reports.test.mjs).
import type { ReportInput, ReportKind, ReportStatus, ReportTopic } from "./types";

export const TOPIC_LABEL: Record<ReportTopic, string> = {
  timings: "Darshan timings",
  contact: "Phone / contact",
  location: "Location or map pin",
  name: "Name or details",
  stay: "Stay (dharamshala)",
  food: "Bhojan",
  closed: "Closed or does not exist",
  other: "Something else",
};
export const TOPICS = Object.keys(TOPIC_LABEL) as ReportTopic[];

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: "We are looking into it",
  resolved: "Done",
  dismissed: "Closed",
};

/** Curator-facing labels for the review queue. */
export const QUEUE_STATUS_LABEL: Record<ReportStatus, string> = {
  open: "Open",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 2000;

export type ReportForm = { kind: ReportKind; placeId?: number; topic: ReportTopic | ""; message: string; placeName: string; area: string };

/** Same rules as the backend; returns the first problem, or null when it can be sent. */
export const reportProblem = (f: ReportForm): string | null => {
  if (f.kind === "correction") {
    if (!f.placeId) return "Open the place first, then report.";
    if (!f.topic) return "Choose what is wrong.";
  } else if (!f.placeName.trim()) {
    return "Enter the name of the missing place.";
  }
  const len = f.message.trim().length;
  if (len < MESSAGE_MIN) return "Tell us a little more (at least 5 letters).";
  if (len > MESSAGE_MAX) return `Keep it under ${MESSAGE_MAX} letters.`;
  return null;
};

export const toReportInput = (f: ReportForm): ReportInput =>
  f.kind === "correction"
    ? { kind: "correction", place_id: f.placeId, topic: (f.topic || "other") as ReportTopic, message: f.message.trim() }
    : { kind: "new_place", topic: "other", place_name: f.placeName.trim(), area: f.area.trim() || undefined, message: f.message.trim() };
