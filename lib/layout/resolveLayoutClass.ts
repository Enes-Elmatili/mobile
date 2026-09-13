// lib/layout/resolveLayoutClass.ts
// Une colonne ou deux volets ? Décidé par la géométrie, jamais par le modèle
// d'appareil : un Duo fermé est compact, un Fold ouvert est regular, un iPad
// en Split View 1/3 redevient compact.
export type LayoutClass = 'compact' | 'regular';

export const REGULAR_MIN_WIDTH = 600;
export const REGULAR_MIN_HEIGHT = 480;

export function resolveLayoutClass(width: number, height: number): LayoutClass {
  return width >= REGULAR_MIN_WIDTH && height >= REGULAR_MIN_HEIGHT ? 'regular' : 'compact';
}
