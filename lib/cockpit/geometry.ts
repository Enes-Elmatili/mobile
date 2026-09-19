// lib/cockpit/geometry.ts — la géométrie de l'accueil, décidée par l'écran,
// jamais par le modèle d'appareil. Une fonction pure de la fenêtre, des
// insets et de la classe de layout : testable pour un SE, un Pro Max, un
// Android 360×640 à trois boutons, un Fold ouvert, un Duo à encoche latérale.
//
//   - écran bas (< 700 pt utiles) : GO 72, dock 60, puces serrées
//   - écran large (regular) : les surfaces gardent une largeur de lecture
//     (520 pt) centrée ; la barre d'onglets est latérale, plus rien en bas
//   - insets gauche/droite ajoutés aux marges (encoche latérale du Duo)
import type { LayoutClass } from '@/lib/layout/resolveLayoutClass';

export type CockpitGeometry = {
  /** Taille du disque GO et hauteur du dock. */
  goSize: number;
  dockHeight: number;
  /** Bord bas du dock, depuis le bas de l'écran (= dessus de la barre d'onglets). */
  dockBottom: number;
  /** Bord bas de la journée / carte mission / carte GPS : au-dessus du GO. */
  stripBottom: number;
  /** Rangée du haut. */
  topRowTop: number;
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

export function cockpitGeometry(a: {
  width: number;
  height: number;
  insets: { top: number; bottom: number; left: number; right: number };
  cls: LayoutClass;
  /** Hauteur réelle de la barre d'onglets en bas (0 sur regular : elle est latérale). */
  tabBarHeight: number;
}): CockpitGeometry {
  const denseHeight = a.height - a.insets.top < DENSE_HEIGHT;
  const goSize = denseHeight ? 72 : 84;
  const dockHeight = denseHeight ? 60 : 72;
  const dockBottom = a.tabBarHeight;
  const stripBottom = dockBottom + dockHeight + goSize / 2 + 6 + (denseHeight ? 8 : 10);
  const topRowTop = a.insets.top + 8;
  const usable = a.width - a.insets.left - a.insets.right;
  const contentWidth = Math.min(usable - 32, a.cls === 'regular' ? CONTENT_MAX_WIDTH : usable - 32);
  const side = Math.max(16, (usable - contentWidth) / 2);
  const marginLeft = a.insets.left + side;
  const marginRight = a.insets.right + side;
  const strip = denseHeight ? STRIP_ESTIMATE.dense : STRIP_ESTIMATE.normal;
  const mapPaddingBottom = stripBottom + strip;
  const mapPaddingTop = topRowTop + 44;
  const free = a.height - mapPaddingTop - mapPaddingBottom;
  const veilLabelTop = (mapPaddingTop + free / 2 - 16) / a.height;
  return { goSize, dockHeight, dockBottom, stripBottom, topRowTop, marginLeft, marginRight, contentWidth, denseHeight, mapPaddingBottom, mapPaddingTop, veilLabelTop };
}
