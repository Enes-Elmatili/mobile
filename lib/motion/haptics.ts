// lib/motion/haptics.ts
// Règle 6 : l'haptique tombe sur la même frame que le visuel, une seule fois
// par événement. Appelé DEPUIS un worklet (callback de withSpring, frame
// callback) — runOnJS ramène l'appel sur le thread JS où vit feedback.*.
import { runOnJS } from 'react-native-reanimated';
import { feedback } from '@/lib/feedback/feedback';

export type HapticKind = Parameters<typeof feedback.haptic>[0];

function fire(kind: HapticKind) {
  feedback.haptic(kind);
}

/** À utiliser dans un worklet : `hapticOnFrame('success')`. */
export function hapticOnFrame(kind: HapticKind) {
  'worklet';
  runOnJS(fire)(kind);
}
