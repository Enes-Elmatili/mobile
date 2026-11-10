// lib/layout/sheetFrame.ts
// Où se pose un bottom sheet. Sur un iPhone : toute la largeur, comme avant.
// Sur le Duo déplié : jamais à cheval sur le pli, jamais sous le rail système
// — le sheet occupe UNE page : la page DROITE, celle du détail (SplitPane y
// pose déjà ses volets ; un écran liste | détail y affiche « sélectionnez… »).
// Si elle est trop étroite pour un sheet de téléphone, la plus large. Ailleurs
// en regular (pliable sans pli connu) : une colonne de lecture centrée.
//
// Les marges sont rendues dans le repère où gorhom pose le sheet : la fenêtre
// pour un BottomSheetModal (portail à la racine), le conteneur de l'écran pour
// un BottomSheet posé dans la scène.
import { useMemo } from 'react';
import { useLayoutClass } from './useLayoutClass';
import { useHinge } from './hinge';
import { foldLineFor } from './posture';
import { useSceneFrame, useSceneInsets } from './sceneFrame';
import { useWindowSize } from './windowSize';

export const SHEET_MAX_WIDTH = 560;
/** En dessous, la page droite est trop étroite pour un sheet pensé pour un téléphone. */
export const SHEET_MIN_PAGE = 320;

type Span = { start: number; end: number };

export type SheetGeometryInput = {
  windowWidth: number;
  isRegular: boolean;
  /** Cadre du provider d'insets le plus proche (repère fenêtre). */
  container: { x: number; width: number };
  /** Insets latéraux vus dans ce provider. */
  insets: { left: number; right: number };
  /** Bande du pli en repère fenêtre, ou null. */
  fold: Span | null;
  modal: boolean;
};

/** La page qu'occupe le sheet, en repère fenêtre. */
export function sheetPageFor({ windowWidth, isRegular, container, insets, fold }: Omit<SheetGeometryInput, 'modal'>): Span {
  const start = container.x + insets.left;
  const end = Math.min(windowWidth, container.x + container.width) - insets.right;
  if (!isRegular) return { start, end };
  if (fold && fold.start > start && fold.end < end) {
    const left = { start, end: fold.start };
    const right = { start: fold.end, end };
    const rightWidth = right.end - right.start;
    return rightWidth >= SHEET_MIN_PAGE || rightWidth >= left.end - left.start ? right : left;
  }
  const width = Math.min(SHEET_MAX_WIDTH, end - start);
  const offset = (end - start - width) / 2;
  return { start: start + offset, end: start + offset + width };
}

/** Marges horizontales du sheet dans le repère où il est posé. */
export function sheetMarginsFor(input: SheetGeometryInput): { marginLeft: number; marginRight: number } {
  const page = sheetPageFor(input);
  if (input.modal) {
    return { marginLeft: Math.max(0, page.start), marginRight: Math.max(0, input.windowWidth - page.end) };
  }
  const cEnd = input.container.x + input.container.width;
  return { marginLeft: Math.max(0, page.start - input.container.x), marginRight: Math.max(0, cEnd - page.end) };
}

/**
 * Style à passer en `style` d'un BottomSheet / BottomSheetModal (gorhom v5).
 * `modal: true` pour un BottomSheetModal (rendu à la racine).
 */
export function useSheetFrame({ modal = true }: { modal?: boolean } = {}): { marginLeft: number; marginRight: number } {
  const { width: windowWidth, height, isRegular } = useLayoutClass();
  const frame = useSceneFrame();
  const insets = useSceneInsets();
  const hinge = useHinge();
  const fold = isRegular ? foldLineFor(hinge, { x: 0, y: 0, width: windowWidth, height }) : null;
  const foldStart = fold?.start ?? null;
  const foldEnd = fold?.end ?? null;
  return useMemo(
    () => sheetMarginsFor({
      windowWidth,
      isRegular,
      container: { x: frame.x, width: frame.width },
      insets: { left: insets.left, right: insets.right },
      fold: foldStart != null && foldEnd != null ? { start: foldStart, end: foldEnd } : null,
      modal,
    }),
    [windowWidth, isRegular, frame.x, frame.width, insets.left, insets.right, foldStart, foldEnd, modal],
  );
}

/**
 * Le voile d'un sheet posé DANS une scène couvre la fenêtre entière, rail du
 * Duo compris : sans ça, une bande claire de 84 pt restait à côté du voile.
 * Décalages négatifs à appliquer au style du backdrop (0/0 sur iPhone et pour
 * un sheet rendu à la racine).
 */
export function useBackdropBleed(): { left: number; right: number } {
  const { width } = useWindowSize();
  const scene = useSceneFrame();
  return { left: -Math.max(0, scene.x), right: -Math.max(0, width - scene.x - scene.width) };
}
