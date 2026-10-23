// Admin section helpers. Pure functions with no runtime imports so they can be unit tested
// directly with Node (see unit/admin.test.mjs).
import type { AdminPlace, CheckMethod, ContactRole, LeadStatus, PlaceInput, PlaceKind, PlaceStatus, Sect, TranslatableFields } from "./types";

export const STATUS_LABEL: Record<PlaceStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  live: "Live",
  hidden: "Hidden",
};
export const STATUSES: PlaceStatus[] = ["draft", "in_review", "live", "hidden"];

export const SECTS: { value: Sect; label: string }[] = [
  { value: "digambar", label: "Digambar" },
  { value: "shvetambar", label: "Shvetambar" },
  { value: "all", label: "Both" },
];

export const KINDS: { value: PlaceKind; label: string }[] = [
  { value: "tirth", label: "Tirth" },
  { value: "siddha_kshetra", label: "Siddha Kshetra" },
  { value: "atishay_kshetra", label: "Atishay Kshetra" },
  { value: "temple", label: "Temple" },
  { value: "dharamshala", label: "Dharamshala" },
];

export const METHOD_LABEL: Record<CheckMethod, string> = {
  call: "Phone call",
  visit: "Visit",
  local_reference: "Local reference",
};

export const ROLE_LABEL: Record<ContactRole, string> = {
  manager: "Manager",
  pujari: "Pujari",
  trustee: "Trustee",
  other: "Other",
};

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  to_call: "To call",
  called: "Called",
  drafted: "Draft made",
  rejected: "Rejected",
};

export const RECHECK_MONTHS = [3, 6, 12];

/** Languages a curator can add text in. More can be added here as the app grows. */
export const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
  { code: "mr", label: "मराठी" },
  { code: "gu", label: "ગુજરાતી" },
  { code: "kn", label: "ಕನ್ನಡ" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "bn", label: "বাংলা" },
  { code: "pa", label: "ਪੰਜਾਬੀ" },
  { code: "raj", label: "राजस्थानी" },
];
export const languageLabel = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code;

export const TRANSLATABLE: (keyof TranslatableFields)[] = [
  "name",
  "description",
  "how_to_reach",
  "darshan_timings",
  "stay_info",
  "food_info",
  "landmarks",
];

/** Editable place fields, as strings for text inputs. */
export type PlaceForm = {
  name: string;
  sect: Sect | "";
  kind: PlaceKind;
  deity: string;
  description: string;
  city: string;
  district: string;
  state: string;
  address: string;
  pincode: string;
  latitude: string;
  longitude: string;
  how_to_reach: string;
  darshan_timings: string;
  stay_info: string;
  food_info: string;
  landmarks: string;
};

export const emptyForm = (overrides: Partial<PlaceForm> = {}): PlaceForm => ({
  name: "",
  sect: "",
  kind: "temple",
  deity: "",
  description: "",
  city: "",
  district: "",
  state: "Madhya Pradesh",
  address: "",
  pincode: "",
  latitude: "",
  longitude: "",
  how_to_reach: "",
  darshan_timings: "",
  stay_info: "",
  food_info: "",
  landmarks: "",
  ...overrides,
});

export const formFromPlace = (p: AdminPlace): PlaceForm => ({
  name: p.name ?? "",
  sect: (p.sect as Sect | null) ?? "",
  kind: (p.kind as PlaceKind) ?? "temple",
  deity: p.deity ?? "",
  description: p.description ?? "",
  city: p.city ?? "",
  district: p.district ?? "",
  state: p.state ?? "",
  address: p.address ?? "",
  pincode: p.pincode ?? "",
  latitude: String(p.latitude),
  longitude: String(p.longitude),
  how_to_reach: p.how_to_reach ?? "",
  darshan_timings: p.darshan_timings ?? "",
  stay_info: p.stay_info ?? "",
  food_info: p.food_info ?? "",
  landmarks: p.landmarks ?? "",
});

export type FormErrors = Partial<Record<keyof PlaceForm, string>>;

const parseCoord = (raw: string): number | null => {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Same rules as the backend, so mistakes show next to the field before saving. */
export const validateForm = (f: PlaceForm): FormErrors => {
  const e: FormErrors = {};
  if (f.name.trim().length < 2) e.name = "Enter the place name";
  const lat = parseCoord(f.latitude);
  const lng = parseCoord(f.longitude);
  if (lat === null || lat < -90 || lat > 90) e.latitude = "Latitude must be between -90 and 90";
  if (lng === null || lng < -180 || lng > 180) e.longitude = "Longitude must be between -180 and 180";
  if (f.pincode.trim() && !/^\d{6}$/.test(f.pincode.trim())) e.pincode = "Pincode has 6 digits";
  return e;
};

const textOrNull = (s: string) => (s.trim() ? s.trim() : null);

/** Form → API body (all fields). */
export const formToInput = (f: PlaceForm): PlaceInput & { name: string; latitude: number; longitude: number } => ({
  name: f.name.trim(),
  sect: f.sect || null,
  kind: f.kind,
  deity: textOrNull(f.deity),
  description: textOrNull(f.description),
  city: textOrNull(f.city),
  district: textOrNull(f.district),
  state: textOrNull(f.state),
  address: textOrNull(f.address),
  pincode: textOrNull(f.pincode),
  latitude: Number(f.latitude),
  longitude: Number(f.longitude),
  how_to_reach: textOrNull(f.how_to_reach),
  darshan_timings: textOrNull(f.darshan_timings),
  stay_info: textOrNull(f.stay_info),
  food_info: textOrNull(f.food_info),
  landmarks: textOrNull(f.landmarks),
});

/** Only the fields that differ from the saved place, so an update never overwrites what wasn't touched. */
export const changedFields = (saved: PlaceForm, edited: PlaceForm): PlaceInput => {
  const a = formToInput(saved) as Record<string, unknown>;
  const b = formToInput(edited) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(b)) if (a[k] !== b[k]) out[k] = b[k];
  return out as PlaceInput;
};

/** Translation text for one language as form strings ("" when missing). */
export const translationForm = (p: AdminPlace, language: string): Record<keyof TranslatableFields, string> => {
  const t = p.translations.find((x) => x.language === language);
  return Object.fromEntries(TRANSLATABLE.map((k) => [k, t?.[k] ?? ""])) as Record<keyof TranslatableFields, string>;
};

/** Why a place cannot go live yet, or null when it can. Mirrors the backend rule. */
export const publishBlocker = (p: Pick<AdminPlace, "checks">): string | null =>
  p.checks.length === 0 ? "Log at least one check (call, visit or local reference) before making it live." : null;

const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** "Never checked", "Due now", "Due in 12 days", "Due 3 Mar 2027" for a re-check date. */
export const recheckLabel = (due: string | null, today: Date = new Date()): string => {
  if (!due) return "Never checked";
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((toDate(due).getTime() - t) / 86_400_000);
  if (days <= 0) return "Due now";
  if (days <= 30) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `Due ${formatDate(due)}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-23" → "23 Oct 2026" (no time-zone shifts). */
export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS.at(m - 1) ?? ""} ${y}`;
};

/** Today as YYYY-MM-DD in local time. */
export const todayIso = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/** "23.15, 79.88" style text pasted from a map into the latitude field → both numbers. */
export const parseLatLngPair = (text: string): { lat: number; lng: number } | null => {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
};

/** Coordinates shown with 5 decimals (about 1 m). */
export const formatCoord = (n: number) => (Math.round(n * 1e5) / 1e5).toString();
