// components/ui/BrandRefresh.tsx
// Moment 17 : le « fixed. » s'étire avec le tirage et claque en place au
// relâchement. Le RefreshControl natif garde le DÉCLENCHEMENT (fiable, et
// l'élastique du scroll est natif) ; cet en-tête ne porte que le visuel,
// piloté par le scroll négatif sur le thread UI. Aucun conflit de gestes.
//
//   const { onScroll, headerStyle } = useBrandRefresh();
//   <BrandRefreshHeader style={headerStyle} />
//   <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}
//     refreshControl={<RefreshControl … tintColor="transparent" colors={['transparent']} />}>
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useReduceMotion } from '@/lib/motion/sheet';

const PULL_MAX = 80;

export function useBrandRefresh() {
  const reduced = useReduceMotion();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const headerStyle = useAnimatedStyle(() => {
    const pull = Math.max(0, -scrollY.value);
    const p = Math.min(1, pull / PULL_MAX);
    return {
      opacity: Math.min(1, pull / 30),
      transform: reduced
        ? [{ translateY: pull * 0.5 }]
        : [{ translateY: pull * 0.5 }, { scaleY: 1 + p * 0.35 }, { scaleX: 1 - p * 0.08 }],
    };
  });
  return { onScroll, headerStyle, scrollY };
}

export function BrandRefreshHeader({ style, top = 0 }: { style: ReturnType<typeof useAnimatedStyle>; top?: number }) {
  const theme = useAppTheme();
  return (
    <Animated.View pointerEvents="none" style={[s.wrap, { top }, style]}>
      <Text style={[s.logo, { color: theme.text }]}>
        fixed<Text style={{ color: COLORS.greenBrand }}>.</Text>
      </Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 2 },
  logo: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 34, letterSpacing: 1, lineHeight: 36 },
});
