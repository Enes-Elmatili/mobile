// components/ui/TabIcon.tsx
// Moment 15 : l'icône de l'onglet actif se redresse (0,9 → 1, léger
// dépassement). Le contenu, lui, arrive en fondu — changer d'onglet n'est pas
// une navigation. L'indicateur qui glisse viendra avec la tab bar custom
// (plan 4, sidebar en largeur « regular »).
import React from 'react';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { MOTION } from '@/lib/motion/springs';
import { useTakeScale } from '@/lib/motion/useTakeScale';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export function TabIcon({ name, color, focused, size = 22 }: { name: FeatherName; color: string; focused: boolean; size?: number }) {
  const { style } = useTakeScale(focused, { on: 1, off: 0.9, preset: MOTION.tabIcon });
  return (
    <Animated.View style={style}>
      <Feather name={name} size={size} color={color} />
    </Animated.View>
  );
}
