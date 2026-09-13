// components/ui/PulseDot.tsx — Green pulsing dot (FIXED brand signature)
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { COLORS } from '@/hooks/use-app-theme';
import { useReduceMotion } from '@/lib/motion/sheet';

interface Props {
  size?: number;
  color?: string;
}

export function PulseDot({ size = 6, color = COLORS.green }: Props) {
  const reduced = useReduceMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduced) { opacity.value = 1; return; }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        Platform.OS === 'ios' && { shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: size },
        style,
      ]}
    />
  );
}
