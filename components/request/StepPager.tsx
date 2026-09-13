// components/request/StepPager.tsx
// Conteneur dont le contenu est POUSSÉ latéralement quand `page` change :
// en avant (direction 1) le nouveau contenu entre par la droite et l'ancien
// sort par la gauche ; en arrière, l'inverse. Animations de layout Reanimated
// sur les constantes de MOTION.pane ; reduce-motion : fondu 150 ms.
// Utilisé pour les étapes du stepper, la liste de prestations (par catégorie)
// et la semaine (WeekStrip).
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInLeft, SlideInRight, SlideOutLeft, SlideOutRight } from 'react-native-reanimated';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';

export type PagerDirection = 1 | -1;

type Props = {
  page: number | string;
  direction: PagerDirection;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const { damping, stiffness, mass } = MOTION.pane;

export function StepPager({ page, direction, children, style }: Props) {
  const reduced = useReduceMotion();
  const entering = reduced
    ? FadeIn.duration(150)
    : (direction > 0 ? SlideInRight : SlideInLeft).springify().damping(damping).stiffness(stiffness).mass(mass);
  const exiting = reduced
    ? FadeOut.duration(150)
    : (direction > 0 ? SlideOutLeft : SlideOutRight).springify().damping(damping).stiffness(stiffness).mass(mass);
  return (
    <Animated.View key={String(page)} entering={entering} exiting={exiting} style={[{ flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}
