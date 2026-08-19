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

## 3-bis. Apple Pay (Guideline 2.1 — PassKit)

**The app does integrate Apple Pay.** It is offered as a payment method inside the Stripe PaymentSheet (Stripe iOS SDK), which is where the PassKit framework is used.

**Where Apple Pay appears in the app:**

> The app is localised FR / NL / EN and follows the device language. On an English-language device all labels below appear exactly as written.

| # | Screen | How to reach it |
|---|--------|-----------------|
| 1 | Booking flow — **Step 4 "Review · Payment & summary"** | Dashboard → **New request** → Step 1 *Location* → Step 2 *Service* → Step 3 *Schedule* → Step 4 *Review* → **Confirm mission** (fixed-price) or **Book · €XX** (quote/diagnostic) |
| 2 | **Resume payment** for an unpaid request | Dashboard → a request marked *Payment pending* → **Resume payment** → **PAY NOW** |
| 3 | **Quote acceptance** (estimate/diagnostic services) | Dashboard → a request marked *Quote received* → **View quote** → **ACCEPT** |

In all three, the Stripe PaymentSheet opens and **Apple Pay is the first payment method listed**, above card / Bancontact / Klarna / Revolut Pay.

**⚠️ Why a reviewer may not see it:**

1. **The demo accounts in §2 bypass the payment step** (see §3). Because Stripe runs in LIVE mode, we cannot let a reviewer trigger a real charge, so the allowlisted demo client skips the PaymentSheet entirely — and therefore never displays Apple Pay. This is the single most likely reason Apple Pay could not be located.
2. **Apple Pay is hidden when no card is provisioned in Wallet.** The Stripe SDK only renders the Apple Pay row if the device has an eligible card set up in the Wallet app. On a review device with an empty Wallet, the row does not appear even when the sheet opens.

**To verify Apple Pay directly (no charge, no new build required):**

The payment bypass applies **only** to the two allowlisted demo emails in §2. Any account created by the reviewer is not on that list and therefore reaches the real Stripe payment sheet.

1. On the sign-up screen, tap **Continue with Apple** — one tap, no email code required (Apple/Google sign-in is auto-verified server-side).
2. Complete the short profile form (name, phone, address). Use the address below.
3. Dashboard → **New request** → address **`Place Eugène Flagey, 1050 Ixelles`** ⚠️ mandatory: the beta service area only accepts postal codes **1050 / 1060 / 1180**; any other address blocks the flow.
4. Pick a service → a time slot → **Step 4 "Review"** → tap **Confirm mission**.
5. The Stripe payment sheet opens with **Apple Pay listed first**.
6. Tap **Cancel**. **Nothing is charged** — the PaymentIntent is only confirmed if the payment is completed. Simply opening the sheet is enough to verify the Apple Pay integration.

Alternatively, reply in Resolution Center and we will remove the demo account from the bypass allowlist within one business day (server-side config, no new build).

**Technical references (v1.0):**
- Merchant ID: `merchant.app.thefixed` — entitlement `com.apple.developer.in-app-payments`
- `@stripe/stripe-react-native` `StripeProvider` configured with `merchantIdentifier="merchant.app.thefixed"`
- `initPaymentSheet({ applePay: { merchantCountryCode: 'BE' }, … })` at all payment call sites

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
