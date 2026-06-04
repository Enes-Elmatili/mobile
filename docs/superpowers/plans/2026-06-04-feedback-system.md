# Unified Feedback System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one imperative, semantic feedback layer (haptic + in-app toast + sound + Reanimated celebration + themed confirm sheet) callable from anywhere, then migrate every ad-hoc `Haptics.*` (105 calls) and `Alert.alert` (87 calls / 25 files) onto it.

**Architecture:** A singleton `feedback` API backed by a zustand store. A single `<FeedbackHost/>` mounted at the root renders toasts, the celebration overlay, and the confirm sheet off that store. An event map (`events.ts`) translates semantic event names into multi-channel responses. A persisted preference store + OS Reduce-Motion flag gate each channel. The pre-existing emitter toast (`showSocketToast`) is absorbed so there is exactly one toast renderer.

**Tech Stack:** React Native / Expo Router, zustand v5, `@react-native-async-storage/async-storage`, `react-native-reanimated` v4, `expo-haptics`, `expo-av` (existing `useSoundManager`), `@gorhom/bottom-sheet` v5, `react-i18next`, Feather icons. Tests: `jest-expo` + `@testing-library/react-native` (added in Task 1).

**Spec:** `docs/superpowers/specs/2026-06-04-feedback-system-design.md`

**Conventions (must follow):**
- Theme via `useAppTheme()` / `darkTokens` from `@/hooks/use-app-theme`; colors from `COLORS` (`greenBrand`, `orangeBrand`, `red`). Zero hardcoded color values in components.
- Fonts from `FONTS` (`bebas`, `sans`, `sansMedium`).
- All user-facing strings via i18n keys (FR/NL/EN). Engine resolves keys with `i18n.t(...)` at fire-time.
- Feather icons only, zero emoji.
- Haptics/sounds always wrapped so a failure never throws (existing `.catch(() => {})` pattern).

---

## File Structure

| File | Responsibility | Status |
|------|----------------|--------|
| `lib/feedback/events.ts` | Event → channel map + i18n key refs + types | Create |
| `lib/feedback/store.ts` | zustand store: toast queue, active celebration, active confirm | Create |
| `lib/feedback/feedback.ts` | Imperative API: gating, queue push, confirm promise, sound registration | Create |
| `stores/feedbackPrefs.ts` | Persisted prefs (sound/haptics/animations) + runtime reduceMotion | Create |
| `components/feedback/Toast.tsx` | Single toast pill renderer (Reanimated) | Create |
| `components/feedback/CelebrationOverlay.tsx` | Reanimated burst overlay | Create |
| `components/feedback/ConfirmSheet.tsx` | Promise-based themed bottom-sheet confirm | Create |
| `components/feedback/FeedbackHost.tsx` | Mounts the three renderers + registers sound manager | Create |
| `hooks/useSoundManager.ts` | Existing sound manager — extend keys only if needed | Modify |
| `lib/SocketContext.tsx` | Make `showSocketToast` delegate to engine; remove `SocketToastLayer` | Modify |
| `app/_layout.tsx` | Mount `<FeedbackHost/>` once near root | Modify |
| `app/settings/notifications.tsx` | Add Sound/Haptics/Animations toggles | Modify |
| `locales/{fr,nl,en}.json` | Add `feedback` namespace | Modify |
| `components/SquishButton.tsx`, `components/haptic-tab.tsx` | Route press haptic through engine | Modify |
| ~25 screen files | Migrate `Haptics.*` and `Alert.alert` | Modify |

---

## Phase 0 — Test infrastructure

### Task 1: Add jest-expo test runner

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `jest.setup.js`

- [ ] **Step 1: Install dev dependencies**

```bash
cd mobile
npx expo install -- --save-dev jest-expo jest @testing-library/react-native @types/jest
```

- [ ] **Step 2: Add test script to `package.json`**

In the `"scripts"` block, add:

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 3: Create `jest.config.js`**

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@gorhom/.*|react-native-reanimated))',
  ],
};
```

- [ ] **Step 4: Create `jest.setup.js`**

```js
// Reanimated mock (ships with the library)
require('react-native-reanimated').setUpTests?.();

// Silence native modules used by the feedback layer
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
```

- [ ] **Step 5: Create a smoke test to prove the runner works**

Create `lib/feedback/__tests__/smoke.test.ts`:

```ts
test('jest runner is wired up', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Run it**

Run: `cd mobile && npm test -- smoke`
Expected: PASS, 1 test.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json jest.config.js jest.setup.js lib/feedback/__tests__/smoke.test.ts
git commit -m "test: add jest-expo runner for feedback system"
```

---

## Phase 1 — State & engine (TDD)

### Task 2: Preference store

**Files:**
- Create: `stores/feedbackPrefs.ts`
- Test: `stores/__tests__/feedbackPrefs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFeedbackPrefs, FEEDBACK_PREFS_KEY } from '../feedbackPrefs';

beforeEach(async () => {
  await AsyncStorage.clear();
  act(() => useFeedbackPrefs.setState({ sound: true, haptics: true, animations: true, reduceMotion: false, hydrated: false }));
});

test('defaults are all-on', () => {
  const s = useFeedbackPrefs.getState();
  expect(s.sound).toBe(true);
  expect(s.haptics).toBe(true);
  expect(s.animations).toBe(true);
  expect(s.reduceMotion).toBe(false);
});

test('setPref persists to AsyncStorage', async () => {
  await act(async () => { useFeedbackPrefs.getState().setPref('sound', false); });
  const raw = await AsyncStorage.getItem(FEEDBACK_PREFS_KEY);
  expect(JSON.parse(raw!).sound).toBe(false);
});

test('hydrate loads persisted prefs', async () => {
  await AsyncStorage.setItem(FEEDBACK_PREFS_KEY, JSON.stringify({ sound: false, haptics: true, animations: false }));
  await act(async () => { await useFeedbackPrefs.getState().hydrate(); });
  const s = useFeedbackPrefs.getState();
  expect(s.sound).toBe(false);
  expect(s.animations).toBe(false);
  expect(s.hydrated).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npm test -- feedbackPrefs`
Expected: FAIL — cannot find module `../feedbackPrefs`.

- [ ] **Step 3: Implement the store**

Create `stores/feedbackPrefs.ts`:

```ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FEEDBACK_PREFS_KEY = '@fixed:feedback:prefs';

export type FeedbackPrefKey = 'sound' | 'haptics' | 'animations';

interface FeedbackPrefsState {
  sound: boolean;
  haptics: boolean;
  animations: boolean;
  reduceMotion: boolean; // runtime, from AccessibilityInfo
  hydrated: boolean;
  setPref: (key: FeedbackPrefKey, value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
  hydrate: () => Promise<void>;
}

export const useFeedbackPrefs = create<FeedbackPrefsState>((set, get) => ({
  sound: true,
  haptics: true,
  animations: true,
  reduceMotion: false,
  hydrated: false,

  setPref: (key, value) => {
    set({ [key]: value } as Pick<FeedbackPrefsState, FeedbackPrefKey>);
    const { sound, haptics, animations } = get();
    AsyncStorage.setItem(FEEDBACK_PREFS_KEY, JSON.stringify({ sound, haptics, animations })).catch(() => {});
  },

  setReduceMotion: (value) => set({ reduceMotion: value }),

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(FEEDBACK_PREFS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        set({
          sound: p.sound ?? true,
          haptics: p.haptics ?? true,
          animations: p.animations ?? true,
        });
      }
    } catch {
      // keep defaults
    } finally {
      set({ hydrated: true });
    }
  },
}));
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd mobile && npm test -- feedbackPrefs`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add stores/feedbackPrefs.ts stores/__tests__/feedbackPrefs.test.ts
git commit -m "feat: persisted feedback preference store"
```

---

### Task 3: Event map

**Files:**
- Create: `lib/feedback/events.ts`
- Test: `lib/feedback/__tests__/events.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { FEEDBACK_EVENTS, FeedbackEventName } from '../events';

test('every event has a valid tier and channels', () => {
  const tiers = ['micro', 'standard', 'celebration'];
  for (const [name, def] of Object.entries(FEEDBACK_EVENTS)) {
    expect(tiers).toContain(def.tier);
    if (def.haptic) expect(['light','medium','heavy','selection','success','warning','error']).toContain(def.haptic);
    if (def.toast) expect(['success','error','info']).toContain(def.toast.type);
    if (def.tier === 'celebration') {
      expect(def.celebrate).toBeDefined();
      expect(def.toast).toBeDefined();
    }
  }
});

test('key milestone events exist', () => {
  const required: FeedbackEventName[] = ['quote_accepted','payment_received','mission_complete','quote_refused','error_generic','tap_primary'];
  for (const r of required) expect(FEEDBACK_EVENTS[r]).toBeDefined();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npm test -- events`
Expected: FAIL — cannot find module `../events`.

- [ ] **Step 3: Implement the event map**

Create `lib/feedback/events.ts`:

```ts
export type HapticKind = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';
export type ToastType = 'success' | 'error' | 'info';
export type CelebrationKind = 'burst';
export type SoundKey = 'newMission' | 'missionAccepted' | 'paymentReceived' | 'providerFound';

export interface FeedbackEventDef {
  tier: 'micro' | 'standard' | 'celebration';
  haptic?: HapticKind;
  sound?: SoundKey;
  /** i18n key resolved at fire-time; type drives accent + icon */
  toast?: { type: ToastType; messageKey: string };
  /** i18n key for the big celebration title */
  celebrate?: { kind: CelebrationKind; titleKey: string };
}

export const FEEDBACK_EVENTS = {
  // ── micro (haptic only) ──
  tap_primary:   { tier: 'micro', haptic: 'light' },
  tap_select:    { tier: 'micro', haptic: 'selection' },
  tap_heavy:     { tier: 'micro', haptic: 'medium' },

  // ── standard (haptic + toast) ──
  quote_sent:    { tier: 'standard', haptic: 'success', toast: { type: 'success', messageKey: 'feedback.events.quote_sent' } },
  quote_refused: { tier: 'standard', haptic: 'warning', toast: { type: 'info',    messageKey: 'feedback.events.quote_refused' } },
  new_mission:   { tier: 'standard', haptic: 'medium', sound: 'newMission', toast: { type: 'info', messageKey: 'feedback.events.new_mission' } },
  provider_found:{ tier: 'standard', haptic: 'success', sound: 'providerFound', toast: { type: 'success', messageKey: 'feedback.events.provider_found' } },
  saved:         { tier: 'standard', haptic: 'success', toast: { type: 'success', messageKey: 'feedback.events.saved' } },
  error_generic: { tier: 'standard', haptic: 'error',  toast: { type: 'error',   messageKey: 'feedback.events.error_generic' } },

  // ── celebration (haptic + sound + toast + overlay) ──
  quote_accepted:  { tier: 'celebration', haptic: 'success', sound: 'missionAccepted', toast: { type: 'success', messageKey: 'feedback.events.quote_accepted' }, celebrate: { kind: 'burst', titleKey: 'feedback.celebrate.quote_accepted' } },
  payment_received:{ tier: 'celebration', haptic: 'success', sound: 'paymentReceived', toast: { type: 'success', messageKey: 'feedback.events.payment_received' }, celebrate: { kind: 'burst', titleKey: 'feedback.celebrate.payment_received' } },
  mission_complete:{ tier: 'celebration', haptic: 'success', sound: 'missionAccepted', toast: { type: 'success', messageKey: 'feedback.events.mission_complete' }, celebrate: { kind: 'burst', titleKey: 'feedback.celebrate.mission_complete' } },
} satisfies Record<string, FeedbackEventDef>;

export type FeedbackEventName = keyof typeof FEEDBACK_EVENTS;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd mobile && npm test -- events`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/feedback/events.ts lib/feedback/__tests__/events.test.ts
git commit -m "feat: feedback semantic event map"
```

---

### Task 4: Feedback store (toast queue + active celebration + active confirm)

**Files:**
- Create: `lib/feedback/store.ts`
- Test: `lib/feedback/__tests__/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { useFeedbackStore } from '../store';

beforeEach(() => useFeedbackStore.setState({ toasts: [], celebration: null, confirm: null }));

test('pushToast appends a toast with id', () => {
  useFeedbackStore.getState().pushToast({ type: 'success', message: 'Hi' });
  const { toasts } = useFeedbackStore.getState();
  expect(toasts).toHaveLength(1);
  expect(toasts[0].message).toBe('Hi');
  expect(typeof toasts[0].id).toBe('number');
});

test('dismissToast removes by id', () => {
  const s = useFeedbackStore.getState();
  s.pushToast({ type: 'info', message: 'A' });
  const id = useFeedbackStore.getState().toasts[0].id;
  s.dismissToast(id);
  expect(useFeedbackStore.getState().toasts).toHaveLength(0);
});

test('toast queue is capped at 3', () => {
  const s = useFeedbackStore.getState();
  for (let i = 0; i < 5; i++) s.pushToast({ type: 'info', message: `m${i}` });
  expect(useFeedbackStore.getState().toasts.length).toBeLessThanOrEqual(3);
});

test('setCelebration / clearCelebration', () => {
  const s = useFeedbackStore.getState();
  s.setCelebration({ kind: 'burst', title: 'Yes!' });
  expect(useFeedbackStore.getState().celebration?.title).toBe('Yes!');
  s.clearCelebration();
  expect(useFeedbackStore.getState().celebration).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npm test -- store`
Expected: FAIL — cannot find module `../store`.

- [ ] **Step 3: Implement the store**

Create `lib/feedback/store.ts`:

```ts
import { create } from 'zustand';
import type { ToastType, CelebrationKind } from './events';

export interface ToastItem { id: number; type: ToastType; message: string }
export interface CelebrationItem { kind: CelebrationKind; title: string }
export interface ConfirmItem {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
}

const TOAST_CAP = 3;
let nextId = 1;

interface FeedbackStoreState {
  toasts: ToastItem[];
  celebration: CelebrationItem | null;
  confirm: ConfirmItem | null;
  pushToast: (t: Omit<ToastItem, 'id'>) => number;
  dismissToast: (id: number) => void;
  setCelebration: (c: CelebrationItem) => void;
  clearCelebration: () => void;
  setConfirm: (c: ConfirmItem) => void;
  clearConfirm: () => void;
}

export const useFeedbackStore = create<FeedbackStoreState>((set) => ({
  toasts: [],
  celebration: null,
  confirm: null,

  pushToast: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-TOAST_CAP) }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  setCelebration: (c) => set({ celebration: c }),
  clearCelebration: () => set({ celebration: null }),
  setConfirm: (c) => set({ confirm: c }),
  clearConfirm: () => set({ confirm: null }),
}));
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd mobile && npm test -- store`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/feedback/store.ts lib/feedback/__tests__/store.test.ts
git commit -m "feat: feedback zustand store (toast queue, celebration, confirm)"
```

---

### Task 5: Engine — gating + dispatch

**Files:**
- Create: `lib/feedback/feedback.ts`
- Test: `lib/feedback/__tests__/feedback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import * as Haptics from 'expo-haptics';
import { feedback, __setSoundPlayer } from '../feedback';
import { useFeedbackStore } from '../store';
import { useFeedbackPrefs } from '../../../stores/feedbackPrefs';

const playMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  __setSoundPlayer(playMock);
  useFeedbackStore.setState({ toasts: [], celebration: null, confirm: null });
  useFeedbackPrefs.setState({ sound: true, haptics: true, animations: true, reduceMotion: false, hydrated: true });
});

test('celebration event fires all enabled channels', () => {
  feedback.event('quote_accepted');
  expect(Haptics.notificationAsync).toHaveBeenCalled();
  expect(playMock).toHaveBeenCalledWith('missionAccepted');
  expect(useFeedbackStore.getState().toasts).toHaveLength(1);
  expect(useFeedbackStore.getState().celebration).not.toBeNull();
});

test('haptics pref off skips haptic', () => {
  useFeedbackPrefs.setState({ haptics: false });
  feedback.event('tap_primary');
  expect(Haptics.impactAsync).not.toHaveBeenCalled();
});

test('sound pref off skips sound but keeps toast', () => {
  useFeedbackPrefs.setState({ sound: false });
  feedback.event('quote_accepted');
  expect(playMock).not.toHaveBeenCalled();
  expect(useFeedbackStore.getState().toasts).toHaveLength(1);
});

test('animations off (or reduceMotion) downgrades celebration to toast only', () => {
  useFeedbackPrefs.setState({ animations: false });
  feedback.event('quote_accepted');
  expect(useFeedbackStore.getState().celebration).toBeNull();
  expect(useFeedbackStore.getState().toasts).toHaveLength(1);
});

test('confirm resolves true when confirmed', async () => {
  const p = feedback.confirm({ titleKey: 'x', confirmKey: 'ok', cancelKey: 'no' });
  useFeedbackStore.getState().confirm!.resolve(true);
  await expect(p).resolves.toBe(true);
});

test('success/info/error wrappers push the right toast type', () => {
  feedback.success('feedback.events.saved');
  feedback.error('feedback.events.error_generic');
  const types = useFeedbackStore.getState().toasts.map(t => t.type);
  expect(types).toEqual(['success', 'error']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile && npm test -- feedback.test`
Expected: FAIL — cannot find module `../feedback`.

- [ ] **Step 3: Implement the engine**

Create `lib/feedback/feedback.ts`:

```ts
import * as Haptics from 'expo-haptics';
import i18n from '../i18n';
import { FEEDBACK_EVENTS, FeedbackEventName, HapticKind, ToastType, SoundKey } from './events';
import { useFeedbackStore } from './store';
import { useFeedbackPrefs } from '../../stores/feedbackPrefs';

// Sound player is registered at runtime by FeedbackHost (useSoundManager is a hook).
let soundPlayer: ((key: SoundKey) => void) | null = null;
export function __setSoundPlayer(fn: ((key: SoundKey) => void) | null) { soundPlayer = fn; }

function fireHaptic(kind: HapticKind) {
  try {
    switch (kind) {
      case 'light':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); break;
      case 'medium': Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); break;
      case 'heavy':  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); break;
      case 'selection': Haptics.selectionAsync(); break;
      case 'success': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); break;
      case 'warning': Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); break;
      case 'error':   Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); break;
    }
  } catch { /* never block UX */ }
}

function pushToast(type: ToastType, messageKey: string, fallback?: string) {
  const message = fallback ?? i18n.t(messageKey);
  useFeedbackStore.getState().pushToast({ type, message });
}

export const feedback = {
  event(name: FeedbackEventName) {
    const def = FEEDBACK_EVENTS[name];
    if (!def) { if (__DEV__) console.warn(`[feedback] unknown event ${name}`); return; }
    const prefs = useFeedbackPrefs.getState();

    if (def.haptic && prefs.haptics) fireHaptic(def.haptic);
    if (def.sound && prefs.sound && soundPlayer) soundPlayer(def.sound);
    if (def.toast) pushToast(def.toast.type, def.toast.messageKey);

    const animationsOk = prefs.animations && !prefs.reduceMotion;
    if (def.celebrate && animationsOk) {
      useFeedbackStore.getState().setCelebration({ kind: def.celebrate.kind, title: i18n.t(def.celebrate.titleKey) });
    }
  },

  haptic(kind: HapticKind) {
    if (useFeedbackPrefs.getState().haptics) fireHaptic(kind);
  },

  /** Direct toast — message may be an i18n key or a literal string. */
  toast(message: string, type: ToastType = 'info') {
    const resolved = i18n.exists(message) ? i18n.t(message) : message;
    useFeedbackStore.getState().pushToast({ type, message: resolved });
  },

  success(messageKey: string) { this.haptic('success'); this.toast(messageKey, 'success'); },
  info(messageKey: string)    { this.toast(messageKey, 'info'); },
  error(messageKey: string)   { this.haptic('error'); this.toast(messageKey, 'error'); },

  confirm(opts: { titleKey: string; messageKey?: string; confirmKey: string; cancelKey: string; destructive?: boolean }): Promise<boolean> {
    if (useFeedbackPrefs.getState().haptics) fireHaptic('warning');
    return new Promise<boolean>((resolve) => {
      useFeedbackStore.getState().setConfirm({
        title: i18n.t(opts.titleKey),
        message: opts.messageKey ? i18n.t(opts.messageKey) : undefined,
        confirmLabel: i18n.t(opts.confirmKey),
        cancelLabel: i18n.t(opts.cancelKey),
        destructive: !!opts.destructive,
        resolve,
      });
    });
  },
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd mobile && npm test -- feedback.test`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/feedback/feedback.ts lib/feedback/__tests__/feedback.test.ts
git commit -m "feat: feedback engine with channel gating + confirm promise"
```

---

## Phase 2 — Visual layer (manual device verification)

### Task 6: Toast component

**Files:**
- Create: `components/feedback/Toast.tsx`

- [ ] **Step 1: Implement the toast renderer**

Create `components/feedback/Toast.tsx`:

```tsx
import React, { useEffect } from 'react';
import { StyleSheet, Text, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { ToastItem, useFeedbackStore } from '@/lib/feedback/store';

const ICON: Record<ToastItem['type'], keyof typeof Feather.glyphMap> = {
  success: 'check-circle', error: 'x-circle', info: 'info',
};
const ACCENT: Record<ToastItem['type'], string> = {
  success: COLORS.greenBrand, error: COLORS.red, info: COLORS.orangeBrand,
};

export function Toast({ item }: { item: ToastItem }) {
  const progress = useSharedValue(0);
  const dismiss = useFeedbackStore((s) => s.dismissToast);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(1, { duration: 280, easing: Easing.out(Easing.back(1.4)) }),
      withDelay(2500, withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(dismiss)(item.id);
      })),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -16 }],
  }));

  return (
    <Animated.View style={[s.pill, { borderLeftColor: ACCENT[item.type] }, style]}>
      <Feather name={ICON[item.type]} size={18} color={ACCENT[item.type]} />
      <Text style={s.text} numberOfLines={2}>{item.message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: darkTokens.surface,
    borderRadius: 14, borderLeftWidth: 3,
    paddingHorizontal: 16, paddingVertical: 13,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  text: { flex: 1, color: darkTokens.text, fontFamily: FONTS.sansMedium, fontSize: 14 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/feedback/Toast.tsx
git commit -m "feat: feedback toast component"
```

---

### Task 7: Celebration overlay

**Files:**
- Create: `components/feedback/CelebrationOverlay.tsx`

- [ ] **Step 1: Implement the overlay**

Create `components/feedback/CelebrationOverlay.tsx`:

```tsx
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS, Easing } from 'react-native-reanimated';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { CelebrationItem, useFeedbackStore } from '@/lib/feedback/store';

const PARTICLES = 12;

export function CelebrationOverlay({ item }: { item: CelebrationItem }) {
  const { width, height } = useWindowDimensions();
  const clear = useFeedbackStore((s) => s.clearCelebration);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(clear)();
    });
    const fallback = setTimeout(() => clear(), 1400);
    return () => clearTimeout(fallback);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ scale: 0.2 + t.value * 2.6 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : (t.value > 0.8 ? (1 - t.value) / 0.2 : 1),
    transform: [{ translateY: (1 - t.value) * 12 }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none">
      <Animated.View style={[s.ring, { borderColor: COLORS.greenBrand }, ringStyle]} />
      {Array.from({ length: PARTICLES }).map((_, i) => (
        <Particle key={i} index={i} t={t} cx={width / 2} cy={height / 2} />
      ))}
      <Animated.Text style={[s.title, titleStyle]}>{item.title}</Animated.Text>
    </View>
  );
}

function Particle({ index, t, cx, cy }: { index: number; t: Animated.SharedValue<number>; cx: number; cy: number }) {
  const angle = (index / PARTICLES) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const r = t.value * 150;
    return {
      opacity: 1 - t.value,
      transform: [
        { translateX: Math.cos(angle) * r },
        { translateY: Math.sin(angle) * r },
        { scale: 1 - t.value * 0.5 },
      ],
    };
  });
  const color = index % 2 === 0 ? COLORS.greenBrand : COLORS.orangeBrand;
  return <Animated.View style={[s.dot, { backgroundColor: color }, style]} />;
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  title: { position: 'absolute', top: '40%', color: darkTokens.text, fontFamily: FONTS.bebas, fontSize: 34, letterSpacing: 1, textAlign: 'center', paddingHorizontal: 24 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/feedback/CelebrationOverlay.tsx
git commit -m "feat: feedback celebration overlay"
```

---

### Task 8: Confirm sheet

**Files:**
- Create: `components/feedback/ConfirmSheet.tsx`

- [ ] **Step 1: Implement the confirm sheet**

Create `components/feedback/ConfirmSheet.tsx`. Mirrors the existing `@gorhom/bottom-sheet` usage in `components/sheets/QuoteSheet.tsx`.

```tsx
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useFeedbackStore } from '@/lib/feedback/store';

export function ConfirmSheet() {
  const confirm = useFeedbackStore((s) => s.confirm);
  const clear = useFeedbackStore((s) => s.clearConfirm);
  const ref = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();
  const snapPoints = useMemo(() => ['auto'] as const, []);

  // resolve(false) if the user dismisses without choosing
  const settle = useCallback((ok: boolean) => {
    confirm?.resolve(ok);
    clear();
  }, [confirm, clear]);

  useEffect(() => {
    if (confirm) ref.current?.expand();
    else ref.current?.close();
  }, [confirm]);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />,
    [],
  );

  if (!confirm) return null;

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: darkTokens.border }}
      backgroundStyle={{ backgroundColor: darkTokens.surface }}
      onClose={() => { if (useFeedbackStore.getState().confirm) settle(false); }}
    >
      <BottomSheetView style={[s.body, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={s.title}>{confirm.title}</Text>
        {!!confirm.message && <Text style={s.message}>{confirm.message}</Text>}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: confirm.destructive ? COLORS.danger : darkTokens.accent }]}
          onPress={() => settle(true)}
        >
          <Text style={[s.btnText, { color: confirm.destructive ? COLORS.alwaysWhite : darkTokens.accentText }]}>{confirm.confirmLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.cancelBtn} onPress={() => settle(false)}>
          <Text style={s.cancelText}>{confirm.cancelLabel}</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  title: { color: darkTokens.text, fontFamily: FONTS.bebas, fontSize: 26, letterSpacing: 0.5 },
  message: { color: darkTokens.textSub, fontFamily: FONTS.sans, fontSize: 15, lineHeight: 21 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnText: { fontFamily: FONTS.sansMedium, fontSize: 16 },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelText: { color: darkTokens.textMuted, fontFamily: FONTS.sansMedium, fontSize: 15 },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/feedback/ConfirmSheet.tsx
git commit -m "feat: themed promise-based confirm sheet"
```

---

### Task 9: FeedbackHost + mount + sound registration + reduceMotion

**Files:**
- Create: `components/feedback/FeedbackHost.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Implement the host**

Create `components/feedback/FeedbackHost.tsx`:

```tsx
import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, AccessibilityInfo } from 'react-native';
import { useFeedbackStore } from '@/lib/feedback/store';
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { useSoundManager } from '@/hooks/useSoundManager';
import { __setSoundPlayer } from '@/lib/feedback/feedback';
import { Toast } from './Toast';
import { CelebrationOverlay } from './CelebrationOverlay';
import { ConfirmSheet } from './ConfirmSheet';

export function FeedbackHost() {
  const toasts = useFeedbackStore((s) => s.toasts);
  const celebration = useFeedbackStore((s) => s.celebration);
  const { play } = useSoundManager();
  const setReduceMotion = useFeedbackPrefs((s) => s.setReduceMotion);
  const hydrate = useFeedbackPrefs((s) => s.hydrate);

  // Register the sound player into the singleton engine.
  useEffect(() => { __setSoundPlayer(play); return () => __setSoundPlayer(null); }, [play]);

  // Hydrate prefs + subscribe to OS reduce-motion.
  useEffect(() => {
    hydrate();
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  return (
    <>
      <View style={s.toastStack} pointerEvents="box-none">
        {toasts.map((t) => <Toast key={t.id} item={t} />)}
      </View>
      {celebration && <CelebrationOverlay item={celebration} />}
      <ConfirmSheet />
    </>
  );
}

const s = StyleSheet.create({
  toastStack: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 20, right: 20, zIndex: 9999, gap: 8,
  },
});
```

- [ ] **Step 2: Mount it in `app/_layout.tsx`**

In the root `RootLayout` return tree (currently ends around line 244-263), add the import at the top:

```tsx
import { FeedbackHost } from '@/components/feedback/FeedbackHost';
```

Then place `<FeedbackHost />` as the LAST child inside `<GestureHandlerRootView>` so it overlays everything (it must be inside GestureHandlerRootView for the bottom sheet, and after `NetworkProvider` so it sits on top):

```tsx
      <GestureHandlerRootView style={styles.container}>
        <NetworkProvider>
          <StripeProvider /* ...existing props... */ >
            <AuthProvider>
              <OfflineQueueProvider>
                <SocketProvider>
                  <CallProvider>
                    <IncomingCallOverlay />
                    <RootLayoutNav />
                  </CallProvider>
                </SocketProvider>
              </OfflineQueueProvider>
            </AuthProvider>
          </StripeProvider>
        </NetworkProvider>
        <FeedbackHost />
      </GestureHandlerRootView>
```

(Keep the existing children exactly as they are; only add the import and the `<FeedbackHost />` line. The bottom sheet needs a `BottomSheetModalProvider`-free setup since we use plain `BottomSheet`, which works under `GestureHandlerRootView` alone.)

- [ ] **Step 3: Verify it builds & smoke-test on device**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new type errors.

Manual (device/simulator): temporarily add a debug button that calls `feedback.event('quote_accepted')` and confirm: haptic fires, sound plays, toast slides in top, celebration burst shows, all auto-dismiss. Remove the debug button after.

- [ ] **Step 4: Commit**

```bash
git add components/feedback/FeedbackHost.tsx app/_layout.tsx
git commit -m "feat: mount FeedbackHost, register sound + reduce-motion"
```

---

### Task 10: Absorb the existing `showSocketToast`

**Files:**
- Modify: `lib/SocketContext.tsx`

**Goal:** one toast renderer. Make `showSocketToast` delegate to the engine and delete the now-duplicate `SocketToastLayer` (and its emitter/styles) so the ~40 existing `showSocketToast(...)` call sites keep working unchanged.

- [ ] **Step 1: Replace the toast block in `lib/SocketContext.tsx`**

Delete the TOAST SYSTEM block (lines ~64-160: `type ToastType`, `socketToastEmitter`, `showSocketToast`, `SocketToastLayer`, the `ts` StyleSheet). Replace with a thin shim:

```ts
// ─── Toast — delegates to the unified feedback engine (single renderer) ───────
import { feedback } from '@/lib/feedback/feedback';
type ToastType = 'success' | 'error' | 'info';

export function showSocketToast(message: string, type: ToastType = 'info') {
  feedback.toast(message, type);
}
```

(Place the `import { feedback }` with the other top-of-file imports, not mid-file.)

- [ ] **Step 2: Remove the `<SocketToastLayer />` render**

At the provider return (around line 699), delete the `<SocketToastLayer />` line. Remove now-unused imports (`Animated`, `Easing`, `darkTokens` if only used by the deleted layer — verify with grep before removing).

Run: `cd mobile && grep -n "SocketToastLayer\|socketToastEmitter" lib/SocketContext.tsx`
Expected: no matches.

- [ ] **Step 3: Verify build & existing call sites still type-check**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors. The ~40 `showSocketToast(...)` calls compile unchanged.

- [ ] **Step 4: Commit**

```bash
git add lib/SocketContext.tsx
git commit -m "refactor: route showSocketToast through unified feedback engine"
```

---

## Phase 3 — i18n + settings

### Task 11: Add the `feedback` i18n namespace

**Files:**
- Modify: `locales/fr.json`, `locales/nl.json`, `locales/en.json`

- [ ] **Step 1: Add the `feedback` key to `locales/fr.json`**

Add this top-level key (sibling of `common`, `auth`, …):

```json
"feedback": {
  "events": {
    "quote_sent": "Devis envoyé",
    "quote_refused": "Devis refusé",
    "new_mission": "Nouvelle mission disponible",
    "provider_found": "Prestataire trouvé",
    "saved": "Enregistré",
    "error_generic": "Une erreur est survenue",
    "quote_accepted": "Devis accepté",
    "payment_received": "Paiement reçu",
    "mission_complete": "Mission terminée"
  },
  "celebrate": {
    "quote_accepted": "Devis accepté !",
    "payment_received": "Paiement reçu !",
    "mission_complete": "Mission terminée !"
  },
  "settings": {
    "section": "Retour & sons",
    "sound": "Sons",
    "sound_sub": "Effets sonores lors des actions",
    "haptics": "Vibrations",
    "haptics_sub": "Retour haptique au toucher",
    "animations": "Animations",
    "animations_sub": "Célébrations et effets visuels"
  }
}
```

- [ ] **Step 2: Add the same key to `locales/nl.json`**

```json
"feedback": {
  "events": {
    "quote_sent": "Offerte verzonden",
    "quote_refused": "Offerte geweigerd",
    "new_mission": "Nieuwe opdracht beschikbaar",
    "provider_found": "Vakman gevonden",
    "saved": "Opgeslagen",
    "error_generic": "Er is een fout opgetreden",
    "quote_accepted": "Offerte geaccepteerd",
    "payment_received": "Betaling ontvangen",
    "mission_complete": "Opdracht voltooid"
  },
  "celebrate": {
    "quote_accepted": "Offerte geaccepteerd!",
    "payment_received": "Betaling ontvangen!",
    "mission_complete": "Opdracht voltooid!"
  },
  "settings": {
    "section": "Feedback & geluid",
    "sound": "Geluiden",
    "sound_sub": "Geluidseffecten bij acties",
    "haptics": "Trillingen",
    "haptics_sub": "Haptische feedback bij aanraking",
    "animations": "Animaties",
    "animations_sub": "Vieringen en visuele effecten"
  }
}
```

- [ ] **Step 3: Add the same key to `locales/en.json`**

```json
"feedback": {
  "events": {
    "quote_sent": "Quote sent",
    "quote_refused": "Quote refused",
    "new_mission": "New job available",
    "provider_found": "Provider found",
    "saved": "Saved",
    "error_generic": "Something went wrong",
    "quote_accepted": "Quote accepted",
    "payment_received": "Payment received",
    "mission_complete": "Job completed"
  },
  "celebrate": {
    "quote_accepted": "Quote accepted!",
    "payment_received": "Payment received!",
    "mission_complete": "Job done!"
  },
  "settings": {
    "section": "Feedback & sound",
    "sound": "Sounds",
    "sound_sub": "Sound effects on actions",
    "haptics": "Haptics",
    "haptics_sub": "Touch feedback",
    "animations": "Animations",
    "animations_sub": "Celebrations and visual effects"
  }
}
```

- [ ] **Step 4: Validate JSON**

Run: `cd mobile && node -e "['fr','nl','en'].forEach(l=>{const o=require('./locales/'+l+'.json'); if(!o.feedback) throw new Error('missing feedback in '+l); console.log(l,'ok')})"`
Expected: `fr ok / nl ok / en ok`.

- [ ] **Step 5: Commit**

```bash
git add locales/fr.json locales/nl.json locales/en.json
git commit -m "i18n: add feedback namespace (fr/nl/en)"
```

---

### Task 12: Settings toggles

**Files:**
- Modify: `app/settings/notifications.tsx`

- [ ] **Step 1: Wire the preference store into the screen**

At the top of `app/settings/notifications.tsx`, add imports:

```tsx
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { feedback } from '@/lib/feedback/feedback';
```

- [ ] **Step 2: Add a "Feedback & sound" section using the existing `ToggleRow`**

Inside the `ScrollView`, after the existing notification toggles, add a new section. Reuse the screen's existing section/`ToggleRow` markup pattern (match surrounding styles):

```tsx
{/* ── Feedback & sound ── */}
<Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{t('feedback.settings.section')}</Text>
<View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
  <ToggleRow
    icon="volume-2"
    label={t('feedback.settings.sound')}
    sublabel={t('feedback.settings.sound_sub')}
    value={sound}
    onToggle={(v) => { setPref('sound', v); feedback.haptic('selection'); }}
  />
  <ToggleRow
    icon="smartphone"
    label={t('feedback.settings.haptics')}
    sublabel={t('feedback.settings.haptics_sub')}
    value={haptics}
    onToggle={(v) => { setPref('haptics', v); if (v) feedback.haptic('selection'); }}
  />
  <ToggleRow
    icon="zap"
    label={t('feedback.settings.animations')}
    sublabel={t('feedback.settings.animations_sub')}
    value={animations}
    onToggle={(v) => { setPref('animations', v); feedback.haptic('selection'); }}
  />
</View>
```

Add the store reads near the top of the component body (where other hooks are):

```tsx
const sound = useFeedbackPrefs((s) => s.sound);
const haptics = useFeedbackPrefs((s) => s.haptics);
const animations = useFeedbackPrefs((s) => s.animations);
const setPref = useFeedbackPrefs((s) => s.setPref);
```

(If `styles.sectionTitle` / `styles.card` names differ in this file, use the file's actual section-wrapper style names — check the existing notification section markup and mirror it exactly.)

- [ ] **Step 3: Verify on device**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors.
Manual: toggle each switch, kill & relaunch the app, confirm the toggles retain their state (AsyncStorage persistence) and that disabling Sound/Haptics/Animations actually suppresses those channels.

- [ ] **Step 4: Commit**

```bash
git add app/settings/notifications.tsx
git commit -m "feat: feedback settings toggles (sound/haptics/animations)"
```

---

## Phase 4 — Migration sweep

> **Migration recipe (apply in every Phase-4 task):**
>
> 1. **Ad-hoc haptics →** semantic calls. Map by intent:
>    - `Haptics.impactAsync(...Light)` on a button press → `feedback.haptic('light')` (or `feedback.event('tap_primary')`).
>    - `Haptics.selectionAsync()` → `feedback.haptic('selection')`.
>    - `Haptics.notificationAsync(...Success)` that accompanies a success message → fold into the matching `feedback.event(...)` or `feedback.success(key)` (don't double-fire haptic + success wrapper).
>    - `Haptics.notificationAsync(...Error)` → fold into `feedback.error(key)`.
> 2. **Single-button `Alert.alert(title, msg)` (message) →** `feedback.success/info/error('<i18n key>')`. Reuse the existing i18n key already passed to the alert; pick type by intent (error keys → `error`, confirmations of success → `success`, neutral → `info`).
> 3. **Multi-button `Alert.alert(title, msg, [{...}, {style:'cancel'}])` (decision) →**
>    ```tsx
>    const ok = await feedback.confirm({
>      titleKey: '<title key>', messageKey: '<msg key>',
>      confirmKey: '<confirm label key>', cancelKey: 'common.cancel',
>      destructive: true, // when the confirm button was style:'destructive'
>    });
>    if (!ok) return;
>    // ...the old onPress handler body of the confirm button...
>    ```
>    Add any missing confirm/cancel label keys to all three locale files in the same commit.
> 4. Remove the now-unused `import * as Haptics from 'expo-haptics'` and `Alert` import from each file once all usages are gone.
> 5. **Verify per file:** `grep -n "Haptics\.\|Alert.alert" <file>` returns no matches (except intentional kept cases — there should be none), and `npx tsc --noEmit` is clean.
>
> Keep edits mechanical and behavior-preserving. Do NOT add feedback to polling loops or socket reconnection paths (see regression watch in the spec).

### Task 13: Migrate auth flow

**Files (modify):** `app/(auth)/signup.tsx`, `login.tsx`, `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`, `complete-profile.tsx`, `role-select.tsx`

- [ ] **Step 1:** Apply the migration recipe to each file above (haptics → `feedback.*`, alerts → toast/confirm).
- [ ] **Step 2:** Add any new confirm/cancel i18n keys used, to `fr/nl/en`.
- [ ] **Step 3:** Verify.

Run: `cd mobile && grep -rn "Haptics\.\|Alert.alert" app/\(auth\)` → expect no matches. Then `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add app/\(auth\) locales/*.json
git commit -m "refactor: migrate auth flow to feedback engine"
```

---

### Task 14: Migrate client tabs

**Files (modify):** `app/(tabs)/dashboard.tsx`, `documents.tsx`, `profile.tsx`, `wallet.tsx`

- [ ] **Step 1:** Apply the migration recipe to each file.
- [ ] **Step 2:** Add any new i18n keys.
- [ ] **Step 3:** Verify.

Run: `cd mobile && grep -rn "Haptics\.\|Alert.alert" app/\(tabs\)/dashboard.tsx app/\(tabs\)/documents.tsx app/\(tabs\)/profile.tsx app/\(tabs\)/wallet.tsx` → no matches. `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/dashboard.tsx" "app/(tabs)/documents.tsx" "app/(tabs)/profile.tsx" "app/(tabs)/wallet.tsx" locales/*.json
git commit -m "refactor: migrate client tabs to feedback engine"
```

---

### Task 15: Migrate provider tabs

**Files (modify):** `app/(tabs)/provider-dashboard.tsx`, `opportunities.tsx`, `missions.tsx`, plus `app/wallet.tsx`, `app/subscription.tsx`

- [ ] **Step 1:** Apply the migration recipe. Note `missions.tsx` already imports `i18n` and uses sounds — fold its success/error haptics into events (e.g. `new_mission`, `quote_sent`).
- [ ] **Step 2:** Add any new i18n keys.
- [ ] **Step 3:** Verify.

Run: `cd mobile && grep -rn "Haptics\.\|Alert.alert" "app/(tabs)/provider-dashboard.tsx" "app/(tabs)/opportunities.tsx" "app/(tabs)/missions.tsx" app/wallet.tsx app/subscription.tsx` → no matches. `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add "app/(tabs)/provider-dashboard.tsx" "app/(tabs)/opportunities.tsx" "app/(tabs)/missions.tsx" app/wallet.tsx app/subscription.tsx locales/*.json
git commit -m "refactor: migrate provider tabs to feedback engine"
```

---

### Task 16: Migrate request lifecycle

**Files (modify):** all of `app/request/[id]/*.tsx` (`missionview`, `ongoing`, `tracking`, `early`, `scheduled`, `quote-pending`, `quote-review`, `resume-payment`, `send-quote`, `rating`) + `app/request/NewRequestStepper.tsx` + `app/request/list.tsx`

This is the largest group (most `Alert.alert` calls, incl. the confirm-style ones in `ongoing.tsx`, `tracking.tsx`, `missionview.tsx`, `early.tsx`, `scheduled.tsx`, `quote-pending.tsx`).

- [ ] **Step 1:** Apply the migration recipe file-by-file. Map milestone moments to celebration events:
  - quote accepted (after `confirmPayment` succeeds in `quote-review.tsx`) → `feedback.event('quote_accepted')`.
  - payment received → `feedback.event('payment_received')`.
  - mission completed (rating / ongoing completion) → `feedback.event('mission_complete')`.
  - Convert "Cancel mission?" / "Refuse quote?" alerts → `feedback.confirm({ destructive: true, ... })`.
- [ ] **Step 2:** Add new i18n keys.
- [ ] **Step 3:** Verify.

Run: `cd mobile && grep -rn "Haptics\.\|Alert.alert" "app/request"` → no matches. `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add app/request locales/*.json
git commit -m "refactor: migrate request lifecycle to feedback engine (+ milestone celebrations)"
```

---

### Task 17: Migrate remaining screens

**Files (modify):** `app/support.tsx`, `app/notifications.tsx`, `app/tickets/[id].tsx`, `app/settings/privacy.tsx`, `app/settings/notifications.tsx` (any leftover alerts), and any other file still matching.

- [ ] **Step 1:** Find every remaining file:

Run: `cd mobile && grep -rl "Haptics\.\|Alert.alert" app`
Apply the recipe to each file listed (excluding files already done).

- [ ] **Step 2:** Add new i18n keys.
- [ ] **Step 3:** Verify.

Run: `cd mobile && grep -rln "Alert.alert" app | grep -v "components/feedback"` → expect empty (every Alert migrated). `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add app locales/*.json
git commit -m "refactor: migrate remaining screens to feedback engine"
```

---

### Task 18: Route shared press components through the engine

**Files:**
- Modify: `components/SquishButton.tsx`, `components/haptic-tab.tsx`

- [ ] **Step 1: `SquishButton.tsx` — replace direct `Haptics.impactAsync` with the gated engine**

In `handlePress`, replace the `Haptics.impactAsync(map[haptic])...` block with:

```tsx
import { feedback } from '@/lib/feedback/feedback';
// ...
if (haptic !== 'none') feedback.haptic(haptic); // 'light' | 'medium' | 'heavy'
```

Remove the now-unused `import * as Haptics from 'expo-haptics'` and the `map` object.

- [ ] **Step 2: `haptic-tab.tsx` — route through the engine**

Replace the `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)` call with:

```tsx
import { feedback } from '@/lib/feedback/feedback';
// ...
if (process.env.EXPO_OS === 'ios') feedback.haptic('light');
```

Remove the unused `expo-haptics` import.

- [ ] **Step 3: Verify**

Run: `cd mobile && grep -n "expo-haptics" components/SquishButton.tsx components/haptic-tab.tsx` → no matches. `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add components/SquishButton.tsx components/haptic-tab.tsx
git commit -m "refactor: SquishButton + HapticTab use gated feedback haptics"
```

---

### Task 19: Final verification sweep

- [ ] **Step 1: Confirm no ad-hoc feedback remains outside the feedback layer**

Run:
```bash
cd mobile
echo "Stray Alert.alert:"; grep -rln "Alert.alert" app || echo "none"
echo "Stray Haptics outside feedback lib:"; grep -rln "expo-haptics\|Haptics\." app components | grep -v "lib/feedback" || echo "none"
```
Expected: `none` for both (all routed through the engine).

- [ ] **Step 2: Full type check + tests**

Run: `cd mobile && npx tsc --noEmit && npm test`
Expected: type check clean; all feedback unit tests pass.

- [ ] **Step 3: Device dogffood checklist**

On a real device, walk the beta journey and confirm feedback at each step:
- create request → tap haptics + toasts
- callout payment success → toast
- quote accepted → celebration burst + sound + haptic + toast
- payment received → celebration
- mission complete → celebration
- refuse/cancel actions → themed confirm sheet (not native Alert)
- Settings: toggle Sound/Haptics/Animations off → confirm each channel is suppressed
- Enable OS Reduce Motion → confirm celebration overlay is skipped (toast still shows)

- [ ] **Step 4: Commit (if any fixes from dogfooding)**

```bash
git add -A
git commit -m "fix: feedback dogfooding adjustments"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** events layer (T3) ✓, engine + gating (T5) ✓, prefs store (T2) ✓, toast (T6) ✓, celebration (T7) ✓, confirm sheet (T8) ✓, host/mount/sound/reduceMotion (T9) ✓, absorb existing toast (T10) ✓, settings UI (T12) + i18n (T11) ✓, full migration incl. SquishButton/HapticTab (T13–T18) ✓, verification (T19) ✓. Test-infra gap in the codebase handled by T1.
- **Type consistency:** `feedback.event/haptic/toast/success/info/error/confirm`, `__setSoundPlayer`, store methods (`pushToast/dismissToast/setCelebration/clearCelebration/setConfirm/clearConfirm`), `useFeedbackPrefs` (`setPref/setReduceMotion/hydrate`, `FEEDBACK_PREFS_KEY`), `FEEDBACK_EVENTS/FeedbackEventName` — all names used consistently across tasks.
- **Placeholders:** none — every code step has real code; migration tasks carry a concrete recipe + exact file lists + grep verification.
- **Scope:** single coherent feature; large only due to the explicit "migrate everything" decision, sequenced as independent commits.
