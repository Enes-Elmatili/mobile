// lib/layout/posture.ts
// Ce que la charnière (iOS 27.1, modules/fixed-hinge) veut dire pour la mise
// en page. Fonctions pures : testées sans appareil.
//
// Grammaire Apple : la POSTURE et le PLI décident de la disposition ; l'angle
// ne sert qu'aux effets. À plat, le pli d'un Duo ne coupe rien (écran
// continu) : on garde nos proportions. Entrouvert, il sépare deux surfaces :
//   - pli vertical   → « livre » : deux pages, le contenu évite le pli
//   - pli horizontal → « table » : la scène en haut, les commandes en bas

export type HingePosture = 'closed' | 'partially-open' | 'fully-open' | 'unknown';

export type FoldRect = { x: number; y: number; width: number; height: number; separating: boolean };

export type HingeState = { posture: HingePosture; fold?: FoldRect | null };

export type FoldLayout =
  | { kind: 'flat' }
  /** Pli vertical qui sépare : `start`/`end` = bords du pli, en x dans le repère donné. */
  | { kind: 'book'; start: number; end: number }
  /** Pli horizontal qui sépare : `start`/`end` = bords du pli, en y dans le repère donné. */
  | { kind: 'tabletop'; start: number; end: number };

export type Frame = { x: number; y: number; width: number; height: number };

const FLAT: FoldLayout = { kind: 'flat' };

/**
 * La disposition qu'impose le pli à un conteneur (`frame`, en repère fenêtre).
 * Plat si le pli ne sépare pas, ne traverse pas le conteneur, ou laisserait
 * une moitié trop étroite pour être utile (moins de 25 %).
 */
export function foldLayoutFor(state: HingeState | null | undefined, frame: Frame): FoldLayout {
  const fold = state?.fold;
  if (!state || state.posture !== 'partially-open' || !fold || !fold.separating) return FLAT;
  if (frame.width <= 0 || frame.height <= 0) return FLAT;

  const vertical = fold.height >= fold.width;
  if (vertical) {
    const start = fold.x - frame.x;
    const end = start + fold.width;
    if (start < frame.width * 0.25 || end > frame.width * 0.75) return FLAT;
    return { kind: 'book', start, end };
  }
  const start = fold.y - frame.y;
  const end = start + fold.height;
  if (start < frame.height * 0.25 || end > frame.height * 0.75) return FLAT;
  return { kind: 'tabletop', start, end };
}

/** Part du volet gauche d'un SplitPane : au pli en « livre », sinon le ratio de base. */
export function splitRatioFor(layout: FoldLayout, frameWidth: number, base: number): number {
  if (layout.kind !== 'book' || frameWidth <= 0) return base;
  return layout.start / frameWidth;
}

/**
 * Ombre de pliure (effet, pas disposition) : 0 à plat, 1 vers 90°.
 * Le livre qu'on entrouvre se creuse un peu au milieu — jamais plus.
 */
export function creaseFor(angleDegrees: number | null | undefined): number {
  'worklet';
  if (angleDegrees == null || !Number.isFinite(angleDegrees)) return 0;
  const t = (180 - angleDegrees) / 90;
  return Math.min(1, Math.max(0, t));
}
