// lib/layout/hinge.ts
// Le pont JS de modules/fixed-hinge (iPhone Duo, iOS 27.1). Optionnel : sur un
// build sans le module (Android, Expo Go, ancien dev client, jest), tout
// répond « pas de charnière » et l'app se comporte comme avant.
import { useEffect, useSyncExternalStore } from 'react';
import { requireOptionalNativeModule } from 'expo';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { HingeState } from './posture';

type Subscription = { remove(): void };
type NativeHinge = {
  getState(): HingeState | null;
  getAngle(): number | null;
  addListener(event: 'onChange', listener: (e: { state: HingeState | null }) => void): Subscription;
  addListener(event: 'onAngle', listener: (e: { degrees: number }) => void): Subscription;
};

const Native = requireOptionalNativeModule<NativeHinge>('FixedHinge');

/** `true` quand le binaire embarque le module (build iOS 27.1). */
export const HINGE_SUPPORTED = Native != null;

// ── Posture : magasin externe, un seul abonnement natif partagé ─────────────
const listeners = new Set<() => void>();
let nativeSub: Subscription | null = null;
let snapshot: HingeState | undefined;

function same(a: HingeState | undefined, b: HingeState | undefined): boolean {
  if (!a || !b) return a === b;
  const fa = a.fold, fb = b.fold;
  if (a.posture !== b.posture) return false;
  if (!fa || !fb) return !fa && !fb;
  return fa.x === fb.x && fa.y === fb.y && fa.width === fb.width && fa.height === fb.height && fa.separating === fb.separating;
}

function accept(next: HingeState | null | undefined): boolean {
  const value = next ?? undefined;
  if (same(snapshot, value)) return false;
  snapshot = value;
  return true;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (Native && !nativeSub) {
    nativeSub = Native.addListener('onChange', (e) => { if (accept(e.state)) listeners.forEach((l) => l()); });
    if (accept(Native.getState())) onChange();
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && nativeSub) { nativeSub.remove(); nativeSub = null; }
  };
}

function getSnapshot(): HingeState | undefined {
  if (Native && !nativeSub) accept(Native.getState());
  return snapshot;
}

const getServerSnapshot = () => undefined;

/** Posture et pli courants ; `undefined` sans charnière. Re-rend au changement de posture ou de pli. */
export function useHinge(): HingeState | undefined {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * L'angle en degrés (180 = à plat) dans une shared value : il pilote des
 * effets sur le thread UI sans re-rendre React. Reste à 180 sans charnière.
 */
export function useHingeAngle(): SharedValue<number> {
  const angle = useSharedValue(Native?.getAngle() ?? 180);
  useEffect(() => {
    if (!Native) return;
    const sub = Native.addListener('onAngle', (e) => { angle.value = e.degrees; });
    return () => sub.remove();
  }, [angle]);
  return angle;
}

/** Tests uniquement : remet le magasin à zéro. */
export function __resetHingeStore() {
  listeners.clear();
  nativeSub?.remove();
  nativeSub = null;
  snapshot = undefined;
}
