// lib/motion/useTakeScale.ts
// Un objet qui « prend » : marqueur sélectionné (1 → 1,35), étoile finale,
// icône d'onglet (0,9 → 1), atterrissage (0 → 1). Léger dépassement voulu.
import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export function useTakeScale(
  active: boolean,
  opts: { on?: number; off?: number; preset?: SpringConfig } = {},
) {
  const { on = 1.35, off = 1, preset = MOTION.take } = opts;
  const reduced = useReduceMotion();
  const scale = useSharedValue(active ? on : off);

  useEffect(() => {
    const target = active ? on : off;
    // Règle 1 : withSpring repart de la valeur courante, jamais d'un reset.
    scale.value = reduced ? target : withSpring(target, preset);
  }, [active, on, off, preset, reduced, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return { style, scale };
}
