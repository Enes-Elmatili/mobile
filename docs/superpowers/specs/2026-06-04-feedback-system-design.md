# Unified Feedback System — Design Spec

**Date:** 2026-06-04
**Status:** Approved, ready for implementation plan
**Scope:** `mobile/` (React Native / Expo Router)

## Goal

Give FIXED users continuous, Duolingo-style feedback for everything they do, so an
action never feels silent or uncertain. The system serves two jobs as one coherent
layer:

1. **Responsiveness** — every tap/action instantly confirms "something happened"
   (haptic + subtle in-app toast + button feedback). Replaces jarring blocking
   `Alert.alert` popups with smooth in-app toasts.
2. **Delight** — milestone moments (quote accepted, payment received, mission
   completed) escalate to a celebration (sound + animated overlay).

## Decisions (locked)

- **One unified semantic system** (not two separate features).
- **Rollout: everything** — build the engine AND migrate every ad-hoc `Haptics.*`
  call and every `Alert.alert` across all screens.
- **Confirmations** become a custom dark-themed bottom sheet (not native Alert).
- **User controls + accessibility**: persisted Sound / Haptics / Animations toggles,
  plus auto-respect of the OS "Reduce Motion" setting and the silent switch.
- **Architecture: imperative singleton** callable from anywhere (components, API
  layer, socket handlers, stores) — not a hook-only approach.
- **No new dependencies.** Celebrations built with Reanimated. Reuses existing
  `@gorhom/bottom-sheet` v5, `expo-haptics`, `expo-av`, AsyncStorage, zustand v5,
  Feather icons, `react-i18next`.

## Design constraints (from project design charter)

- Dark-first: bg `#0A0A0A`, surface `#111111`.
- Typography: Bebas Neue (display/titles), DM Sans (body).
- Accents: white `#F4F4F2`, amber (devis/diagnostic), muted green (prix fixe);
  red reserved for errors/destructive.
- Feather SVG icons only — zero emoji.
- Always use the theme hook (`useAppTheme` / tokens) — zero hardcoded values.
- All user-facing text via i18n (FR / NL / EN) — no literal strings.

## Architecture

### 1. Semantic event layer — `lib/feedback/events.ts`

Single source of truth mapping each app event to its multi-channel response.
Three tiers:

- **micro** — haptic only (every tap / selection).
- **standard** — haptic + toast.
- **celebration** — haptic + sound + toast + Reanimated overlay.

Example mapping:

```
tap_primary      → { haptic: 'light' }
tap_select       → { haptic: 'selection' }
quote_accepted   → { haptic: 'success', sound: 'missionAccepted', toast: 'success', celebrate: 'burst' }
payment_received → { haptic: 'success', sound: 'paymentReceived', toast: 'success', celebrate: 'burst' }
mission_complete → { haptic: 'success', sound: 'missionAccepted', toast: 'success', celebrate: 'burst' }
quote_refused    → { haptic: 'warning', toast: 'info' }
quote_sent       → { haptic: 'success', toast: 'success' }
new_mission      → { haptic: 'medium', sound: 'newMission', toast: 'info' }
provider_found   → { haptic: 'success', sound: 'providerFound', toast: 'success' }
error_generic    → { haptic: 'error', toast: 'error' }
```

Each event references an i18n key for its toast/celebration text. The event map is
the contract the rest of the app codes against — call sites name an *event*, not a
channel.

### 2. Core engine — `lib/feedback/feedback.ts`

Imperative API backed by a zustand store (the toast queue + active celebration).
Callable from anywhere:

```
feedback.event('quote_accepted')        // fires the full mapped response
feedback.success(messageKey?)           // convenience wrappers
feedback.error(messageKey?)
feedback.info(messageKey?)
feedback.celebrate('quote_accepted')    // force celebration tier
feedback.confirm({ titleKey, messageKey, confirmKey, destructive }) // → Promise<boolean>
feedback.haptic('light')                // raw escape hatch
```

Behavior:
- Before each fire, reads the preference store + runtime `reduceMotion` flag and
  gates channels accordingly (sound off → skip sound; animations off or reduceMotion
  → skip celebration overlay, fall back to toast; haptics off → skip haptic).
- Resolves toast/celebration text via i18n keys.
- Haptics & sounds wrapped in try/catch — never block UX, simulator-safe (matches
  existing `.catch(() => {})` pattern).
- Toast queue: max 1 visible; subsequent toasts queue and show in order.

### 3. Preference store — `stores/feedbackPrefs.ts`

Zustand + AsyncStorage persistence:

```
{ sound: boolean, haptics: boolean, animations: boolean }   // all default true, persisted
reduceMotion: boolean                                       // runtime, from AccessibilityInfo
```

- Hydrates from AsyncStorage on app start.
- Subscribes to `AccessibilityInfo` reduce-motion changes and updates `reduceMotion`.

### 4. Visual host — `components/feedback/FeedbackHost.tsx`

Mounted once near the root of `app/_layout.tsx` (inside the gesture/theme providers).
Renders three things off the store:

- **Toast** — top-anchored card, surface `#111`, Feather icon (check / info / alert /
  x), DM Sans text, left accent stripe (green = success, amber = info/warning,
  red = error). Reanimated slide-down + fade in, auto-dismiss ~2.5s, swipe-up to
  dismiss early. Respects safe-area top inset.
- **Celebration overlay** — full-screen, non-blocking (taps pass through via
  `pointerEvents="none"`). Reanimated burst: expanding accent ring + radiating
  particle dots + large Bebas Neue title. ~1.2s lifecycle then auto-clears. Skipped
  entirely when animations off or reduceMotion on (degrades to toast).

### 5. Themed confirm sheet — `components/feedback/ConfirmSheet.tsx`

`@gorhom/bottom-sheet` v5, dark themed per charter. Title (Bebas Neue) + message
(DM Sans) + two buttons. `destructive: true` renders a red confirm button. Driven by
the store; `feedback.confirm({...})` resolves its `Promise<boolean>` on button press
or dismiss (dismiss = false). Warning haptic fires on open. Keeps call sites as clean
as the old `Alert.alert` confirm pattern.

### 6. Sound — extend `hooks/useSoundManager.ts`

Reuse the existing preloaded sound manager. Add new `SoundKey`s only if a celebration
event needs a sound not already covered. The engine gates all playback on the `sound`
preference. The manager is wired into the engine (e.g. registered on mount in
`FeedbackHost`) so `feedback.event(...)` can trigger sounds.

### 7. Settings UI — `app/settings/notifications.tsx`

Add three toggles: **Sound**, **Haptics**, **Animations**, bound to the preference
store. i18n labels added to FR / NL / EN locale files. Each toggle fires a `selection`
haptic on change (when haptics still enabled) for immediate self-demonstrating
feedback.

### 8. Migration sweep

Replace, in batches per screen group, verified by grep so no instance is missed:

- Every ad-hoc `Haptics.*` call → semantic `feedback.event(...)` / `feedback.haptic(...)`.
- Info / success / error `Alert.alert` (single-button messages) → `feedback.success/info/error`.
- Yes/No `Alert.alert` (decision prompts, e.g. cancel mission, refuse quote) →
  `await feedback.confirm({...})`.
- `SquishButton` and `HapticTab` route their press haptic through the engine
  (so the global haptics toggle governs them too).

Batch order (by area):
1. Auth flow (`app/(auth)/*`)
2. Client tabs (`app/(tabs)/dashboard`, `documents`, `profile`, `wallet`)
3. Provider tabs (`provider-dashboard`, `opportunities`, `missions`, `wallet`)
4. Request lifecycle (`app/request/**` — stepper, quote, mission, tracking, ongoing, rating)
5. Settings / support / misc.

## Units & boundaries

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `events.ts` | Event → channel map + i18n keys | (nothing) |
| `feedback.ts` | Imperative API, gating, queue | events, prefs store, sound manager, store |
| `feedbackPrefs.ts` | Persisted prefs + reduceMotion | AsyncStorage, AccessibilityInfo |
| `FeedbackHost.tsx` | Renders toast + celebration; registers sound manager | feedback store, Reanimated, theme |
| `ConfirmSheet.tsx` | Promise-based themed confirm | bottom-sheet, feedback store, theme |
| settings toggles | User control surface | prefs store, i18n |

Each unit is independently understandable and testable. Call sites depend only on the
`feedback.*` API and event names — never on channels directly.

## Error handling

- Haptics/sounds: try/catch, silent failure (never block or surface errors).
- Missing i18n key: fall back to a generic key; log in `__DEV__` only.
- Toast queue overflow: bounded queue; oldest non-visible dropped if queue exceeds a
  small cap.
- Confirm sheet dismissed without choice: resolves `false`.

## Testing

- Unit: gating logic (each pref off → correct channels skipped), reduceMotion fallback,
  confirm promise resolution (confirm/cancel/dismiss), toast queue ordering.
- Manual / device: haptic feel per tier, sound playback respecting silent switch,
  celebration visual on a real device, swipe-to-dismiss, settings toggles persist
  across app restart.

## Out of scope (this pass)

- Backend/server-driven feedback.
- New sound asset design beyond existing four (add keys only if a celebration needs one).
- Gamification (streaks, XP, badges) — feedback layer only.

## Regression watch (do not reintroduce)

- Do not couple feedback to polling or socket reconnection logic (see known
  regressions: polling-on-terminal-status, socket dedup, socket reconnection).