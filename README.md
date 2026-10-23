# Tirth Yatra – Route-based Pilgrimage Planner

Pick a trip from A to B and discover holy places along the way (starting with Jain tirths).

```
tirth-yatra/
├── backend/      FastAPI + SQLAlchemy (SQLite in dev, PostgreSQL/PostGIS later)
├── frontend/     Expo (React Native + TypeScript) – Android, iOS and web
├── automation/   Playwright tests (API + web UI)
└── tirth-yatra.code-workspace   open this in VS Code
```

## Run it

### 1. Backend
```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate    Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 2. Frontend
```bash
cd frontend
npm install
npx expo start --web        # web
npx expo start              # scan QR with Expo Go for phone
```
For a physical phone, set `EXPO_PUBLIC_API_URL=http://<your-pc-ip>:8000` (see `frontend/.env.example`).

Tip: if Expo warns about package versions, run `npx expo install --fix` once. The web build was
verified with `npx expo export --platform web`. `query-string` is listed explicitly in
`package.json` because this expo-router version needs it but no longer gets it automatically.

In VS Code: open `tirth-yatra.code-workspace`, then Terminal > Run Task > "start everything".

### 3. Unit tests (developer checks)
```bash
cd backend && pytest                 # backend unit + API tests (offline, no Nominatim/OSRM calls)
cd frontend && npm run test:unit     # pure TS helpers, Node 22.18+ (runs .ts directly)
```

### 4. Automation
```bash
cd automation
npm install
npx playwright install chromium
npm run test:api            # needs backend running
npm run test:ui             # needs backend + frontend web running
```

## Logging in (OTP, no passwords)
Enter an email or mobile number, get a 6-digit OTP, done. First login creates the account and
asks for name + faith. There is no password, so nothing to reset: lost access = request a new OTP.

**Dummy test user** (dev only): `test@tirthyatra.app` or `9999999999`, OTP always `999999`.
**Dummy curator** (dev only, opens the admin section): `curator@tirthyatra.app`, OTP `999999`. Any
`curator…@qa.tirthyatra.app` email is a curator too (isolated curators for automation).
Any `*@qa.tirthyatra.app` email also uses `999999` (used by the automation to get isolated users).
Set `ENABLE_TEST_USER=false` in production. Real OTPs are currently only printed to the backend
console (`app/otp.py: send_otp`) until an SMS/email provider is wired in.

If you ran an earlier version, delete `backend/tirth.db` once (the users table changed).

## Route search, geocoding and map
`/route` geocodes both ends with **Nominatim**, gets the driving route from **OSRM**, and returns places
within the chosen distance of the *road* (not a straight line), ordered along the trip, plus the route
polyline for the map. `/geocode?q=` powers the autocomplete. If either service is unreachable it falls
back to the built-in city list / a straight line (`source: "straight"` in the response).

The public Nominatim and OSRM servers are **free but for light use only** (about 1 request/second, no
SLA). Before real traffic, self-host them or swap the providers: set `NOMINATIM_URL` / `OSRM_URL`
(`backend/.env`), or replace `app/geocoding.py` / `app/routing.py`. `EXTERNAL_GEO_ENABLED=false` turns both off.
The maps are Leaflet with OpenStreetMap tiles, loaded **through the backend** (`/tiles/{z}/{x}/{y}.png`): it sends
the app's User-Agent and caches tiles on disk (`backend/tile-cache/`, 7 days), because OSM refuses tile requests it
cannot identify. Still light use only: set `TILE_URL_TEMPLATE` (backend) or `EXPO_PUBLIC_MAP_TILE_URL` (app) to a
paid or self-hosted provider before launch.

### Break journey (stops on the way)
Pilgrims can add up to 5 stops between start and end on **Plan route** ("Add a stop (your own path)").
`/route` takes them as repeated `via` parameters in travel order, e.g.
`/route?start=Jabalpur&end=Nemawar&via=Hoshangabad`. OSRM routes through every stop; offline it falls back to
straight lines through the stops. The response has `stops` (label, lat, lng, `distance_from_start_km`), the map shows
them as gold square pins, and a saved yatra keeps them (`via`) and shows them in its timeline as "Break journey".
The limit is `MAX_STOPS` in `backend/app/routing.py` and `frontend/src/routeStops.ts` (keep them equal).

## Admin section (curators)
Curators open **Profile → Admin** (web first). Real curators: list their email / phone in `CURATOR_IDENTIFIERS`
(`backend/.env`); they get the role on their next login. Every `/admin/*` call checks the role (403 otherwise).

- **Admin home**: counts by status, re-check due list, recent checks, leads to follow up.
- **Places**: search and filter (draft, in review, live, hidden, re-check due).
- **Add a place**: name, sect, kind, town and a GPS pin (tap the map or "Use my GPS location"). It starts as a **draft**.
- **Place editor**: one Name field plus an "Editing in" language switcher (Name, About, Visiting and Landmarks are
  saved per language in `place_translations`; pilgrims get their app language, falling back to `DEFAULT_LANGUAGE`),
  location and landmarks, visiting details, contacts (shown to pilgrims only with a consent date and
  "show to pilgrims"), cover photo (JPEG/PNG/WebP up to 5 MB, uploaded with a "no deity image" confirmation;
  no cover means pilgrims see the auto cover), **Log a check** with history.
- **Publishing**: only `live` places reach pilgrims. A place can go live only after at least one check is logged.
  A check sets the verified badge (who, when, how) and the re-check date (3, 6 or 12 months).
- **Leads to call**: places heard of somewhere; mark called / rejected, or "Make draft" to start a place linked to it.

Places that existed before the admin section are kept `live` (startup backfill), so the sample data still shows
until you hide it. Photos are stored in `backend/uploads/` (git-ignored) and served at `/uploads/...`.

## App structure (UI)
Built with **React Native Paper** (Material Design 3). Colours, fonts and spacing live in
`frontend/src/theme.ts` (saffron / deep blue / gold, **Mukta** for text, **Tiro Devanagari Hindi** for titles);
shared building blocks (`Button`, `Input`, `Chip`, `Hero`, `PageHeader`, `Pill`, `Empty`, `Placeholder`) are in
`frontend/src/ui.tsx`. Every interactive element keeps a `testID` for the Playwright suite.

| Screen | File | Notes |
|---|---|---|
| Login / OTP, Onboarding | `app/(auth)/login.tsx`, `app/onboarding.tsx` | |
| **Explore** tab | `app/(tabs)/index.tsx` | search, browse by type, Parv & Utsav (placeholder), sect filter |
| **Plan Route** tab | `app/(tabs)/plan.tsx` | From/To with suggestions, swap, detour, map, **Save as yatra** |
| **My Yatras** tab | `app/(tabs)/yatras.tsx`, `app/yatra/[id].tsx` | saved trips, stop timeline with visited checkboxes, rename, delete |
| **Saved** tab | `app/(tabs)/saved.tsx` | bookmarked places |
| **Profile** tab | `app/(tabs)/profile.tsx` | stats, faith/sect, settings, help, about, logout |
| Place detail | `app/place/[id].tsx` | quick actions (save, directions, call, share) + About / Darshan / Stay / Bhojan / Reach |
| Settings | `app/settings/language.tsx`, `help.tsx`, `about.tsx` | |

**Placeholders to fill with real data later** (the UI shows "Not added yet" until then):
- Place fields `darshan_timings`, `contact_phone`, `stay_info`, `food_info`, `photo_url` (backend `Place` model).
  Existing `tirth.db` files get the new columns automatically on startup (`add_missing_columns`).
- Festival dates on Explore (`FESTIVALS` in `app/(tabs)/index.tsx`).
- Hindi UI translation (the language choice is already saved on the account).
- Yatras are stored on the device (`src/yatras.tsx`); backend sync is a TODO.

## Data note
`backend/app/seed.py` contains **sample, unverified** entries so the app has something to show.
Every place has a `verified` flag and `verified_by` / `verified_on` fields – only mark a place
verified after you have confirmed it by call or local reference.

## Roadmap
- [x] Auth: passwordless OTP login (email / phone), onboarding, me
- [ ] Real OTP delivery (SMS / email provider)
- [x] Places list, detail, save/unsave
- [x] Route search (places within X km of the A→B line)
- [x] Real geocoding (Nominatim) + road routes (OSRM) + route map (Leaflet / OpenStreetMap)
- [x] Break journey: up to 5 stops between start and end, saved with the yatra
- [ ] PostGIS corridor query
- [x] Material Design 3 UI (React Native Paper), full tab structure, My Yatras (on device)
- [ ] Photos, regional languages (i18n)
- [ ] Sync My Yatras to the backend
- [x] Admin section: roles, places, languages, contacts, cover photos, checks, publishing, leads
- [ ] Review queue for pilgrim reports, festival dates (phase 2)
