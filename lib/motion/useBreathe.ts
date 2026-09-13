// lib/motion/useBreathe.ts
// Un bloc qui « respire » une fois à la réception d'une valeur (1,03 → 1).
// Dit « ça vient de changer » sans toast.
import { useCallback } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion } from './sheet';

export function useBreathe(amplitude = 1.03) {
  const reduced = useReduceMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const pulse = useCallback(() => {
    if (reduced) return;
    scale.value = amplitude;
    scale.value = withSpring(1, MOTION.breathe);
  }, [reduced, amplitude, scale]);
  return { style, pulse };
}
