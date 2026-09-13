// lib/motion/useRevealCount.ts
// react-native-maps <Polyline> n'a pas de dashoffset : on révèle les points
// progressivement. La progression est un ressort sur le thread UI ; le nombre
// de points visibles ne redescend en JS que lorsqu'il change (≤ 60/s).
import { useEffect, useState } from 'react';
import { runOnJS, useAnimatedReaction, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function revealIndex(progress: number, total: number): number {
  'worklet';
  const p = Math.min(1, Math.max(0, progress));
  return Math.min(total, Math.ceil(p * total));
}

export function useRevealCount(total: number, revealed: boolean, opts: { preset?: SpringConfig } = {}) {
  const { preset = MOTION.trace } = opts;
  const reduced = useReduceMotion();
  const progress = useSharedValue(revealed ? 1 : 0);
  const [count, setCount] = useState(revealed ? total : 0);

  useEffect(() => {
    const target = revealed ? 1 : 0;
    progress.value = reduced ? target : withSpring(target, preset);
  }, [revealed, reduced, preset, progress]);

  useAnimatedReaction(
    () => revealIndex(progress.value, total),
    (next, prev) => {
      if (next !== prev) runOnJS(setCount)(next);
    },
    [total],
  );

  return count;
}
