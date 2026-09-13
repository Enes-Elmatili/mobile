// lib/motion/gestures.ts
// Fonctions pures des gestes — testables sans Reanimated. Marquées 'worklet'
// pour être appelables depuis le thread UI.
import { SHEET_OVER_DRAG_RESISTANCE } from './sheet';

/** Règle 5 : élastique aux bords, jamais d'arrêt sec. */
export function rubberBand(x: number, min: number, max: number, resistance: number = SHEET_OVER_DRAG_RESISTANCE): number {
  'worklet';
  if (x < min) return min + (x - min) / resistance;
  if (x > max) return max + (x - max) / resistance;
  return x;
}

/** Règle 3 : le point d'arrivée est projeté depuis la vitesse, pas lu à la position. */
export function projectRelease(x: number, velocity: number, horizonSec = 0.2): number {
  'worklet';
  return x + velocity * horizonSec;
}

/** Curseur d'engagement : confirme si on est au bout, ou si l'élan y mène. */
export function shouldConfirm(x: number, velocity: number, track: number): boolean {
  'worklet';
  if (x >= track * 0.95) return true;
  if (velocity <= 0) return false;
  return projectRelease(x, velocity) >= track * 0.9;
}
