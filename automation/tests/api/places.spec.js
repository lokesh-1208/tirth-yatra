const { test, expect } = require("@playwright/test");
const { registerViaApi, bearer } = require("../../utils/api");

test.describe("Places API", () => {
  test("list returns places and none are falsely marked verified", async ({ request }) => {
    const res = await request.get("/places");
    expect(res.status()).toBe(200);
    const places = await res.json();
    expect(places.length).toBeGreaterThan(0);
    for (const p of places) {
      expect(p).toHaveProperty("latitude");
      expect(p).toHaveProperty("longitude");
    }
  });

  test("search by city filters results", async ({ request }) => {
    const places = await (await request.get("/places", { params: { q: "bhopal" } })).json();
    expect(places.length).toBeGreaterThan(0);
    for (const p of places) {
      expect(`${p.name} ${p.city}`.toLowerCase()).toContain("bhopal");
    }
  });

  test("sect filter includes 'all' places but excludes the other sect", async ({ request }) => {
    const places = await (await request.get("/places", { params: { sect: "digambar" } })).json();
    for (const p of places) expect(["digambar", "all"]).toContain(p.sect);
  });

  test("unknown place returns 404", async ({ request }) => {
    expect((await request.get("/places/999999")).status()).toBe(404);
  });

  test("save / list / unsave flow requires auth and is idempotent", async ({ request }) => {
    const [first] = await (await request.get("/places")).json();
    expect((await request.post(`/places/${first.id}/save`)).status()).toBe(401);

    const { token } = await registerViaApi(request);
    const h = bearer(token);
    expect((await request.post(`/places/${first.id}/save`, { headers: h })).status()).toBe(204);
    expect((await request.post(`/places/${first.id}/save`, { headers: h })).status()).toBe(204);

    const saved = await (await request.get("/places/saved", { headers: h })).json();
    expect(saved.map((p) => p.id)).toEqual([first.id]);

    expect((await request.delete(`/places/${first.id}/save`, { headers: h })).status()).toBe(204);
    expect(await (await request.get("/places/saved", { headers: h })).json()).toEqual([]);
  });

  test("users cannot see each other's saved places", async ({ request }) => {
    const [first] = await (await request.get("/places")).json();
    const a = await registerViaApi(request);
    const b = await registerViaApi(request);
    await request.post(`/places/${first.id}/save`, { headers: bearer(a.token) });
    const bSaved = await (await request.get("/places/saved", { headers: bearer(b.token) })).json();
    expect(bSaved).toEqual([]);
  });
});

test.describe("Route API", () => {
  test("Jabalpur → Nemawar returns ordered places along the way", async ({ request }) => {
    const res = await request.get("/route", { params: { start: "Jabalpur", end: "Nemawar", max_detour_km: 30 } });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.total_km).toBeGreaterThan(250);
    expect(data.places.length).toBeGreaterThan(0);
    const distances = data.places.map((p) => p.distance_from_start_km);
    expect(distances).toEqual([...distances].sort((x, y) => x - y));
    for (const p of data.places) expect(p.detour_km).toBeLessThanOrEqual(30);
  });

  test("wider detour never returns fewer places than a tight one", async ({ request }) => {
    const get = async (d) =>
      (await (await request.get("/route", { params: { start: "Jabalpur", end: "Nemawar", max_detour_km: d } })).json())
        .places.length;
    expect(await get(100)).toBeGreaterThanOrEqual(await get(2));
  });

  test("accepts lat,lng and rejects unknown place names", async ({ request }) => {
    const ok = await request.get("/route", { params: { start: "23.18,79.98", end: "22.43,76.86" } });
    expect(ok.status()).toBe(200);
    const bad = await request.get("/route", { params: { start: "Atlantis", end: "Nemawar" } });
    expect(bad.status()).toBe(422);
  });

  test("detour limit outside allowed range is rejected", async ({ request }) => {
    const res = await request.get("/route", { params: { start: "Jabalpur", end: "Nemawar", max_detour_km: 5000 } });
    expect(res.status()).toBe(422);
  });
});
