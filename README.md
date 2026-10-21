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

### 3. Automation
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
Any `*@qa.tirthyatra.app` email also uses `999999` (used by the automation to get isolated users).
Set `ENABLE_TEST_USER=false` in production. Real OTPs are currently only printed to the backend
console (`app/otp.py: send_otp`) until an SMS/email provider is wired in.

If you ran an earlier version, delete `backend/tirth.db` once (the users table changed).

## Data note
`backend/app/seed.py` contains **sample, unverified** entries so the app has something to show.
Every place has a `verified` flag and `verified_by` / `verified_on` fields – only mark a place
verified after you have confirmed it by call or local reference.

## Roadmap
- [x] Auth: passwordless OTP login (email / phone), onboarding, me
- [ ] Real OTP delivery (SMS / email provider)
- [x] Places list, detail, save/unsave
- [x] Route search (places within X km of the A→B line)
- [ ] Real geocoding + road routes (Google Maps / OSRM)
- [ ] PostGIS corridor query
- [ ] Photos, regional languages (i18n), sect filter UI
- [ ] Admin panel to add and verify places
