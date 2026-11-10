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

export type HingeState = {
  posture: HingePosture;
  fold?: FoldRect | null;
  /** Taille de la fenêtre au moment de la mesure (module natif) : un pli lu pour une autre fenêtre est périmé. */
  window?: { width: number; height: number } | null;
};

/**
 * Largeur du pli physique du Duo, en points. Apple (tech talk « Strike a pose
 * with adaptive layouts on iPhone Duo ») : la région « division » n'est active
 * qu'entrouvert ; à plat elle est inactive et de largeur NULLE. On garde donc
 * sa POSITION et on lui donne cette largeur : à plat comme entrouvert, les
 * pages s'arrêtent au même endroit (40 pt mesurés sur le simulateur).
 */
export const HINGE_BAND = 40;

const REGULAR_W = 600;
const REGULAR_H = 480;

const near = (a: number, b: number) => Math.abs(a - b) < 1;

/** Une bande d'au moins HINGE_BAND, centrée sur le milieu du pli rapporté. */
function band(fold: FoldRect): FoldRect {
  if (fold.height >= fold.width) {
    const mid = fold.x + fold.width / 2;
    const w = Math.max(fold.width, HINGE_BAND);
    return { ...fold, x: mid - w / 2, width: w };
  }
  const mid = fold.y + fold.height / 2;
  const h = Math.max(fold.height, HINGE_BAND);
  return { ...fold, y: mid - h / 2, height: h };
}

/**
 * La charnière telle que la mise en page doit la lire.
 *
 * Doc Apple (iOS 27.1) : aucune notification ne garantit une relecture des
 * régions réservées quand on plie ou déplie ; à plat le pli a une largeur
 * nulle. D'où trois règles :
 *   1. le pli rapporté garde sa position, avec la largeur physique (band) ;
 *   2. un pli mesuré pour une AUTRE taille de fenêtre est périmé ;
 *   3. périmé, absent ou « fermé » alors que la fenêtre est grande (on ne peut
 *      pas être fermé dans une fenêtre de Duo ouvert) : le pli d'un Duo ouvert
 *      est au milieu de la fenêtre — on le pose là. Jamais au milieu de la
 *      scène : décalée par le rail, elle placerait la coupure à côté du pli.
 * `supported` = le binaire embarque le module (sans lui : on ne devine rien).
 */
export function normalizeHinge(
  raw: HingeState | null | undefined,
  win: { width: number; height: number },
  supported: boolean,
): HingeState | undefined {
  const value = raw ?? undefined;
  if (!supported) return value;
  const fresh = !!value && (!value.window || (near(value.window.width, win.width) && near(value.window.height, win.height)));
  const open = value?.posture === 'fully-open' || value?.posture === 'partially-open';
  if (value && fresh && open && value.fold) return { ...value, fold: band(value.fold) };

  const large = win.width >= REGULAR_W && win.height >= REGULAR_H;
  if (!large) return value;
  const separating = value?.posture === 'partially-open';
  const fold: FoldRect = win.width >= win.height
    ? { x: win.width / 2 - HINGE_BAND / 2, y: 0, width: HINGE_BAND, height: win.height, separating }
    : { x: 0, y: win.height / 2 - HINGE_BAND / 2, width: win.width, height: HINGE_BAND, separating };
  return { posture: separating ? 'partially-open' : 'fully-open', fold, window: win };
}

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

/**
 * La bande verticale du pli à ne jamais chevaucher, à plat COMME entrouvert
 * (bords en x dans le repère du conteneur). À plat le pli ne sépare pas l'écran,
 * mais il reste là, sous le doigt et sous l'œil : deux colonnes s'arrêtent avant
 * et reprennent après. `null` : fermé, pas de pli vertical, ou pli hors du
 * conteneur / trop près d'un bord (même seuil de 25 % que foldLayoutFor).
 */
export function foldLineFor(state: HingeState | null | undefined, frame: Frame): { start: number; end: number } | null {
  const fold = state?.fold;
  if (!state || !fold || (state.posture !== 'fully-open' && state.posture !== 'partially-open')) return null;
  if (frame.width <= 0 || fold.height < fold.width) return null;
  const start = fold.x - frame.x;
  const end = start + fold.width;
  if (start < frame.width * 0.25 || end > frame.width * 0.75) return null;
  return { start, end };
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
