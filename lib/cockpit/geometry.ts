// lib/cockpit/geometry.ts — la géométrie de l'accueil, décidée par l'écran,
// jamais par le modèle d'appareil. Une fonction pure de la fenêtre, des
// insets et de la classe de layout : testable pour un SE, un Pro Max, un
// Android 360×640 à trois boutons, un Fold ouvert, un Duo à encoche latérale.
//
//   - écran bas (< 700 pt utiles) : puces serrées
//   - écran large (regular) : les surfaces gardent une largeur de lecture
//     (520 pt) centrée ; la barre d'onglets est latérale, seul le disque
//     d'action flotte encore en bas à droite
//   - insets gauche/droite ajoutés aux marges (encoche latérale du Duo)
//   - Duo déplié : les surfaces vivent dans UNE page (la gauche) — la bande
//     centrée de 520 pt passait sur le pli ; la carte reste plein cadre
// Le GO n'est plus dans l'écran : c'est le disque détaché de la barre
// flottante (components/nav/ActionDisc) ; l'écran ne réserve que sa hauteur.
import type { LayoutClass } from '@/lib/layout/resolveLayoutClass';

export type CockpitGeometry = {
  /** Dessus de la barre flottante (et du disque), depuis le bas de l'écran. */
  barTop: number;
  /** Bord bas de la journée / carte GPS : juste au-dessus de la barre. */
  stripBottom: number;
  /** Rangée du haut. */
  topRowTop: number;
  /** L'étiquette d'état, sous la rangée du haut. */
  stateTop: number;
  /** Marges latérales et largeur de lecture des surfaces (centrées si l'écran est plus large). */
  marginLeft: number;
  marginRight: number;
  contentWidth: number;
  /** Écran bas : puces plus serrées. */
  denseHeight: boolean;
  /** Ce que la carte doit laisser libre en bas (padding de la MapView). */
  mapPaddingBottom: number;
  mapPaddingTop: number;
  /** Position verticale (ratio) de l'étiquette du voile, au centre de la zone libre. */
  veilLabelTop: number;
};

export const CONTENT_MAX_WIDTH = 520;
export const DENSE_HEIGHT = 700;
/** Hauteur approximative de la journée (puces + prochaine mission), pour le cadrage de la carte. */
const STRIP_ESTIMATE = { normal: 120, dense: 100 };
/** Respiration entre la journée et la barre flottante. */
const STRIP_GAP = 12;

export function cockpitGeometry(a: {
  width: number;
  height: number;
  insets: { top: number; bottom: number; left: number; right: number };
  cls: LayoutClass;
  /** Dessus de la barre flottante depuis le bas de l'écran (useTabBarPadding(0)). */
  tabBarHeight: number;
  /** Duo déplié : la page où poser les surfaces (x et largeur dans l'écran). Sans page : largeur de lecture centrée. */
  page?: { left: number; width: number } | null;
}): CockpitGeometry {
  const denseHeight = a.height - a.insets.top < DENSE_HEIGHT;
  const barTop = a.tabBarHeight;
  const stripBottom = barTop + STRIP_GAP;
  const topRowTop = a.insets.top + 8;
  const stateTop = topRowTop + 44 + 10;
  const usable = a.width - a.insets.left - a.insets.right;
  let contentWidth = Math.min(usable - 32, a.cls === 'regular' ? CONTENT_MAX_WIDTH : usable - 32);
  const side = Math.max(16, (usable - contentWidth) / 2);
  let marginLeft = a.insets.left + side;
  let marginRight = a.insets.right + side;
  if (a.page) {
    // Une page, 16 pt de chaque côté : rien ne déborde sur le pli.
    const start = Math.max(a.page.left, a.insets.left);
    contentWidth = Math.max(0, a.page.left + a.page.width - start - 32);
    marginLeft = start + 16;
    marginRight = Math.max(0, a.width - marginLeft - contentWidth);
  }
  const strip = denseHeight ? STRIP_ESTIMATE.dense : STRIP_ESTIMATE.normal;
  const mapPaddingBottom = stripBottom + strip;
  const mapPaddingTop = stateTop + 36;
  const free = a.height - mapPaddingTop - mapPaddingBottom;
  const veilLabelTop = (mapPaddingTop + free / 2 - 16) / a.height;
  return { barTop, stripBottom, topRowTop, stateTop, marginLeft, marginRight, contentWidth, denseHeight, mapPaddingBottom, mapPaddingTop, veilLabelTop };
}
