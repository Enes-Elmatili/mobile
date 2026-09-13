// components/searching/BreathingRings.tsx
// Anneaux de recherche. Pas une boucle mécanique : la période s'allonge avec
// le temps (1,6 s → 2,8 s sur 90 s) et l'amplitude grandit. Le mouvement dit
// « on cherche encore, c'est normal ». Une seule instance à l'écran.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useLayoutClass } from '@/lib/layout';
import { useReduceMotion } from '@/lib/motion/sheet';

const RING_COUNT = 4;
const PHASES = [0, 0.25, 0.5, 0.75];

function periodAt(elapsedSec: number) {
  'worklet';
  return 1.6 + Math.min(1.2, (elapsedSec / 90) * 1.2);
}

function Ring({ index, elapsed, size, color, reduced }: { index: number; elapsed: SharedValue<number>; size: number; color: string; reduced: boolean }) {
  const style = useAnimatedStyle(() => {
    const t = elapsed.value;
    const p = (t / periodAt(t) + PHASES[index]) % 1;
    const eased = 1 - Math.pow(1 - p, 2);
    const grow = 1 + Math.min(0.6, (t / 90) * 0.6);
    return {
      opacity: reduced ? 0.35 * (1 - p) : (1 - p) * 0.9,
      transform: [{ scale: 0.15 + eased * 0.85 * grow }],
    };
  });
  return <Animated.View style={[s.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]} />;
}

export function BreathingRings({ color, active = true }: { color: string; active?: boolean }) {
  const { width } = useLayoutClass();
  const reduced = useReduceMotion();
  const size = Math.min(width * 0.85, 480);
  const elapsed = useSharedValue(0);

  useFrameCallback((frame) => {
    elapsed.value += (frame.timeSincePreviousFrame ?? 16) / 1000;
  }, active);

  return (
    <View pointerEvents="none" style={s.wrap}>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <Ring key={i} index={i} elapsed={elapsed} size={size} color={color} reduced={reduced} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 1.5 },
});
