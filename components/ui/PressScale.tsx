// components/ui/PressScale.tsx — le remplaçant direct de TouchableOpacity.
//
// Même API (Pressable + style), mais le retour se fait à l'APPUI par une
// échelle 0,97 en ressort critique sur le thread UI (règle 4), au lieu d'une
// opacité au relâchement. Le style s'applique au Pressable lui-même : un
// `flex: 1` ou une largeur se comportent exactement comme sur l'ancien
// TouchableOpacity. Sous « Réduire les animations », pas d'échelle : une
// légère baisse d'opacité, instantanée (règle 8).
import React from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { usePressScale, PRESS_SCALE } from '@/lib/motion/press';
import { useReduceMotion } from '@/lib/motion/sheet';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; scale?: number };

export function PressScale({ style, scale = PRESS_SCALE, onPressIn, onPressOut, children, ...rest }: Props) {
  const press = usePressScale(scale);
  const reduced = useReduceMotion();
  const dim = useSharedValue(1);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e: GestureResponderEvent) => { press.onPressIn(); if (reduced) dim.value = 0.6; onPressIn?.(e); }}
      onPressOut={(e: GestureResponderEvent) => { press.onPressOut(); dim.value = 1; onPressOut?.(e); }}
      style={[style, press.style, reduced && dimStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
