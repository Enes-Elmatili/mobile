// lib/motion/useTraceStroke.ts
// Un trait SVG qui se dessine : coche de paiement, sceau de devis. Le path
// porte pathLength="1" et strokeDasharray="1" ; on anime strokeDashoffset de
// 1 (invisible) à 0 (tracé).
import { useEffect } from 'react';
import { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function useTraceStroke(drawn: boolean, opts: { preset?: SpringConfig } = {}) {
  const { preset = MOTION.trace } = opts;
  const reduced = useReduceMotion();
  const offset = useSharedValue(drawn ? 0 : 1);

  useEffect(() => {
    const target = drawn ? 0 : 1;
    offset.value = reduced ? target : withSpring(target, preset);
  }, [drawn, reduced, preset, offset]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return { animatedProps, offset };
}
