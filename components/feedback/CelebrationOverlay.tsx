import React, { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { CelebrationItem, useFeedbackStore } from '@/lib/feedback/store';

const PARTICLES = 12;

export function CelebrationOverlay({ item }: { item: CelebrationItem }) {
  const { width, height } = useWindowDimensions();
  const clear = useFeedbackStore((s) => s.clearCelebration);
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }, (finished) => {
      if (finished) runOnJS(clear)();
    });
    const fallback = setTimeout(() => clear(), 1400);
    return () => clearTimeout(fallback);
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ scale: 0.2 + t.value * 2.6 }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: t.value < 0.15 ? t.value / 0.15 : t.value > 0.8 ? (1 - t.value) / 0.2 : 1,
    transform: [{ translateY: (1 - t.value) * 12 }],
  }));

  return (
    <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none">
      <Animated.View style={[s.ring, { borderColor: COLORS.greenBrand }, ringStyle]} />
      {Array.from({ length: PARTICLES }).map((_, i) => (
        <Particle key={i} index={i} t={t} _cx={width / 2} _cy={height / 2} />
      ))}
      <Animated.Text style={[s.title, titleStyle]}>{item.title}</Animated.Text>
    </View>
  );
}

function Particle({
  index,
  t,
  _cx,
  _cy,
}: {
  index: number;
  t: SharedValue<number>;
  _cx: number;
  _cy: number;
}) {
  const angle = (index / PARTICLES) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const r = t.value * 150;
    return {
      opacity: 1 - t.value,
      transform: [
        { translateX: Math.cos(angle) * r },
        { translateY: Math.sin(angle) * r },
        { scale: 1 - t.value * 0.5 },
      ],
    };
  });
  const color = index % 2 === 0 ? COLORS.greenBrand : COLORS.orangeBrand;
  return <Animated.View style={[s.dot, { backgroundColor: color }, style]} />;
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 120, height: 120, borderRadius: 60, borderWidth: 3 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  title: {
    position: 'absolute',
    top: '40%',
    color: darkTokens.text,
    fontFamily: FONTS.bebas,
    fontSize: 34,
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
