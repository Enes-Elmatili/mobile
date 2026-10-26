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
//   - moment 4 : ouvrir le téléphone ÉLARGIT l'écran — le master cède sa place
//     sur MOTION.unfold, le volet droit grandit depuis la charnière ; fermer
//     le range. Un seul arbre dans les deux classes : rien ne se recharge.
import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
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
  const reduced = useReduceMotion();
  const hasDetail = detail != null;
  const detailPresence = usePresence(hasDetail, { from: 'hinge', preset: MOTION.pane });

  // 0 = une colonne, 1 = deux volets. Part du bon état au montage : pas
  // d'animation à l'ouverture d'un écran, seulement au pliage.
  const unfold = useSharedValue(isRegular ? 1 : 0);
  useEffect(() => {
    const target = isRegular ? 1 : 0;
    unfold.value = reduced ? withTiming(target, { duration: 200 }) : withSpring(target, MOTION.unfold);
  }, [isRegular, reduced, unfold]);

  const masterStyle = useAnimatedStyle(() => ({ flex: 1 - (1 - ratio) * unfold.value }));
  const detailStyle = useAnimatedStyle(() => ({ flex: (1 - ratio) * unfold.value, opacity: unfold.value }));

  return (
    <View style={[s.row, style]}>
      <Animated.View style={[s.master, masterStyle, { paddingLeft: isRegular ? insets.left : 0 }]}>{master}</Animated.View>
      {isRegular ? <View style={[s.separator, { backgroundColor: theme.border }]} /> : null}
      <Animated.View
        style={[s.detail, detailStyle, { paddingRight: isRegular ? insets.right : 0, paddingLeft: isRegular ? HINGE_GUTTER : 0 }]}
        pointerEvents={isRegular ? 'auto' : 'none'}
        importantForAccessibility={isRegular ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!isRegular}
      >
        {hasDetail ? (
          <Animated.View style={[s.fill, detailPresence.style]}>{detail}</Animated.View>
        ) : (
          placeholder
        )}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  master: { minWidth: 0 },
  separator: { width: StyleSheet.hairlineWidth },
  detail: { minWidth: 0, overflow: 'hidden' },
});
