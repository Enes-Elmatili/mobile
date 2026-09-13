// components/feedback/CelebrationOverlay.tsx
// Célébration = un sceau, pas une pluie. Anneau qui se ferme (600 ms), coche
// qui se trace (ressort), titre qui respire, puis tout s'efface. Une seule
// haptique, émise par le moteur feedback en amont (règle 6). Zéro confetti :
// le spec l'interdit — rien ne bouge sans dire quelque chose.
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { darkTokens, FONTS, COLORS } from '@/hooks/use-app-theme';
import { CelebrationItem, useFeedbackStore } from '@/lib/feedback/store';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { useTraceStroke } from '@/lib/motion/useTraceStroke';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const R = 34;
const RING_LENGTH = 2 * Math.PI * R;
/** « M30 43 L38.5 51.5 L55 34 » : √(8,5²+8,5²) + √(16,5²+17,5²) ≈ 12,0 + 24,0. */
const CHECK_LENGTH = 36;
const LIFE_MS = 1600;

export function CelebrationOverlay({ item }: { item: CelebrationItem }) {
  const clear = useFeedbackStore((s) => s.clearCelebration);
  const reduced = useReduceMotion();
  const [checkDrawn, setCheckDrawn] = useState(false);
  const ring = useSharedValue(reduced ? 0 : RING_LENGTH);
  const title = useSharedValue(0);
  const out = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      setCheckDrawn(true);
      title.value = withTiming(1, { duration: 200 });
      return;
    }
    ring.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) });
    const t = setTimeout(() => setCheckDrawn(true), 420);
    title.value = withDelay(500, withSpring(1, MOTION.pane));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- séquence jouée une fois au montage
  }, []);

  useEffect(() => {
    const fade = setTimeout(() => { out.value = withTiming(0, { duration: 220 }); }, LIFE_MS - 220);
    const done = setTimeout(clear, LIFE_MS);
    return () => { clearTimeout(fade); clearTimeout(done); };
  }, [clear, out]);

  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: ring.value }));
  const { animatedProps: checkProps } = useTraceStroke(checkDrawn, { length: CHECK_LENGTH });
  const wrapStyle = useAnimatedStyle(() => ({ opacity: out.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: title.value,
    transform: [{ translateY: 8 * (1 - title.value) }, { scale: 0.96 + 0.04 * title.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.center, wrapStyle]} pointerEvents="none">
      <View style={s.badge}>
        <Svg width={84} height={84} viewBox="0 0 84 84">
          <Circle cx={42} cy={42} r={R} fill="none" stroke={darkTokens.border} strokeWidth={2} />
          <AnimatedCircle
            cx={42} cy={42} r={R} fill="none" stroke={COLORS.greenBrand} strokeWidth={2.5} strokeLinecap="round"
            strokeDasharray={RING_LENGTH} animatedProps={ringProps} transform="rotate(-90 42 42)"
          />
          <AnimatedPath
            d="M30 43 L38.5 51.5 L55 34" fill="none" stroke={COLORS.greenBrand} strokeWidth={4}
            strokeLinecap="round" strokeLinejoin="round" strokeDasharray={CHECK_LENGTH} animatedProps={checkProps}
          />
        </Svg>
      </View>
      <Animated.Text style={[s.title, titleStyle]}>{item.title}</Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 18 },
  badge: { width: 84, height: 84, borderRadius: 42, backgroundColor: darkTokens.cardBg, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: darkTokens.text,
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 34, letterSpacing: 1, textAlign: 'center', paddingHorizontal: 24,
  },
});
