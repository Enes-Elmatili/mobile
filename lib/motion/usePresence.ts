// lib/motion/usePresence.ts
// Entrée / sortie avec ORIGINE. Sur un écran déplié, ce qui apparaît à droite
// part de la charnière, ce qui apparaît à gauche part du bord : l'utilisateur
// comprend la géographie de l'écran sans y penser (spec, moment 19).
import { useEffect } from 'react';
import { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from './springs';
import { useReduceMotion, type SpringConfig } from './sheet';

export type PresenceOrigin = 'left' | 'hinge' | 'right' | 'bottom' | 'island' | 'none';

const OFFSET: Record<PresenceOrigin, { x: number; y: number }> = {
  left: { x: -28, y: 0 },
  hinge: { x: -40, y: 0 },
  right: { x: 28, y: 0 },
  bottom: { x: 0, y: 12 },
  island: { x: 0, y: -8 },
  none: { x: 0, y: 0 },
};

export function usePresence(
  visible: boolean,
  opts: { from?: PresenceOrigin; preset?: SpringConfig; delayMs?: number } = {},
) {
  const { from = 'bottom', preset = MOTION.pane, delayMs = 0 } = opts;
  const reduced = useReduceMotion();
  const p = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    const target = visible ? 1 : 0;
    if (reduced) {
      p.value = withTiming(target, { duration: 200 });
      return;
    }
    const anim = withSpring(target, preset);
    // Le délai ne s'applique qu'à l'entrée : une sortie part tout de suite.
    p.value = visible && delayMs > 0 ? withDelay(delayMs, anim) : anim;
  }, [visible, reduced, preset, delayMs, p]);

  const style = useAnimatedStyle(() => {
    const off = OFFSET[from];
    return {
      opacity: p.value,
      transform: reduced
        ? []
        : [{ translateX: off.x * (1 - p.value) }, { translateY: off.y * (1 - p.value) }],
    };
  });

  return { style, progress: p };
}
