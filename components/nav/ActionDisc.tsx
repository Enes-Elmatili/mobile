// components/nav/ActionDisc.tsx — le disque détaché à droite de la barre.
// Un objet, plusieurs formes, à la place qu'iOS 26 réserve à son bouton de
// recherche : GO vert · stop plein (surface) · flèche ambre (prestataire) ;
// « + » · flèche ambre (client). Le passage d'une forme à l'autre est UN
// mouvement (la couleur glisse depuis la couleur courante, un léger rebond
// d'échelle) ; l'haptique part à l'appui, sur la frame du geste.
//
// Le stop n'est plus en verre : un GlassView/BlurView monté sous un parent
// dont l'opacité bouge se dessine gris une frame puis transparent — c'était
// le « gris puis transparent » après un appui sur GO. L'opacité n'anime plus
// que l'apparition ; le rebond de forme ne touche que l'échelle.
import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, alpha, COLORS, FONTS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import type { DiscKind } from '@/stores/nav';

export const DISC_SIZE = 64;

type Props = { kind: DiscKind; onPress?: () => void; label?: string; style?: object };

function ActionDiscBase({ kind, onPress, label, style }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const press = usePressScale(0.94);
  const hidden = kind === 'hidden';
  // Toujours une vraie couleur : caché, le disque garde la dernière (jamais
  // d'interpolation vers « transparent », qui passe par un gris sale).
  const fill = kind === 'go' ? COLORS.greenBrand
    : kind === 'busy' || kind === 'track' ? COLORS.amber
    : kind === 'plus' ? (theme.accent as string)
    : kind === 'stop' ? (theme.surface as string)
    : null;
  const fg = kind === 'plus' ? (theme.accentText as string) : '#0A0A0A';

  // Présence : échelle + opacité. Forme : un rebond d'échelle seul (0,92 → 1).
  const shown = useSharedValue(hidden ? 0 : 1);
  const bump = useSharedValue(1);
  const color = useSharedValue(fill ?? COLORS.greenBrand);
  useEffect(() => {
    shown.value = reduced ? withTiming(hidden ? 0 : 1, { duration: 150 }) : withSpring(hidden ? 0 : 1, MOTION.take);
  }, [hidden, reduced, shown]);
  useEffect(() => {
    // Part de la couleur courante (interruptible) : deux changements rapprochés ne sautent pas.
    if (fill) color.value = withTiming(fill, { duration: reduced ? 150 : 240 });
    if (!hidden && !reduced) bump.value = withSequence(withTiming(0.92, { duration: 90 }), withSpring(1, MOTION.take));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le rebond suit la forme
  }, [kind, fill]);
  const style_ = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: shown.value * bump.value }] }));
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: color.value }));

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
          <Animated.View style={[StyleSheet.absoluteFill, s.round, s.shadow, bgStyle, { borderColor: kind === 'stop' ? alpha(theme.text as string, 0.14) : 'rgba(255,255,255,0.35)' }]} />
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
