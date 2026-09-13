// lib/motion/useLoops.ts
// Boucles décoratives et petits réflexes partagés par les écrans d'attente :
//   usePulse  → un point / un chip qui pulse tant qu'on attend
//   useGlow   → le halo des écrans sombres (onboarding, attente de devis)
//   useBlink  → le curseur d'un champ OTP
//   useShake  → « non » : impulsion sur un ressort sous-amorti (code faux)
// Toutes s'arrêtent sous reduce-motion (règle 8) et s'annulent au démontage.
import { useCallback, useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { spring } from './springs';
import { useReduceMotion } from './sheet';

/** Opacité qui va et vient entre 1 et `min` tant que `active`. */
export function usePulse(active = true, { min = 0.35, duration = 1000 }: { min?: number; duration?: number } = {}) {
  const reduced = useReduceMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: 150 });
      return;
    }
    opacity.value = withRepeat(
      withSequence(withTiming(min, { duration }), withTiming(1, { duration })),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [active, reduced, min, duration, opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/** Halo qui respire : opacité `minOpacity` → 1 et échelle 1 → `scale`, aller-retour. */
export function useGlow({ scale = 1.1, minOpacity = 0.5, duration = 3000 }: { scale?: number; minOpacity?: number; duration?: number } = {}) {
  const reduced = useReduceMotion();
  const g = useSharedValue(0);
  useEffect(() => {
    if (reduced) { g.value = 0.5; return; }
    g.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(g);
  }, [g, reduced, duration]);
  return useAnimatedStyle(() => ({
    opacity: minOpacity + (1 - minOpacity) * g.value,
    transform: [{ scale: 1 + (scale - 1) * g.value }],
  }));
}

/** Curseur : visible `on` ms, invisible `off` ms. Sans transition (un curseur ne fond pas). */
export function useBlink({ on = 600, off = 500 }: { on?: number; off?: number } = {}) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withDelay(on, withTiming(0, { duration: 0 })),
        withDelay(off, withTiming(1, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, on, off]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/**
 * Secousse « non » : une impulsion de vitesse sur un ressort sous-amorti
 * (ζ = 0,18) — trois ou quatre oscillations qui s'éteignent en ~0,3 s,
 * pic ≈ 8 pt. Interruptible : une seconde erreur relance depuis la position
 * courante (règle 1). Sous reduce-motion : rien (le message d'erreur suffit).
 */
const SHAKE_SPRING = { ...spring(2500, 0.18), velocity: -530 };
export function useShake() {
  const reduced = useReduceMotion();
  const x = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const shake = useCallback(() => {
    if (reduced) return;
    x.value = withSpring(0, SHAKE_SPRING);
  }, [reduced, x]);
  return { style, shake };
}
