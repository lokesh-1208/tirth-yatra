# Automation (Playwright, JavaScript)

Two projects:

| Project | Folder        | Needs running                 |
|---------|---------------|-------------------------------|
| `api`   | `tests/api`   | backend on :8000              |
| `ui`    | `tests/ui`    | backend :8000 + web app :8081 |

```bash
npm install
npx playwright install chromium

npm run test:api
npm run test:ui
npm test             # both
npm run report       # open the HTML report
```

Override URLs with `API_URL` and `WEB_URL` (see `.env.example`).

## Structure
- `pages/` – Page Object Model classes (`LoginPage`, `OnboardingPage`, `AppShell`)
- `utils/` – unique test data and API helpers
- Locators use `testID`s from the app (rendered as `data-testid` on web), so tests don't break when text or styling changes.

## Notes
- Every test registers its own user with a unique email, so tests are independent and can run in parallel.
- The UI tests assume the seed data from the backend (`backend/app/seed.py`). If you replace the sample places with your own verified data, update the search terms in `tests/ui/tabs.spec.js` (currently "bhopal") and the route (Jabalpur → Nemawar).

## Backend settings for the tests
Start the backend with `EXTERNAL_GEO_ENABLED=false` (PowerShell: `$env:EXTERNAL_GEO_ENABLED="false"; uvicorn app.main:app --port 8000`)
so route/autocomplete tests use the built-in city list instead of the public Nominatim/OSRM servers
(deterministic, offline, no rate limits). Login uses the dummy OTP `999999`.
