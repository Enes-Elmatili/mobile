import React, { useEffect } from 'react';
import { StyleSheet, Text, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { ToastItem, useFeedbackStore } from '@/lib/feedback/store';
import { MOTION, spring } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';

const ICON: Record<ToastItem['type'], keyof typeof Feather.glyphMap> = {
  success: 'check-circle', error: 'x-circle', info: 'info',
};
const ACCENT: Record<ToastItem['type'], string> = {
  success: COLORS.greenBrand, error: COLORS.red, info: COLORS.orangeBrand,
};

const RETRACT_SPRING = spring(300, 1.0);
const VISIBLE_MS = 2500;

export function Toast({ item }: { item: ToastItem }) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const progress = useSharedValue(0);
  const dismiss = useFeedbackStore((s) => s.dismissToast);

  // Moment 16 : le toast s'ÉTEND depuis l'île (largeur puis opacité, ressort
  // ζ 0,9) et se rétracte au même endroit (ζ 1, plus raide). Il ne tombe pas
  // du ciel : on sait d'où il vient et où il est parti.
  useEffect(() => {
    progress.value = withSpring(1, MOTION.island);
    const t = setTimeout(() => {
      progress.value = withSpring(0, RETRACT_SPRING, (finished) => {
        if (finished) runOnJS(dismiss)(item.id);
      });
    }, VISIBLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cycle de vie d'un toast
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduced
      ? []
      : [{ translateY: -8 * (1 - progress.value) }, { scaleX: 0.6 + 0.4 * progress.value }],
  }));

  return (
    <Animated.View style={[s.pill, { backgroundColor: theme.cardBg, borderLeftColor: ACCENT[item.type] }, style]}>
      <Feather name={ICON[item.type]} size={18} color={ACCENT[item.type]} />
      <Text style={[s.text, { color: theme.text }]} numberOfLines={8}>{item.message}</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderLeftWidth: 3,
    paddingHorizontal: 16, paddingVertical: 13,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 12 },
    }),
  },
  text: { flex: 1, fontFamily: FONTS.sansMedium, fontSize: 14 },
});
