// lib/motion/useRubberPull.ts
// Pull-to-refresh : le logo s'étire avec le tirage (élastique), claque en
// place au relâchement pendant que la liste se rafraîchit.
import { useCallback, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { hapticOnFrame } from './haptics';
import { MOTION } from './springs';
import { useReduceMotion } from './sheet';

export function useRubberPull(opts: { threshold?: number; holdAt?: number; onRefresh: () => Promise<void> | void }) {
  const { threshold = 64, holdAt = 56, onRefresh } = opts;
  const reduced = useReduceMotion();
  const y = useSharedValue(0);
  const armed = useSharedValue(0);

  const refresh = useCallback(async () => {
    try {
      await onRefresh();
    } finally {
      y.value = withSpring(0, MOTION.pull);
    }
  }, [onRefresh, y]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onBegin(() => {
          armed.value = 0;
        })
        .onUpdate((e) => {
          const d = Math.max(0, e.translationY);
          // Résistance croissante : 80 pt de tirage réel ≈ 60 pt affichés.
          y.value = reduced ? Math.min(d, threshold) : 80 * (1 - Math.exp(-d / 96)) * 1.6;
          if (!armed.value && y.value >= threshold) {
            armed.value = 1;
            hapticOnFrame('light');
          }
        })
        .onEnd((e) => {
          if (armed.value) {
            y.value = withSpring(holdAt, { ...MOTION.pull, velocity: e.velocityY });
            runOnJS(refresh)();
          } else {
            y.value = withSpring(0, { ...MOTION.pull, velocity: e.velocityY });
          }
        }),
    [reduced, threshold, holdAt, y, armed, refresh],
  );

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const logoStyle = useAnimatedStyle(() => {
    const p = Math.min(1, y.value / 80);
    return {
      opacity: Math.min(1, y.value / 30),
      transform: [{ translateY: y.value * 0.9 }, { scaleY: 1 + p * 0.35 }, { scaleX: 1 - p * 0.08 }],
    };
  });

  return { gesture, contentStyle, logoStyle };
}
