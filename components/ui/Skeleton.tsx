// components/ui/Skeleton.tsx
// Moment 18 : les blocs de chargement RESPIRENT en opacité (0,4 ↔ 0,7, 1,2 s),
// pas de shimmer qui balaie. Le contenu réel arrive ensuite en cascade dans
// la même géométrie (CascadeItem) : la mise en page ne bouge pas d'un pixel.
// Sous reduce-motion, le bloc est figé à mi-opacité.
import React, { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useReduceMotion } from '@/lib/motion/sheet';

type Props = {
  w?: DimensionValue;
  h: number;
  r?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ w = '100%', h, r = 8, style }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    if (reduced) { opacity.value = 0.55; return; }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: theme.surface }, animated, style]} />;
}
