// lib/motion/useCascade.tsx
// N éléments qui apparaissent l'un après l'autre (lignes de devis, contenu
// après squelettes, volets). Le décalage guide le regard ; il ne décore pas.
//
// Forme sûre : chaque élément possède son propre ressort (CascadeItem),
// plutôt qu'un tableau de valeurs partagées animé par index, que Reanimated
// ne garantit pas.
import React from 'react';
import Animated from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';
import { MOTION } from './springs';
import type { SpringConfig } from './sheet';
import { usePresence, type PresenceOrigin } from './usePresence';

export const CASCADE_STEP_MS = 40;

/** Délai d'entrée du i-ème élément. Pur, testable. */
export function cascadeDelay(index: number, stepMs = CASCADE_STEP_MS): number {
  return Math.max(0, index) * stepMs;
}

type ItemProps = {
  index: number;
  visible?: boolean;
  stepMs?: number;
  from?: PresenceOrigin;
  preset?: SpringConfig;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/** Un élément d'une cascade : entre `index × stepMs` ms après le premier. */
export function CascadeItem({ index, visible = true, stepMs = CASCADE_STEP_MS, from = 'bottom', preset = MOTION.pane, style, children }: ItemProps) {
  const { style: presence } = usePresence(visible, { from, preset, delayMs: cascadeDelay(index, stepMs) });
  return <Animated.View style={[style, presence]}>{children}</Animated.View>;
}
