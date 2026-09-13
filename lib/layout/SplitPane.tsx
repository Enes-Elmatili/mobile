// lib/layout/SplitPane.tsx
// Deux volets sur un écran « regular » (Duo ouvert, Fold ouvert, iPad), une
// colonne sur « compact ». Le même écran, les mêmes composants, arrangés
// autrement — pas de version par appareil.
//
// Règles du spec (§ 4.2, § 4.3, moments 4 et 19) :
//   - le volet droit ENTRE depuis la charnière (usePresence from 'hinge'),
//     le master vit à gauche ; l'utilisateur comprend la géographie sans y penser
//   - la charnière physique est à 50 % : ratio 0,42 la garde dans le volet
//     droit, dans une gouttière de 24 pt — jamais sous un contrôle
//   - au changement de classe (pliage), rien ne se démonte : les deux enfants
//     gardent leur clé React, seul l'arrangement change
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { usePresence } from '@/lib/motion/usePresence';
import { useLayoutClass } from './useLayoutClass';

export const HINGE_GUTTER = 24;

type Props = {
  /** Liste, formulaire, carte : ce qu'on voit toujours. */
  master: React.ReactNode;
  /** Détail : rendu dans le volet droit sur regular. Sur compact, l'appelant le montre en sheet ou en route. */
  detail?: React.ReactNode;
  /** Part du master, 0-1. 0,42 par défaut (charnière dans le volet droit). */
  ratio?: number;
  /** Ce qui s'affiche à droite quand il n'y a pas de détail. */
  placeholder?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** `true` quand l'écran affiche deux volets : l'appelant sait alors ne PAS ouvrir de sheet. */
export function useSplitPane(): boolean {
  return useLayoutClass().isRegular;
}

export function SplitPane({ master, detail, ratio = 0.42, placeholder = null, style }: Props) {
  const theme = useAppTheme();
  const { isRegular, insets } = useLayoutClass();
  const hasDetail = detail != null;
  const detailPresence = usePresence(hasDetail, { from: 'hinge', preset: MOTION.pane });

  if (!isRegular) {
    return <View style={[s.fill, style]}>{master}</View>;
  }

  return (
    <View style={[s.row, style]}>
      <View style={[s.master, { flex: ratio, paddingLeft: insets.left }]}>{master}</View>
      <View style={[s.separator, { backgroundColor: theme.border }]} />
      <View style={[s.detail, { flex: 1 - ratio, paddingRight: insets.right, paddingLeft: HINGE_GUTTER }]}>
        {hasDetail ? (
          <Animated.View style={[s.fill, detailPresence.style]}>{detail}</Animated.View>
        ) : (
          placeholder
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  master: { minWidth: 0 },
  separator: { width: StyleSheet.hairlineWidth },
  detail: { minWidth: 0 },
});
