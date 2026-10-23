// Unit tests for the "break journey" helpers. Run: npm run test:unit  (Node 22.18+ runs the .ts file directly)
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addStop,
  buildQuery,
  canAddStop,
  directionsUrl,
  locationParam,
  MAX_STOPS,
  newStop,
  removeStop,
  reverseStops,
  routeTitle,
  timelineItems,
  updateStop,
  viaLabels,
  viaParams,
} from "../src/routeStops.ts";

const stop = (text, point = null) => ({ ...newStop(), text, point });

test("new stops get unique keys", () => {
  const keys = new Set(Array.from({ length: 20 }, () => newStop().key));
  assert.equal(keys.size, 20);
});

test("adding stops stops at MAX_STOPS", () => {
  let stops = [];
  for (let i = 0; i < MAX_STOPS + 3; i++) stops = addStop(stops);
  assert.equal(stops.length, MAX_STOPS);
  assert.equal(canAddStop(stops), false);
  assert.equal(addStop(stops), stops); // unchanged, same array
});

test("remove and update only touch the stop with that key", () => {
  const a = stop("Bhopal");
  const b = stop("Itarsi");
  assert.deepEqual(removeStop([a, b], a.key).map((s) => s.text), ["Itarsi"]);
  const updated = updateStop([a, b], b.key, { text: "Hoshangabad" });
  assert.deepEqual(updated.map((s) => s.text), ["Bhopal", "Hoshangabad"]);
  assert.equal(updated[0], a); // untouched stop is the same object
});

test("reverseStops flips the order without changing the input", () => {
  const list = [stop("A"), stop("B"), stop("C")];
  assert.deepEqual(reverseStops(list).map((s) => s.text), ["C", "B", "A"]);
  assert.deepEqual(list.map((s) => s.text), ["A", "B", "C"]);
});

test("a picked suggestion is sent as coordinates, typed text as trimmed text", () => {
  assert.equal(locationParam("  Bhopal ", null), "Bhopal");
  assert.equal(locationParam("Bhopal", { label: "Bhopal, MP", lat: 23.25, lng: 77.41 }), "23.25,77.41");
});

test("viaParams and viaLabels skip empty stops and keep order", () => {
  const picked = { label: "Hoshangabad, Madhya Pradesh", lat: 22.75, lng: 77.72 };
  const list = [stop("  "), stop("Narsinghpur"), stop("Hosh", picked), stop("")];
  assert.deepEqual(viaParams(list), ["Narsinghpur", "22.75,77.72"]);
  assert.deepEqual(viaLabels(list), ["Narsinghpur", "Hoshangabad, Madhya Pradesh"]);
});

test("routeTitle joins short names with arrows", () => {
  assert.equal(routeTitle("Jabalpur, MP", ["Hoshangabad, MP"], "Nemawar"), "Jabalpur → Hoshangabad → Nemawar");
  assert.equal(routeTitle("Jabalpur", [], "Nemawar"), "Jabalpur → Nemawar");
});

test("buildQuery repeats array keys and drops empty values", () => {
  const q = buildQuery({ start: "Jabalpur", end: "Nemawar", via: ["Bhopal", "", "Itarsi"], max_detour_km: 25, sect: undefined });
  assert.equal(q, "?start=Jabalpur&end=Nemawar&via=Bhopal&via=Itarsi&max_detour_km=25");
  assert.equal(buildQuery({ via: [] }), "");
  assert.equal(buildQuery({ q: "a & b" }), "?q=a+%26+b");
});

test("directionsUrl adds waypoints only when there are stops", () => {
  const direct = new URL(directionsUrl("Jabalpur", [], "Nemawar"));
  assert.equal(direct.searchParams.get("waypoints"), null);
  const via = new URL(directionsUrl("Jabalpur", ["Bhopal", "Dewas"], "Nemawar"));
  assert.equal(via.searchParams.get("origin"), "Jabalpur");
  assert.equal(via.searchParams.get("destination"), "Nemawar");
  assert.equal(via.searchParams.get("waypoints"), "Bhopal|Dewas");
});

test("timelineItems merges places and breaks by distance, break first on a tie", () => {
  const place = (id, km) => ({ place_id: id, name: `P${id}`, city: null, kind: "temple", distance_from_start_km: km, detour_km: 1, visited: false });
  const items = timelineItems(
    [place(1, 50), place(2, 120), place(3, 200)],
    [{ label: "Hoshangabad", distance_from_start_km: 120 }],
  );
  assert.deepEqual(
    items.map((i) => (i.type === "break" ? `break:${i.brk.label}` : `place:${i.stop.place_id}`)),
    ["place:1", "break:Hoshangabad", "place:2", "place:3"],
  );
  assert.equal(items[1].index, 0);
});

test("timelineItems works for yatras saved before break journey existed", () => {
  const items = timelineItems([{ place_id: 9, name: "X", city: null, kind: "temple", distance_from_start_km: 5, detour_km: 0, visited: false }]);
  assert.deepEqual(items.map((i) => i.type), ["place"]);
});
