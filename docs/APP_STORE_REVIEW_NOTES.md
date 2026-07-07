# FIXED — App Review Notes / Notes pour la review

> **For App Store Connect → App Review Information.** Copiez la section « Sign-In Information » dans les champs dédiés et la section « Review Notes » dans le champ Notes.

---

## 1. What is FIXED? / Présentation

FIXED is an on-demand home-services marketplace (two-sided): **clients** book a local professional (plumbing & locksmith during this beta), **providers** receive the job, travel to the address, complete the work, and get paid. Real-time chat, live provider tracking, in-app calls, and Stripe payments are core features.

- **Beta scope:** service area limited to **Ixelles (Brussels, Belgium)**; services limited to **plumbing & locksmith**.
- **Languages:** French (default), Dutch, English.
- **Payments:** Stripe **LIVE** mode (see §3 — reviewers use a payment-bypassed demo account, no real charge).

---

## 2. Sign-In Information (demo accounts)

Two pre-provisioned demo accounts. Email is already verified (no OTP wall).

| Role | Email | Password |
|------|-------|----------|
| **Client** | `applereview+client@thefixed.app` | `AppleReview!2026` |
| **Provider** | `applereview+provider@thefixed.app` | `AppleReview!2026` |

> Sign in via **Email / Password** (the "Se connecter" screen). Apple/Google sign-in is optional and not required to review.

---

## 3. Payment note (important)

The app runs Stripe in **LIVE** mode, so a reviewer cannot complete a real card payment. The two demo accounts above are on a server-side allowlist that **bypasses the payment step entirely** — no card is charged, and the request is published exactly as it would be after a real payment. **You do not need a test card.** When you reach the payment step with the demo client, the app skips the card sheet and proceeds automatically.

---

## 4. How to test the core flow / Parcours à tester

### A. Client — book a service
1. Log in as the **Client** account.
2. On the dashboard, tap **"Nouvelle demande"** (or the plumbing service card).
3. Choose a category (e.g. **Plomberie**), add a short description, and select the pre-filled **Ixelles** address (`Place Eugène Flagey, 1050 Ixelles`). ⚠️ Keep the address inside Ixelles — outside the beta zone no provider will match.
4. Continue to the summary and confirm. **The payment step is auto-bypassed** (see §3). The request is published.
5. You can now open **Messagerie** to chat, and see the request under **"Mes demandes" / Documents**.

### B. Provider — receive & complete a job
1. Log out, then log in as the **Provider** account (already verified & ACTIVE).
2. On the provider dashboard, toggle **online**.
3. A pre-seeded demo mission (**"fuite sous évier"**, Ixelles) is available under **Opportunités / Missions**. Open it and **Accept**.
4. Follow the mission screen through to **completion** (a 4-digit PIN shown on the client side confirms arrival — for the demo both accounts are yours, so you can read the PIN from the client account if needed).

### C. Other features to exercise
- **Chat:** send messages between the client and provider accounts (real-time).
- **In-app call:** the mission screen exposes a call button (VoIP; grants microphone permission on first use).
- **Profile / Documents / Wallet:** browsable read-only screens.

---

## 5. Permissions the app requests / Permissions demandées

- **Location** — to set the intervention address and show live provider tracking on the map.
- **Microphone** — for in-app voice calls between client and provider.
- **Notifications** — mission updates, new messages, provider offers.
- **Camera / Photos** — attach a photo to a service request and upload provider KYC documents.

None of these are required to complete the basic booking flow above; they can be declined and the review can still proceed.

---

## 6. Notes / Remarques

- The demo accounts are labelled **"ZZ APPLE REVIEW"** in our admin and are removed after approval.
- If a screen looks empty, it usually means you are **outside the Ixelles beta zone** — use the pre-filled Ixelles address.
- Contact for review questions: **support@thefixed.app**.

---

## 7. Internal — how to (re)provision before submitting (not for Apple)

Run against **production** (Railway env), then set the allowlist env var:

```bash
# 1. Seed the demo accounts + one demo mission (additive, idempotent, no data wiped)
railway run --service fixed-backend node scripts/seed-apple-review.js

# 2. On Railway → fixed-backend → Variables, add:
REVIEW_DEMO_EMAILS=applereview+client@thefixed.app,applereview+provider@thefixed.app

# 3. After approval, remove the demo data:
railway run --service fixed-backend node scripts/seed-apple-review.js --cleanup
#    …and delete the REVIEW_DEMO_EMAILS variable.
```

> Fail-safe: if `REVIEW_DEMO_EMAILS` is unset or empty, the payment bypass is fully disabled — real payments are never affected. Only the exact allowlisted emails match.
