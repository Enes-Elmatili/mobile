// lib/motion/sheet.ts
// ─────────────────────────────────────────────────────────────────────────────
// Physique partagée des bottom sheets — source unique de vérité.
//
// Traduction des principes « Designing Fluid Interfaces » en config Reanimated,
// telle que la consomme @gorhom/bottom-sheet v5 (cf. CLAUDE.md § Interfaces
// fluides). La lib fournit déjà nativement l'interruptibilité (le geste écrit
// dans une shared value) et le velocity handoff (la vélocité du doigt est
// passée au spring au relâchement). Ce qui manquait, c'est la PHYSIQUE : sans
// `animationConfigs`, gorhom retombe sur un timing par défaut — donc pas de
// spring du tout, et aucun handoff possible.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { feedback } from '@/lib/feedback/feedback';

/**
 * Ratio d'amortissement ζ = damping / (2 × √(stiffness × mass)).
 *   ζ = 1.0 → amortissement critique : arrive à destination au plus vite, SANS
 *             dépasser. C'est le défaut pour toute UI standard (règle 2).
 *   ζ < 1.0 → sous-amorti : rebond. Réservé au flick avec momentum.
 */
export const dampingFor = (ratio: number, stiffness: number, mass: number) =>
  ratio * 2 * Math.sqrt(stiffness * mass);

const STIFFNESS = 200;
const MASS = 1;

/**
 * Spring par défaut des sheets — amortissement critique, aucun rebond.
 * damping ≈ 28.28 (et non 20, qui donnait ζ ≈ 0.71 et un rebond visible).
 */
export const SHEET_SPRING = {
  damping: dampingFor(1.0, STIFFNESS, MASS),
  stiffness: STIFFNESS,
  mass: MASS,
} as const;

/**
 * Variante légèrement sous-amortie (ζ ≈ 0.85), réservée aux gestes avec
 * momentum : un flick doit conserver une trace de son élan. Jamais pour une
 * ouverture programmatique.
 */
export const SHEET_SPRING_MOMENTUM = {
  damping: dampingFor(0.85, STIFFNESS, MASS),
  stiffness: STIFFNESS,
  mass: MASS,
} as const;

/**
 * Reduce-motion actif → on remplace le ressort par un rapprochement quasi
 * instantané (ζ très élevé + raideur forte = pas d'oscillation perceptible).
 * Le sheet apparaît sans course animée, seul le backdrop fait le cross-fade.
 */
export const SHEET_SPRING_REDUCED = {
  damping: dampingFor(2.5, 1000, MASS),
  stiffness: 1000,
  mass: MASS,
} as const;

/**
 * Résistance du rubber-band en fin de course (règle 5 : jamais de stop dur).
 * Plus la valeur est haute, plus la course résiste au doigt.
 */
export const SHEET_OVER_DRAG_RESISTANCE = 3.5;

/** État OS du réglage « Réduire les animations ». */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

export type SpringConfig = { damping: number; stiffness: number; mass: number };

export type SheetMotion = {
  animationConfigs: SpringConfig;
  overDragResistanceFactor: number;
  /** À brancher sur la prop `onAnimate` du BottomSheet. */
  onAnimate: (fromIndex: number, toIndex: number) => void;
};

/**
 * Physique + haptique d'un bottom sheet.
 *
 * L'haptique part depuis `onAnimate`, que gorhom appelle au moment où la
 * transition démarre — soit la même frame que le mouvement visuel (règle 6),
 * et non après coup. `feedback.haptic` respecte déjà la préférence utilisateur.
 *
 * Volontairement silencieux à l'ouverture : le tap qui ouvre le sheet a déjà
 * produit son propre retour. On ne vibre qu'au snap et à la fermeture, pour
 * éviter le sur-feedback.
 */
export function useSheetMotion(): SheetMotion {
  const reduced = useReduceMotion();

  return useMemo(() => ({
    animationConfigs: reduced ? SHEET_SPRING_REDUCED : SHEET_SPRING,
    overDragResistanceFactor: SHEET_OVER_DRAG_RESISTANCE,
    onAnimate: (fromIndex: number, toIndex: number) => {
      if (reduced) return;
      if (toIndex === -1) {
        feedback.haptic('light');       // fermeture
      } else if (fromIndex !== -1) {
        feedback.haptic('selection');   // changement de palier
      }
    },
  }), [reduced]);
}
