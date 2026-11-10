// lib/layout/SplitPane.tsx
// Deux volets sur un écran « regular » (Duo ouvert, Fold ouvert, iPad), une
// colonne sur « compact ». Le même écran, les mêmes composants, arrangés
// autrement — pas de version par appareil.
//
// Règles du spec (§ 4.2, § 4.3, moments 4 et 19) :
//   - le volet droit ENTRE depuis la charnière (usePresence from 'hinge'),
//     le master vit à gauche ; l'utilisateur comprend la géographie sans y penser
//   - sans charnière connue (iPad, pliable Android), ratio de base 0,42
//   - au changement de classe (pliage), rien ne se démonte : les deux enfants
//     gardent leur clé React, seul l'arrangement change
//   - moment 4 : ouvrir le téléphone ÉLARGIT l'écran — le master cède sa place
//     sur MOTION.unfold, le volet droit grandit depuis la charnière ; fermer
//     le range. Un seul arbre dans les deux classes : rien ne se recharge.
//
// iOS 27.1 (lib/layout/hinge) :
//   - à plat COMME entrouvert, la séparation se pose EXACTEMENT au bord du pli
//     (foldLineFor) et le volet droit reprend après lui : aucun contenu à
//     cheval sur la charnière (40 pt sur le Duo, mesurés)
//   - l'angle creuse une ombre de pliure (effet seulement, jamais la disposition)
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePresence } from '@/lib/motion/usePresence';
import { useLayoutClass } from './useLayoutClass';
import { layoutLog, useHinge, useHingeAngle } from './hinge';
import { creaseFor, foldLineFor } from './posture';
import { useRowFrame } from './rowFrame';
import { useSceneFrame } from './sceneFrame';

export const HINGE_GUTTER = 24;

type Props = {
  /** Liste, formulaire, carte : ce qu'on voit toujours. */
  master: React.ReactNode;
  /** Détail : rendu dans le volet droit sur regular. Sur compact, l'appelant le montre en sheet ou en route. */
  detail?: React.ReactNode;
  /** Identité du détail (id de mission, de conversation) : en changer rejoue l'entrée depuis la charnière. */
  detailKey?: string | number | null;
  /** Part du master, 0-1. 0,42 par défaut (charnière dans le volet droit). */
  ratio?: number;
  /** Ce qui s'affiche à droite quand il n'y a pas de détail (voir PanePlaceholder). */
  placeholder?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** `true` quand l'écran affiche deux volets : l'appelant sait alors ne PAS ouvrir de sheet. */
export function useSplitPane(): boolean {
  return useLayoutClass().isRegular;
}

/** Le contenu d'un détail : rejoue l'entrée depuis la charnière à chaque nouvelle clé. */
function PaneEntry({ children }: { children: React.ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => { setShown(true); }, []);
  const { style } = usePresence(shown, { from: 'hinge', preset: MOTION.pane });
  return <Animated.View style={[s.fill, style]}>{children}</Animated.View>;
}

export function SplitPane({ master, detail, detailKey = null, ratio = 0.42, placeholder = null, style }: Props) {
  const theme = useAppTheme();
  const { isRegular, insets, width: windowWidth } = useLayoutClass();
  const reduced = useReduceMotion();
  const hasDetail = detail != null;
  const detailPresence = usePresence(hasDetail, { from: 'hinge', preset: MOTION.pane });

  // Où est la rangée dans la fenêtre (le pli est donné en repère fenêtre) :
  // mesurée par rapport à la racine de l'écran, sans les transformations en
  // cours (lib/layout/rowFrame) — remesurée quand la scène ou le pli change.
  const scene = useSceneFrame();
  const hinge = useHinge();
  const { ref: rowRef, onLayout, frame } = useRowFrame([hinge]);
  // Le pli, à plat COMME entrouvert : la séparation se pose à son bord gauche et
  // le volet droit reprend après lui — aucun contenu à cheval sur la charnière.
  const line = isRegular ? foldLineFor(hinge, frame) : null;
  const targetRatio = line && frame.width > 0 ? line.start / frame.width : ratio;
  useEffect(() => {
    layoutLog('split', { frame, scene, win: { w: windowWidth }, regular: isRegular, posture: hinge?.posture, fold: hinge?.fold, line, targetRatio });
  }, [frame, scene, windowWidth, isRegular, hinge, line, targetRatio]);

  // 0 = une colonne, 1 = deux volets : ne pilote plus que l'opacité du volet
  // droit au pliage.
  const unfold = useSharedValue(isRegular ? 1 : 0);
  useEffect(() => {
    const target = isRegular ? 1 : 0;
    unfold.value = reduced ? withTiming(target, { duration: 200 }) : withSpring(target, MOTION.unfold);
  }, [isRegular, reduced, unfold]);

  // La LARGEUR des volets est fixée, calculée sur le pli — plus animée.
  // Constaté sur le Duo (capture interne, 10/11/2026) : la largeur animée
  // restait sur sa valeur de départ (ratio 0,5 → coupure à 433,5 pt) alors que
  // la cible calculée était juste (pli à 455,5) ; la page droite empiétait de
  // 5 pt sur la charnière. Une largeur posée ne peut pas manquer sa cible.
  const masterWidth = isRegular && frame.width > 0 ? Math.round(targetRatio * frame.width * 2) / 2 : undefined;
  const masterStyle = isRegular ? (masterWidth != null ? { width: masterWidth } : { flex: targetRatio }) : s.fill;
  const detailBox = isRegular ? (masterWidth != null ? s.fill : { flex: 1 - targetRatio }) : s.collapsed;
  const detailStyle = useAnimatedStyle(() => ({ opacity: unfold.value }));
  const lineStyle = useAnimatedStyle(() => ({ opacity: unfold.value }));

  // Ombre de pliure : le livre qu'on entrouvre se creuse au milieu.
  const angle = useHingeAngle();
  const creaseStyle = useAnimatedStyle(() => ({ opacity: creaseFor(angle.value) * 0.9 }));
  const shade = theme.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.10)';

  // Le volet droit commence APRÈS le pli (toute sa largeur, 40 pt sur Duo).
  const detailGutter = line ? line.end - line.start : HINGE_GUTTER;
  // Les insets ne comptent que là où la rangée les chevauche : posée dans une
  // scène déjà décalée (rail du Duo, sidebar), elle ne les rajoute pas.
  const padLeft = isRegular ? Math.max(0, insets.left - frame.x) : 0;
  const padRight = isRegular ? Math.max(0, frame.x + frame.width - (windowWidth - insets.right)) : 0;

  return (
    <View ref={rowRef} onLayout={onLayout} style={[s.row, style]}>
      <Animated.View style={[s.master, masterStyle, { paddingLeft: padLeft }]}>{master}</Animated.View>
      {isRegular && !line ? <Animated.View style={[s.separator, { backgroundColor: theme.border }, lineStyle]} /> : null}
      <Animated.View
        style={[s.detail, detailBox, detailStyle, { paddingRight: padRight, paddingLeft: isRegular ? detailGutter : 0 }]}
        pointerEvents={isRegular ? 'auto' : 'none'}
        importantForAccessibility={isRegular ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!isRegular}
      >
        {hasDetail ? (
          <Animated.View style={[s.fill, detailPresence.style]}>
            <PaneEntry key={detailKey ?? 'detail'}>{detail}</PaneEntry>
          </Animated.View>
        ) : (
          placeholder
        )}
      </Animated.View>
      {/* Ombre de pliure : nulle à plat (creaseFor(180) = 0), elle se creuse quand on entrouvre. */}
      {line ? (
        <Animated.View pointerEvents="none" style={[s.crease, { left: line.start, width: line.end - line.start }, creaseStyle]}>
          <LinearGradient colors={['transparent', shade, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Le volet droit en attente : une icône au repos (contour), une ligne en mono. */
export function PanePlaceholder({ icon, label }: { icon: React.ComponentProps<typeof Feather>['name']; label: string }) {
  const theme = useAppTheme();
  const [shown, setShown] = useState(false);
  useEffect(() => { setShown(true); }, []);
  const { style } = usePresence(shown, { from: 'bottom', preset: MOTION.pane, delayMs: 120 });
  return (
    <Animated.View style={[s.placeholder, style]}>
      <View style={[s.placeholderDisc, { borderColor: theme.border }]}>
        <Feather name={icon} size={22} color={theme.textMuted as string} />
      </View>
      <Text style={[s.placeholderText, { color: theme.textMuted, fontFamily: FONTS.mono }]} maxFontSizeMultiplier={1.2}>{label}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  master: { minWidth: 0 },
  separator: { width: StyleSheet.hairlineWidth },
  detail: { minWidth: 0, overflow: 'hidden' },
  collapsed: { width: 0, flex: 0 },
  crease: { position: 'absolute', top: 0, bottom: 0 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  placeholderDisc: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' },
});
