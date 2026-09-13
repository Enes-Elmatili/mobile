// lib/motion/useDigitReel.ts
// Chaque chiffre est un rouleau vertical 0-9 ; un changement de valeur fait
// tourner le rouleau sur un ressort. Un changement du NOMBRE de chiffres
// (9 → 10) reconstruit sans animer : le mouvement doit rester lisible.
import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { spring } from './springs';
import { useReduceMotion } from './sheet';

export const REEL_SPRING = spring(200, 1.0);

export function splitDigits(value: number | string): number[] {
  const m = String(value).match(/\d+/);
  if (!m) return [];
  return [...m[0]].map((c) => parseInt(c, 10));
}

export function useDigitReel(digit: number, lineHeight: number) {
  const reduced = useReduceMotion();
  const pos = useSharedValue(digit);
  useEffect(() => {
    pos.value = reduced ? digit : withSpring(digit, REEL_SPRING);
  }, [digit, reduced, pos]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: -pos.value * lineHeight }] }));
}
