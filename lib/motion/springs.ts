// lib/motion/springs.ts
// La table des ressorts de FIXED. Une seule règle : le damping est DÉRIVÉ du
// ratio d'amortissement ζ (dampingFor, lib/motion/sheet.ts), jamais écrit.
//
//   ζ = 1,0   critique — l'interface (aucun rebond)
//   ζ < 1,0   léger dépassement — réservé aux objets qui « prennent »
//             (sélection, atterrissage) et aux gestes avec élan
import { dampingFor, type SpringConfig } from './sheet';

export const spring = (stiffness: number, zeta: number, mass = 1): SpringConfig => ({
  damping: dampingFor(zeta, stiffness, mass),
  stiffness,
  mass,
});

export const MOTION = Object.freeze({
  /** Ouverture / fermeture d'un écran pliable : large, calme. */
  unfold: spring(180, 1.0),
  /** Entrée d'un volet ou d'une ligne (usePresence, useCascade). */
  pane: spring(240, 1.0),
  /** Recentrage d'une carte : un geste de la main, ~350 ms. */
  recenter: spring(220, 1.0),
  /** Un objet qui prend : marqueur sélectionné, étoile finale. */
  take: spring(400, 0.85),
  /** Une valeur qui compte (montant, total). */
  count: spring(120, 1.0),
  /** Respiration d'un bloc à la réception d'une valeur. */
  breathe: spring(300, 0.9),
  /** Un trait qui se dessine (coche, sceau, itinéraire). */
  trace: spring(200, 1.0),
  /** Atterrissage d'un prestataire sur la carte. */
  land: spring(320, 0.8),
  /** Indicateur d'onglet. */
  tab: spring(260, 1.0),
  /** Icône d'onglet qui se redresse. */
  tabIcon: spring(500, 0.9),
  /** Toast qui s'étend depuis l'île. */
  island: spring(220, 0.9),
  /** Retour du pull-to-refresh. */
  pull: spring(300, 0.8),
} satisfies Record<string, SpringConfig>);

export type MotionPreset = keyof typeof MOTION;
