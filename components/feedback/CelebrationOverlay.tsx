import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { CelebrationItem, useFeedbackStore } from '@/lib/feedback/store';

// ── Confetti rain ───────────────────────────────────────────────────────────
// ~80 pieces falling from the top with rotation, horizontal flutter and gravity.
// Brand palette (vert + ambre) + blanc/or. Reanimated only — zéro dépendance.

const CONFETTI_COUNT = 80;
const PALETTE = [COLORS.greenBrand, COLORS.orangeBrand, COLORS.amber, '#F4F4F2', '#E8C547'];
const MAX_LIFE = 3000; // ms — longest fall + stagger, then auto-clear

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

interface Piece {
  startX: number;
  w: number;
  h: number;
  radius: number;
  color: string;
  duration: number;
  delay: number;
  driftAmp: number;
  driftFreq: number;
  rotations: number;
  dir: number;
}

export function CelebrationOverlay({ item }: { item: CelebrationItem }) {
  const { width, height } = useWindowDimensions();
  const clear = useFeedbackStore((s) => s.clearCelebration);

  // Generate the pieces once (random params live for this celebration only).
  const pieces = useRef<Piece[]>(
    Array.from({ length: CONFETTI_COUNT }).map(() => {
      const isCircle = Math.random() < 0.35;
      const size = rand(7, 13);
      return {
        startX: rand(0, width),
        w: isCircle ? size : rand(6, 11),
        h: isCircle ? size : rand(11, 17),
        radius: isCircle ? size / 2 : 1.5,
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        duration: rand(1900, 2800),
        delay: rand(0, 450),
        driftAmp: rand(25, 85) * (Math.random() < 0.5 ? -1 : 1),
        driftFreq: rand(1, 3),
        rotations: rand(2, 6),
        dir: Math.random() < 0.5 ? -1 : 1,
      };
    }),
  ).current;

  // Title timeline + lifecycle.
  const titleT = useSharedValue(0);
  useEffect(() => {
    titleT.value = withTiming(1, { duration: MAX_LIFE, easing: Easing.linear });
    const fb = setTimeout(() => clear(), MAX_LIFE);
    return () => clearTimeout(fb);
  }, []);

  const titleStyle = useAnimatedStyle(() => {
    const tv = titleT.value;
    const opacity = tv < 0.08 ? tv / 0.08 : tv > 0.85 ? Math.max(0, (1 - tv) / 0.15) : 1;
    const scale = tv < 0.12 ? 0.6 + (tv / 0.12) * 0.4 : 1;
    return { opacity, transform: [{ scale }, { translateY: (1 - Math.min(tv * 8, 1)) * 10 }] };
  });

  return (
    <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none">
      {pieces.map((p, i) => (
        <Confetto key={i} p={p} height={height} />
      ))}
      <Animated.Text style={[s.title, titleStyle]}>{item.title}</Animated.Text>
    </View>
  );
}

function Confetto({ p, height }: { p: Piece; height: number }) {
  const prog = useSharedValue(0);

  useEffect(() => {
    prog.value = withDelay(
      p.delay,
      withTiming(1, { duration: p.duration, easing: Easing.in(Easing.quad) }), // gravity
    );
  }, []);

  const style = useAnimatedStyle(() => {
    const y = interpolate(prog.value, [0, 1], [-40, height + 40]);
    const x = Math.sin(prog.value * p.driftFreq * Math.PI * 2) * p.driftAmp; // flutter
    const rotate = prog.value * p.rotations * 360 * p.dir;
    const opacity =
      prog.value < 0.04
        ? prog.value / 0.04
        : prog.value > 0.9
          ? Math.max(0, (1 - prog.value) / 0.1)
          : 1;
    return {
      opacity,
      transform: [{ translateX: x }, { translateY: y }, { rotate: `${rotate}deg` }],
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: p.startX,
          width: p.w,
          height: p.h,
          borderRadius: p.radius,
          backgroundColor: p.color,
        },
        style,
      ]}
    />
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  title: {
    position: 'absolute',
    top: '40%',
    color: darkTokens.text,
    fontFamily: FONTS.bebas,
    fontSize: 38,
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
