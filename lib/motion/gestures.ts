// lib/motion/gestures.ts
// Fonctions pures des gestes — testables sans Reanimated. Marquées 'worklet'
// pour être appelables depuis le thread UI.
import { SHEET_OVER_DRAG_RESISTANCE } from './sheet';

/** Règle 5 : élastique aux bords, jamais d'arrêt sec. */
export function rubberBand(x: number, min: number, max: number, resistance?: number): number {
  'worklet';
  // Jamais de valeur de la fermeture dans la liste des paramètres d'un
  // worklet : sur le thread UI, le plugin déballe `this.__closure` dans le
  // corps, APRÈS l'évaluation des paramètres → ReferenceError à chaque appel
  // (curseur inerte sur iOS, plantage natif sur Android). On résout le défaut
  // ici, dans le corps. Garde-fou : __tests__/workletClosure.test.js.
  const r = resistance ?? SHEET_OVER_DRAG_RESISTANCE;
  if (x < min) return min + (x - min) / r;
  if (x > max) return max + (x - max) / r;
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
