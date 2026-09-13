// lib/motion/useEntrance.ts
// Entrée de page : fondu + glissé sur un ressort (MOTION.pane), cross-fade
// seul sous reduce-motion (règle 8). Remplace les quatre lignes
// `Animated.parallel([timing(fade), timing(slide)])` copiées dans chaque
// écran d'auth et d'onboarding.
import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function useEntrance(distance = 16, preset: SpringConfig = MOTION.pane) {
  const reduced = useReduceMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = reduced ? withTiming(1, { duration: 200 }) : withSpring(1, preset);
  }, [p, preset, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: reduced ? [] : [{ translateY: distance * (1 - p.value) }],
  }));

  return { style, progress: p };
}
