// components/nav/ActionDisc.tsx — le disque détaché à droite de la barre.
// Un objet, plusieurs formes, à la place qu'iOS 26 réserve à son bouton de
// recherche : GO vert · stop en verre · flèche ambre (prestataire) ;
// « + » · flèche ambre (client). Le passage d'une forme à l'autre est UN
// mouvement (couleur + contenu en fondu, un léger rebond d'échelle) ;
// l'haptique part à l'appui, sur la frame du geste.
import React, { memo, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, COLORS, FONTS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { GlassSurface } from './GlassSurface';
import type { DiscKind } from '@/stores/nav';

export const DISC_SIZE = 64;

type Props = { kind: DiscKind; onPress?: () => void; label?: string; style?: object };

function ActionDiscBase({ kind, onPress, label, style }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const press = usePressScale(0.94);
  const hidden = kind === 'hidden';
  const glass = kind === 'stop';
  const bg = kind === 'go' ? COLORS.greenBrand : kind === 'busy' || kind === 'track' ? COLORS.amber : kind === 'plus' ? (theme.accent as string) : 'transparent';
  const fg = kind === 'plus' ? (theme.accentText as string) : '#0A0A0A';

  // Présence (échelle + opacité) et couleur : la forme change en UN mouvement —
  // la couleur glisse de l'ancienne à la nouvelle pendant que le disque rebondit.
  const shown = useSharedValue(hidden ? 0 : 1);
  const tint = useSharedValue(1);
  const prevBg = useRef(bg);
  const from = prevBg.current;
  useEffect(() => {
    shown.value = reduced ? withTiming(hidden ? 0 : 1, { duration: 150 }) : withSpring(hidden ? 0 : 1, MOTION.take);
  }, [hidden, reduced, shown]);
  useEffect(() => {
    if (from !== bg) {
      tint.value = 0;
      tint.value = withTiming(1, { duration: reduced ? 150 : 260 });
      prevBg.current = bg;
    }
    // Un changement de forme visible : un petit rebond (0,92 → 1), jamais sous réduction des animations.
    if (!hidden && !reduced) shown.value = withSequence(withTiming(0.92, { duration: 90 }), withSpring(1, MOTION.take));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le rebond suit la forme
  }, [kind]);
  const style_ = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: shown.value }] }));
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(tint.value, [0, 1], [from, bg]) }));

  return (
    <Animated.View style={[s.wrap, style, style_]} pointerEvents={hidden ? 'none' : 'auto'}>
      <Pressable
        onPressIn={() => { press.onPressIn(); feedback.haptic(kind === 'go' ? 'medium' : 'light'); }}
        onPressOut={press.onPressOut}
        onPress={onPress}
        disabled={hidden || !onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: kind === 'stop' }}
        hitSlop={8}
        style={s.press}
      >
        <Animated.View style={[s.disc, press.style]}>
          {glass ? (
            <GlassSurface style={[StyleSheet.absoluteFill, s.round]} />
          ) : (
            <Animated.View style={[StyleSheet.absoluteFill, s.round, s.shadow, bgStyle, { borderColor: 'rgba(255,255,255,0.35)' }]} />
          )}
          <View style={s.center} pointerEvents="none">
            {kind === 'go' ? <Text style={s.go} maxFontSizeMultiplier={1}>GO</Text> : null}
            {kind === 'stop' ? <View style={[s.square, { backgroundColor: theme.text }]} /> : null}
            {kind === 'busy' || kind === 'track' ? <Feather name="arrow-right" size={24} color={fg} /> : null}
            {kind === 'plus' ? <Feather name="plus" size={26} color={fg} /> : null}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const ActionDisc = memo(ActionDiscBase);

const s = StyleSheet.create({
  wrap: { width: DISC_SIZE, height: DISC_SIZE },
  press: { flex: 1 },
  disc: { flex: 1 },
  shadow: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  round: { borderRadius: DISC_SIZE / 2, borderWidth: StyleSheet.hairlineWidth },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  go: { fontFamily: FONTS.bebas, fontSize: 24, letterSpacing: 1.5, color: '#0A0A0A', includeFontPadding: false },
  square: { width: 16, height: 16, borderRadius: 4 },
});
