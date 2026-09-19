// components/cockpit/GoButton.tsx — le GO. Un seul objet dit l'état : le
// disque vert au centre du dock = hors ligne ; le petit carré à gauche = en
// ligne ; disparu = une demande ou une mission occupe l'écran. Le passage de
// l'un à l'autre est UN mouvement (translation, échelle, couleur sur le même
// ressort), et l'haptique part sur la frame où le disque quitte le centre.
//
// Tout est en `transform` : la boîte garde la taille du GO, elle se déplace et
// se réduit — aucune propriété de layout n'est animée, le thread UI ne
// recalcule rien à chaque frame.
import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLayoutClass } from '@/lib/layout';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme, COLORS, FONTS, darkTokens } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

export const GO_SIZE = 84;
export const STOP_SIZE = 44;
export const DOCK_HEIGHT = 72;
const STOP_SCALE = STOP_SIZE / GO_SIZE;

type Props = {
  shape: 'go' | 'stop' | 'hidden';
  /** Bord bas du dock (px depuis le bas de l'écran). */
  dockBottom: number;
  onPress: () => void;
  accessibilityLabel: string;
};

function GoButtonBase({ shape, dockBottom, onPress, accessibilityLabel }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const { width } = useLayoutClass();
  const press = usePressScale(0.94);
  // 0 = GO au centre, 1 = stop à gauche.
  const p = useSharedValue(shape === 'stop' ? 1 : 0);
  const shown = useSharedValue(shape === 'hidden' ? 0 : 1);

  useEffect(() => {
    const target = shape === 'stop' ? 1 : 0;
    p.value = reduced ? withTiming(target, { duration: 200 }) : withSpring(target, MOTION.unfold);
    shown.value = withTiming(shape === 'hidden' ? 0 : 1, { duration: reduced ? 150 : 220 });
  }, [shape, reduced, p, shown]);

  // Position de repos = le GO, à cheval sur le bord haut du dock. Le stop est
  // exprimé comme un déplacement depuis là (centre à centre).
  const goLeft = width / 2 - GO_SIZE / 2;
  const goBottom = dockBottom + DOCK_HEIGHT - GO_SIZE / 2 - 6;
  const stopCenterX = 20 + STOP_SIZE / 2;
  const stopCenterBottom = dockBottom + DOCK_HEIGHT / 2;
  const dx = stopCenterX - width / 2;
  const dy = (goBottom + GO_SIZE / 2) - stopCenterBottom; // vers le bas = positif
  const green = COLORS.greenBrand;
  const surface = theme.surface as string;

  const shell = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateX: p.value * dx },
      { translateY: p.value * dy },
      { scale: interpolate(p.value, [0, 1], [1, STOP_SCALE]) * interpolate(shown.value, [0, 1], [0.6, 1]) },
    ],
  }));
  const disc = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [green, surface]) }));
  const ring = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.5], [1, 0]) }));
  const goText = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 0.4], [1, 0]) }));
  // Le carré garde 14 pt à l'écran : il compense l'échelle de la boîte.
  const stopSquare = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.6, 1], [0, 1]),
    transform: [{ scale: 1 / interpolate(p.value, [0, 1], [1, STOP_SCALE]) }],
  }));

  return (
    <Animated.View style={[s.wrap, { left: goLeft, bottom: goBottom, shadowOpacity: theme.isDark ? 0.45 : 0.18 }, shell]} pointerEvents={shape === 'hidden' ? 'none' : 'auto'}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPressIn={() => { press.onPressIn(); if (shape === 'go') feedback.haptic('medium'); }}
        onPressOut={press.onPressOut}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        hitSlop={8}
      >
        <Animated.View style={[s.inner, press.style]}>
          <Animated.View style={[StyleSheet.absoluteFill, s.disc, disc]} />
          <Animated.View style={[StyleSheet.absoluteFill, s.ring, { borderColor: theme.bg }, ring]} pointerEvents="none" />
          <Animated.View style={[StyleSheet.absoluteFill, s.center, goText]}>
            <Text style={s.go} maxFontSizeMultiplier={1}>GO</Text>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, s.center, stopSquare]}>
            <View style={[s.square, { backgroundColor: theme.text }]} />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const GoButton = memo(GoButtonBase);

const s = StyleSheet.create({
  wrap: { position: 'absolute', width: GO_SIZE, height: GO_SIZE, zIndex: 7, shadowColor: '#000', shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  inner: { flex: 1 },
  disc: { borderRadius: GO_SIZE / 2 },
  ring: { borderRadius: GO_SIZE / 2, borderWidth: 5 },
  center: { alignItems: 'center', justifyContent: 'center' },
  go: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 1.5, color: darkTokens.bg, includeFontPadding: false },
  square: { width: 14, height: 14, borderRadius: 3 },
});
