import React, { useEffect } from 'react';
import { StyleSheet, Text, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, runOnJS, Easing } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { ToastItem, useFeedbackStore } from '@/lib/feedback/store';

const ICON: Record<ToastItem['type'], keyof typeof Feather.glyphMap> = {
  success: 'check-circle', error: 'x-circle', info: 'info',
};
const ACCENT: Record<ToastItem['type'], string> = {
  success: COLORS.greenBrand, error: COLORS.red, info: COLORS.orangeBrand,
};

export function Toast({ item }: { item: ToastItem }) {
  const theme = useAppTheme();
  const progress = useSharedValue(0);
  const dismiss = useFeedbackStore((s) => s.dismissToast);

  useEffect(() => {
    progress.value = withSequence(
      withTiming(1, { duration: 280, easing: Easing.out(Easing.back(1.4)) }),
      withDelay(2500, withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(dismiss)(item.id);
      })),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * -16 }],
  }));

  return (
    <Animated.View style={[s.pill, { backgroundColor: theme.cardBg, borderLeftColor: ACCENT[item.type] }, style]}>
      <Feather name={ICON[item.type]} size={18} color={ACCENT[item.type]} />
      <Text style={[s.text, { color: theme.text }]} numberOfLines={2}>{item.message}</Text>
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
