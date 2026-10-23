// "Break journey": stops the pilgrim adds between start and end.
// Pure helpers with no runtime imports, so they are easy to unit test (see unit/routeStops.test.ts).
import type { GeoPoint, YatraBreak, YatraStop } from "./types";

/** Must match MAX_STOPS in backend/app/routing.py. */
export const MAX_STOPS = 5;

/** One stop field on the Plan route form. `point` is set when a suggestion was picked. */
export type StopDraft = { key: string; text: string; point: GeoPoint | null };

let counter = 0;
export const newStop = (): StopDraft => ({ key: `stop-${Date.now().toString(36)}-${counter++}`, text: "", point: null });

export const canAddStop = (stops: StopDraft[]) => stops.length < MAX_STOPS;

export const addStop = (stops: StopDraft[]): StopDraft[] => (canAddStop(stops) ? [...stops, newStop()] : stops);

export const removeStop = (stops: StopDraft[], key: string): StopDraft[] => stops.filter((s) => s.key !== key);

export const updateStop = (stops: StopDraft[], key: string, patch: Partial<Omit<StopDraft, "key">>): StopDraft[] =>
  stops.map((s) => (s.key === key ? { ...s, ...patch } : s));

/** Swapping start and end also reverses the stops, so the trip runs the other way. */
export const reverseStops = (stops: StopDraft[]): StopDraft[] => [...stops].reverse();

/** What the API gets for a place field: exact coordinates when a suggestion was picked, else the typed text. */
export const locationParam = (text: string, point: GeoPoint | null): string =>
  point ? `${point.lat},${point.lng}` : text.trim();

/** Stops to send to the API, in order. Empty fields are skipped. */
export const viaParams = (stops: StopDraft[]): string[] =>
  stops.filter((s) => s.point || s.text.trim()).map((s) => locationParam(s.text, s.point));

/** Names to show for the stops (picked label, else typed text), in order. Empty fields are skipped. */
export const viaLabels = (stops: StopDraft[]): string[] =>
  stops.filter((s) => s.point || s.text.trim()).map((s) => s.point?.label ?? s.text.trim());

/** "Jabalpur → Hoshangabad → Nemawar" using the first part of each label ("Bhopal, Madhya Pradesh" → "Bhopal"). */
export const routeTitle = (start: string, via: string[], end: string): string =>
  [start, ...via, end].map((s) => s.split(",")[0].trim()).join(" → ");

/** Query string where repeated keys (like `via`) become `via=a&via=b`. Empty values are left out. */
export const buildQuery = (params: Record<string, string | number | boolean | string[] | undefined | null>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const values = Array.isArray(v) ? v : [v];
    for (const one of values) {
      if (one !== undefined && one !== null && one !== "") p.append(k, String(one));
    }
  }
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** Google Maps directions link that also passes through the stops. */
export const directionsUrl = (start: string, via: string[], end: string): string => {
  const p = new URLSearchParams({ api: "1", origin: start, destination: end });
  if (via.length) p.set("waypoints", via.join("|"));
  return `https://www.google.com/maps/dir/?${p.toString()}`;
};

export type TimelineItem = { type: "place"; stop: YatraStop } | { type: "break"; brk: YatraBreak; index: number };

/**
 * Places and break-journey stops of a yatra merged into one list in travel order.
 * On the same distance the break comes first (you arrive, then visit what is there).
 */
export const timelineItems = (stops: YatraStop[], via: YatraBreak[] = []): TimelineItem[] => {
  const items: { km: number; rank: number; item: TimelineItem }[] = [
    ...via.map((brk, index) => ({ km: brk.distance_from_start_km, rank: 0, item: { type: "break" as const, brk, index } })),
    ...stops.map((stop) => ({ km: stop.distance_from_start_km, rank: 1, item: { type: "place" as const, stop } })),
  ];
  return items.sort((a, b) => a.km - b.km || a.rank - b.rank).map((x) => x.item);
};
