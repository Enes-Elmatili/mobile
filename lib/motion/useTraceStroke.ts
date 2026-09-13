// lib/motion/useTraceStroke.ts
// Un trait SVG qui se dessine : coche de paiement, sceau de devis.
// react-native-svg ne connaît pas `pathLength` : on passe la longueur réelle
// du tracé (`length`), le path porte strokeDasharray={length}, et on anime
// strokeDashoffset de `length` (invisible) à 0 (tracé).
import { useEffect } from 'react';
import { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function useTraceStroke(drawn: boolean, opts: { preset?: SpringConfig; length?: number } = {}) {
  const { preset = MOTION.trace, length = 1 } = opts;
  const reduced = useReduceMotion();
  const offset = useSharedValue(drawn ? 0 : length);

  useEffect(() => {
    const target = drawn ? 0 : length;
    offset.value = reduced ? target : withSpring(target, preset);
  }, [drawn, reduced, preset, offset, length]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return { animatedProps, offset };
}
