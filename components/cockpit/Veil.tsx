// components/cockpit/Veil.tsx — la carte s'éteint hors ligne. MapView n'a pas
// de filtre : un voile sombre à l'opacité animée fait le même travail, et une
// étiquette au centre dit pourquoi (« vous êtes invisible » / « sans position,
// rien n'arrive »). En ligne, le voile se lève et la carte s'allume.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useReduceMotion } from '@/lib/motion/sheet';

type Props = { dimmed: boolean; label: string | null };

export function Veil({ dimmed, label }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const p = useSharedValue(dimmed ? 1 : 0);
  useEffect(() => { p.value = withTiming(dimmed ? 1 : 0, { duration: reduced ? 200 : 700 }); }, [dimmed, reduced, p]);
  const veil = useAnimatedStyle(() => ({ opacity: p.value * 0.62 }));
  const tag = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * -8 }] }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.isDark ? '#000' : '#F4F4F2' }, veil]} />
      {label ? (
        <Animated.View style={[s.tagWrap, tag]}>
          <Text style={[s.tag, { color: theme.textMuted, backgroundColor: theme.isDark ? 'rgba(10,10,10,0.7)' : 'rgba(255,255,255,0.8)' }]} maxFontSizeMultiplier={1.1}>{label.toUpperCase()}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  tagWrap: { position: 'absolute', left: 0, right: 0, top: '34%', alignItems: 'center' },
  tag: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 2, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, overflow: 'hidden' },
});
