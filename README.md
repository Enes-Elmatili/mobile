# FIXED — Mobile App

A two-sided service marketplace connecting **clients** with **service providers** (tradespeople) for on-demand repairs, installations, and maintenance — with real-time tracking, Stripe payments, and live provider matching.

---

## MVP Overview

| Role | Core Flow |
|------|-----------|
| **Client** | Sign up → Create request → Match provider → Track mission → Pay → Rate |
| **Provider** | Sign up → Go online → Accept request → Navigate to client → Complete → Earn |

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | https://nodejs.org |
| npm | ≥ 10 | Comes with Node |
| Expo CLI | latest | `npm i -g expo-cli` |
| Expo Go app | latest | App Store / Google Play |
| ngrok | latest | https://ngrok.com/download |

> **Physical device required.** Google Maps and Location services do not work in the Expo Go simulator.

---

## Step 1 — Start the Backend

### 1.1 Install dependencies

```bash
cd backend
npm install
```

### 1.2 Apply database migrations & seed

```bash
npx prisma migrate deploy
npx prisma db seed
```

This creates the SQLite database at `backend/prisma/dev.db` and seeds it with:
- An admin account: `admin@mosaic.com` / `Mosaic@2025`
- Service categories (plumbing, electrical, cleaning, etc.)
- Sample providers and roles

### 1.3 Start the server

```bash
npm run dev
```

The API will be live at `http://localhost:3000`. You should see:

```
Server running on http://0.0.0.0:3000
Socket.IO attached
```

---

## Step 2 — Expose the Backend via ngrok

The mobile app on your phone needs a public URL to reach your local backend.

### 2.1 In a new terminal window

```bash
ngrok http 3000
```

### 2.2 Copy the Forwarding URL

ngrok will show something like:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:3000
```

Copy the `https://...ngrok-free.app` URL.

---

## Step 3 — Configure the Mobile App

### 3.1 Open `mobile/.env`

```bash
cd mobile
```

Edit `.env` and paste your ngrok URL:

```env
EXPO_PUBLIC_API_URL=https://YOUR_NGROK_URL.ngrok-free.app/api

EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSyCX2pt7Wi5RckO9ur-i4PwSH7XRKdhDe5s
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SAAD8Ai87X1MWTO3ycR3JGdCaSJnpQnnEtrjgpohyfRBQPnYwrLppZc3sjQocisETjUO8uGxlnjCMeq2LKZUeNE004sObC5iL
```

> If you want to use your **local IP** instead of ngrok (both devices on same Wi-Fi):
> ```env
> EXPO_PUBLIC_API_URL=http://192.168.x.x:3000/api
> ```
> Find your IP with `ipconfig getifaddr en0` (macOS) or `ipconfig` (Windows).

### 3.2 Install dependencies

```bash
npm install
```

### 3.3 Start Expo

```bash
npx expo start
```

A QR code will appear in the terminal and a browser window will open.

---

## Step 4 — Open the App on Your Device

1. Open the **Expo Go** app on your iPhone or Android.
2. Scan the QR code shown in the terminal.
3. The app will bundle and launch — this takes ~30 seconds on first load.

You should see the **FIXED welcome screen**.

---

## Step 5 — Visualize the MVP Flows

### Flow A: Client Journey

**Goal:** Create a service request and track a provider in real-time.

| Step | Screen | Action |
|------|--------|--------|
| 1 | Welcome | Tap **Get Started** |
| 2 | Sign Up | Create a client account (select role: **Client**) |
| 3 | Client Dashboard | View your service categories and request history |
| 4 | New Request | Tap **+** → Multi-step form opens |
| 5 | Request Stepper | Choose category → Describe the issue → Add photos → Set location → Confirm |
| 6 | Dashboard | Request appears as **PENDING** — waiting for a provider |
| 7 | Missions Tab | Open to see the live request status |
| 8 | Tracking Screen | When a provider accepts, tap the mission → see real-time map tracking |
| 9 | Rating Screen | After mission completes, rate the provider (1–5 stars) |
| 10 | Wallet | Check balance and transaction history |

---

### Flow B: Provider Journey

**Goal:** Go online, receive a request, and complete a mission.

> Use a second device or a second Expo Go session with a separate account.

| Step | Screen | Action |
|------|--------|--------|
| 1 | Sign Up | Create a provider account (select role: **Provider**) |
| 2 | Provider Dashboard | Tap the status toggle → set yourself **ONLINE** |
| 3 | Wait | The backend broadcasts nearby requests every 45 seconds |
| 4 | Notification | A new request alert appears — tap to view details |
| 5 | Mission Sheet | Review the request details, client location, and price |
| 6 | Accept | Tap **Accept** — mission status changes to **IN PROGRESS** |
| 7 | Ongoing Screen | Navigation map shows route to client |
| 8 | Complete | Tap **Complete Mission** when done |
| 9 | Earnings | View payout and request withdrawal from Earnings screen |

---

### Flow C: Admin Overview (Web/API)

The backend exposes a Swagger UI for inspecting all endpoints:

```
http://localhost:3000/api-docs
```

Admin credentials:
```
Email:    admin@mosaic.com
Password: Mosaic@2025
```

Key admin endpoints to test via Swagger or a REST client (e.g. Insomnia):

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/login` | Get a JWT token |
| `GET /api/users` | List all users |
| `GET /api/requests` | List all service requests |
| `GET /api/providers` | List all providers with status |
| `GET /api/stats` | Dashboard stats |
| `GET /api/wallet` | Wallet balances |
| `GET /api/stats/requests.csv` | Export requests as CSV |

---

## App Structure at a Glance

```
mobile/
├── app/
│   ├── (auth)/          ← Welcome, Login, Sign Up
│   ├── (tabs)/          ← Dashboard, Missions, Profile, Documents
│   ├── request/         ← New Request Stepper + Mission detail screens
│   │   └── [id]/        ← Ongoing, Tracking, Rating, Earnings
│   ├── providers/       ← Provider list & profiles
│   └── wallet.tsx       ← Balance & transactions
├── components/          ← Reusable UI (cards, sheets, buttons)
├── lib/
│   ├── api.ts           ← Axios client with JWT refresh
│   ├── AuthContext.tsx  ← Auth state
│   └── SocketContext.tsx← Real-time Socket.IO provider
└── .env                 ← API URL, Maps key, Stripe key
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App shows "Network Error" | Check ngrok is running and `.env` URL is correct. Restart Expo after editing `.env`. |
| Map not loading | Google Maps API key must be enabled for Maps SDK (iOS + Android) in Google Cloud Console. |
| QR code not scanning | Make sure phone and computer are on the same Wi-Fi, or use the Expo tunnel mode: `npx expo start --tunnel` |
| Socket not connecting | The backend Socket.IO server must be running. Check `http://localhost:3000` responds. |
| DB error on start | Run `npx prisma migrate deploy` again from the `backend/` directory. |
| Blank screen / crash | Check the Expo terminal for errors. Most common: missing `.env` values or wrong API URL. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native 0.81 + Expo 54 |
| Navigation | Expo Router (file-based) |
| Backend | Node.js + Express 5 |
| Database | SQLite via Prisma ORM |
| Real-time | Socket.IO 4 |
| Payments | Stripe (test mode) |
| Maps | Google Maps + Expo Location |
| Auth | JWT + Expo Secure Store |

---

---

# Road to Production

## Where We Are Now

The codebase has a **complete, working skeleton**. The full data model, API routing, auth, real-time layer, payment integration, and all main screens exist. You can demo every core flow end-to-end. What's missing is the layer between "demo-able" and "shippable to real users" — unfinished UI handlers, security gaps, and deployment scaffolding.

```
DEMO-READY          ████████████████████░░░░░░░░░░  ~65%
PRODUCTION-READY    ████████░░░░░░░░░░░░░░░░░░░░░░  ~25%
```

---

## Current State by Area

| Area | Status | Notes |
|------|--------|-------|
| Backend API | ✅ Working | All 37 route modules present, Prisma ORM, Socket.IO |
| Auth (login/signup) | ✅ Working | JWT with refresh, secure storage |
| Client request flow | ✅ Working | Multi-step stepper, location picker, photos |
| Provider accept/complete | ✅ Working | Socket broadcast, mission state machine |
| Real-time tracking | ✅ Working | Socket.IO location updates, map rendering |
| Stripe payments | ⚠️ Test mode only | Test keys, no live key setup |
| Wallet system | ✅ Working | Credit/debit/hold/release, transactions |
| Profile editing | ❌ Stub only | All profile actions show "coming soon" |
| Documents/Invoices | ❌ Stub only | PDF download not wired up |
| In-app messaging | ❌ Not built | TODO in missionview.tsx |
| Push notifications | ❌ Not built | Expo push tokens not configured |
| Admin panel (mobile) | ✅ API exists | No mobile admin UI — API-only |
| Tests | ❌ Zero coverage | Empty test directory |
| Production deployment | ❌ None | No Dockerfile, no CI/CD, no prod env |

---

## Production To-Do List

### 🔴 CRITICAL — Must fix before any real user touches this

- [ ] **Remove MASTER_KEY auth bypass**
  - `backend/middleware/auth.js` — delete the `x-master-key` header bypass entirely
  - Remove `MASTER_KEY` from `.env`
  - Comment in code says "jamais en prod" — it is currently active in prod config

- [ ] **Remove hardcoded Stripe key from source code**
  - `mobile/app/_layout.tsx` line 16 — Stripe publishable key is hardcoded in the file
  - Move to `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` env var (already in `.env`, just not used in layout)

- [ ] **Remove hardcoded ngrok URL from source code**
  - `mobile/lib/api.ts` line 4 — fallback URL points to a personal ngrok tunnel
  - Throw an error if `EXPO_PUBLIC_API_URL` is not set instead of silently falling back

- [ ] **Harden JWT_SECRET fallback**
  - `backend/routes/auth.js` and `backend/middleware/auth.js` both fall back to `"dev"` if `JWT_SECRET` is unset
  - Replace with: `if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required')`

- [ ] **Rotate all API keys** (they are committed to the repo)
  - Google Maps API key
  - Stripe test keys (both secret and publishable)
  - Generate a new strong `JWT_SECRET` for production

- [ ] **Create `.env.example` files** (both `backend/` and `mobile/`) with placeholder values and no real secrets

- [ ] **Assign user role on signup**
  - `backend/routes/auth.js` — new users are created with no role, locking them out of all protected routes
  - Look up the default CLIENT or PROVIDER role by name and attach it at registration time

---

### 🟠 HIGH — Blocks a credible demo or beta

- [ ] **Implement Profile editing**
  - `mobile/app/(tabs)/profile.tsx` — all buttons call `wip()` placeholder
  - Personal info, phone number, banking details, notification preferences all return "en développement"

- [ ] **Wire up invoice/document download**
  - `mobile/components/sheets/TicketDetailSheet.tsx` line 260 — `handleInvoice()` is a TODO
  - Backend generates PDFs via pdfkit — connect the download URL to `Linking.openURL()`

- [ ] **Implement in-app messaging**
  - `mobile/app/request/[id]/missionview.tsx` line 649 — message send is a TODO
  - Backend has a `Message` model in Prisma — API and socket layer need wiring

- [ ] **Implement rating submission**
  - `TicketDetailSheet.tsx` line 254 — `handleRate()` is a TODO comment
  - `POST /api/requests/:id/rating` endpoint exists — call it

- [ ] **Strip all `console.log` from production builds**
  - 70+ instances across `lib/api.ts`, `SocketContext.tsx`, `AuthContext.tsx`
  - Add a babel plugin (`babel-plugin-transform-remove-console`) or wrap in `if (__DEV__)`

- [ ] **Add push notifications**
  - Install `expo-notifications`, register device token on login
  - Backend needs a `pushToken` field on User and a notify helper
  - Key triggers: new request matched, provider accepted, mission completed

- [ ] **Implement reorder flow**
  - `TicketDetailSheet.tsx` line 265 — `handleReorder()` is a TODO
  - Should pre-fill NewRequestStepper with previous category and description

---

### 🟡 MEDIUM — Required for App Store submission

- [ ] **Switch database from SQLite to PostgreSQL**
  - `backend/prisma/schema.prisma` uses `provider = "sqlite"`
  - SQLite has no concurrent write support — will fail under any real load
  - Update schema to `provider = "postgresql"`, update `DATABASE_URL`

- [ ] **Complete EAS build configuration**
  - `mobile/eas.json` is nearly empty — no production profile, no environment secrets
  - Add `production` build profile with `autoIncrement: true` and EAS secrets for all env vars
  - Configure `submit` profile for App Store Connect and Google Play

- [ ] **Add rate limiting to auth routes**
  - `backend/routes/auth.js` — login and signup have no brute-force protection
  - Add `express-rate-limit` middleware on `POST /api/auth/login`

- [ ] **Add error monitoring (Sentry)**
  - Backend: `@sentry/node` on the Express error handler
  - Mobile: `@sentry/react-native` in `app/_layout.tsx`
  - Without this, production crashes are invisible

- [ ] **Add admin audit logs for provider actions**
  - `backend/routes/admin.providers.js` lines 116, 138 — suspend/activate have TODO audit log comments
  - `AdminActionLog` model already exists in Prisma — just write to it

- [ ] **Strengthen password validation**
  - `backend/routes/auth.js` uses `z.string().min(6)` — accepts "123456"
  - Add regex: at least one uppercase, one number, one special character

- [ ] **Fix optional schema fields that should be required**
  - `Request.price` — can be null, will break payment flow
  - `User.phone` — providers need a contact number
  - `Provider.email` — add `@unique` constraint

---

### 🟢 LOW — Post-launch polish

- [ ] **Write tests**
  - `backend/tests/` directory exists but is empty
  - Start with auth endpoints and the request creation + matching flow
  - Use Jest + Supertest for the backend

- [ ] **Remove TypeScript `any` casts**
  - 26+ instances across mobile screens
  - Prevents catching bugs at compile time

- [ ] **Add CI/CD pipeline**
  - Create `.github/workflows/ci.yml`
  - Run lint + tests on every PR
  - Trigger EAS build on merge to `main`

- [ ] **Add a Dockerfile for the backend**
  - Needed for any cloud deployment (Railway, Render, Fly.io, AWS)
  - Include `prisma migrate deploy` in the startup command

- [ ] **Localization / i18n**
  - `backend/i18n/` exists but mobile UI is hardcoded in French
  - Decide: French-only MVP or add i18n from the start

---

## Suggested Sprint Order

```
Sprint 1 — Security & Auth (3–4 days)
  Remove MASTER_KEY bypass
  Fix JWT fallback
  Assign roles on signup
  Rotate and externalize all secrets

Sprint 2 — Complete Core UX (5–7 days)
  Profile editing
  Invoice download
  Rating submission
  In-app messaging (basic)
  Strip console.logs

Sprint 3 — Production Infrastructure (3–5 days)
  Migrate DB to PostgreSQL
  Configure EAS production build
  Add Sentry
  Deploy backend to cloud host (Railway / Render)

Sprint 4 — Store Submission (3–4 days)
  Complete app.json metadata
  EAS build + submit
  App Store / Play Store listing
  TestFlight / internal track testing

Sprint 5 — Hardening (ongoing)
  Add push notifications
  Write tests
  Add CI/CD
  Rate limiting
```

---

## Quick Health Check

Run this after every major change to verify the core flow still works:

```bash
# 1. Backend is alive
curl http://localhost:3000/api/

# 2. Auth works
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mosaic.com","password":"Mosaic@2025"}'

# 3. Categories load (used by NewRequestStepper)
curl http://localhost:3000/api/categories \
  -H "Authorization: Bearer <token_from_step_2>"

# 4. Providers list
curl http://localhost:3000/api/providers \
  -H "Authorization: Bearer <token_from_step_2>"
```
