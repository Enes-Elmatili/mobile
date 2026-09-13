// lib/motion/useCountingValue.ts
// Un montant, un total, un ETA : la valeur COMPTE vers sa cible sur un ressort
// au lieu de sauter. Pas de setState par frame : le texte est poussé dans un
// TextInput via useAnimatedProps (composant ReText).
import { useEffect } from 'react';
import { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function formatCount(value: number, suffix = '', decimals = 0): string {
  'worklet';
  const factor = Math.pow(10, decimals);
  const rounded = Math.round(value * factor) / factor;
  const safe = rounded === 0 ? 0 : rounded; // normalise -0
  const text = decimals > 0 ? safe.toFixed(decimals).replace('.', ',') : String(safe);
  return `${text}${suffix}`;
}

export function useCountingValue(
  target: number,
  opts: { suffix?: string; decimals?: number; preset?: SpringConfig } = {},
) {
  const { suffix = '', decimals = 0, preset = MOTION.count } = opts;
  const reduced = useReduceMotion();
  const value = useSharedValue(target);

  useEffect(() => {
    // Règle 1 : on repart de la valeur courante. Décocher pendant que ça
    // compte redescend d'où c'est.
    value.value = reduced ? target : withSpring(target, preset);
  }, [target, reduced, preset, value]);

  const animatedProps = useAnimatedProps(() => {
    const text = formatCount(value.value, suffix, decimals);
    return { text, defaultValue: text };
  });

  return { value, animatedProps };
}
