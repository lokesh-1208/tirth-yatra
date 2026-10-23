// User management and activity-log helpers. Pure, no runtime imports (unit tested in unit/adminUsers.test.mjs).
import type { AdminUser, AuditEntry, Role } from "./types";

export const ROLE_NAME: Record<Role, string> = { pilgrim: "Pilgrim", curator: "Curator", admin: "Admin" };
export const ROLE_HINT: Record<Role, string> = {
  pilgrim: "Uses the app",
  curator: "Places, checks, reports, leads",
  admin: "Everything, plus users and the activity log",
};
export const ROLES: Role[] = ["pilgrim", "curator", "admin"];

export const isStaff = (role: Role | null | undefined) => role === "curator" || role === "admin";

export type UserState = { key: "locked" | "blocked" | "active"; label: string; tone: "primary" | "warn" | "success" };

/** Locked beats a wrong-code block, which beats active. */
export const userState = (u: Pick<AdminUser, "is_locked" | "login_blocked_until">, now: Date = new Date()): UserState => {
  if (u.is_locked) return { key: "locked", label: "Locked", tone: "primary" };
  if (u.login_blocked_until && new Date(withZ(u.login_blocked_until)) > now)
    return { key: "blocked", label: "Login blocked", tone: "warn" };
  return { key: "active", label: "Active", tone: "success" };
};

/** Backend times are UTC without a zone mark; treat them as UTC. */
const withZ = (iso: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);

/** "Never", "Just now", "12 min ago", "3 h ago", "Yesterday", "5 days ago", or "12 Mar 2026". */
export const timeAgo = (iso: string | null | undefined, now: Date = new Date()): string => {
  if (!iso) return "Never";
  const then = new Date(withZ(iso));
  const sec = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  if (sec < 60) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} h ago`;
  const days = Math.floor(sec / 86400);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${then.getUTCDate()} ${months.at(then.getUTCMonth())} ${then.getUTCFullYear()}`;
};

export const displayName = (u: Pick<AdminUser, "id" | "name" | "email" | "phone">) => u.name || u.email || u.phone || `User #${u.id}`;

const ACTION_TEXT: Record<string, string> = {
  "place.create": "added the place",
  "place.update": "edited",
  "place.status": "changed the status of",
  "place.translation": "saved a translation for",
  "place.translation_delete": "removed a translation from",
  "place.contact_add": "added a contact to",
  "place.contact_update": "changed a contact of",
  "place.contact_delete": "removed a contact from",
  "place.photo_upload": "uploaded a photo for",
  "place.photo_update": "changed a photo of",
  "place.photo_delete": "deleted a photo of",
  "place.check": "logged a check for",
  "lead.create": "added the lead",
  "lead.update": "updated the lead",
  "report.review": "reviewed the report on",
  "report.to_lead": "turned into a lead the report on",
  "user.create": "added the user",
  "user.update": "edited the profile of",
  "user.role": "changed the role of",
  "user.lock": "locked",
  "user.unlock": "unlocked",
  "user.reset_login": "reset the login of",
  "user.delete": "deleted",
};

const STATUS_WORD: Record<string, string> = {
  draft: "draft",
  in_review: "in review",
  live: "live",
  hidden: "hidden",
  open: "open",
  resolved: "resolved",
  dismissed: "dismissed",
  to_call: "to call",
  called: "called",
  drafted: "draft made",
  rejected: "rejected",
  pilgrim: "pilgrim",
  curator: "curator",
  admin: "admin",
};

/** Extra words after the sentence: "(draft → live)", "(fields: city, landmarks)", "(Spam reports)". */
export const auditExtra = (e: Pick<AuditEntry, "details">): string => {
  const d = (e.details ?? {}) as Record<string, unknown>;
  if (typeof d.old === "string" && typeof d.new === "string")
    return `${STATUS_WORD[d.old] ?? d.old} → ${STATUS_WORD[d.new] ?? d.new}`;
  if (Array.isArray(d.fields) && d.fields.length) return `fields: ${d.fields.join(", ").replace(/_/g, " ")}`;
  if (typeof d.reason === "string") return d.reason;
  if (typeof d.language === "string") return d.language;
  if (typeof d.method === "string") return String(d.method).replace(/_/g, " ");
  return "";
};

/** "Test Curator changed the status of Siddhodaya (draft → live)". */
export const auditSentence = (e: AuditEntry): string => {
  const who = e.actor_name ?? "Someone";
  const verb = ACTION_TEXT[e.action] ?? e.action;
  const what = e.target_label ?? `${e.target_type} #${e.target_id ?? "?"}`;
  const extra = auditExtra(e);
  return `${who} ${verb} ${what}${extra ? ` (${extra})` : ""}`;
};

/** Where tapping a log entry should go in the admin section, if anywhere. */
export const auditLink = (e: Pick<AuditEntry, "target_type" | "target_id" | "action">): string | null => {
  if (e.target_id == null) return null;
  if (e.target_type === "place") return `/admin/place/${e.target_id}`;
  if (e.target_type === "user" && e.action !== "user.delete") return `/admin/user/${e.target_id}`;
  if (e.target_type === "lead") return "/admin/leads";
  if (e.target_type === "report") return "/admin/reviews";
  return null;
};

/** The admin must type DELETE (any case, spaces around ignored) before an account is deleted. */
export const deleteConfirmed = (typed: string) => typed.trim().toUpperCase() === "DELETE";
