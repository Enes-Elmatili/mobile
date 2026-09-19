import React, { useEffect } from 'react';
import { StyleSheet, Text, Platform, Pressable, View } from 'react-native';
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
  const retract = () => {
    progress.value = withSpring(0, RETRACT_SPRING, (finished) => {
      if (finished) runOnJS(dismiss)(item.id);
    });
  };
  useEffect(() => {
    progress.value = withSpring(1, MOTION.island);
    const t = setTimeout(retract, item.durationMs ?? VISIBLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cycle de vie d'un toast
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduced
      ? []
      : [{ translateY: -8 * (1 - progress.value) }, { scaleX: 0.6 + 0.4 * progress.value }],
  }));

  // Toast de notification : fond plein, titre, action — depuis l'île, comme les autres.
  if (item.title) {
    const green = item.tone === 'green';
    const bg = green ? COLORS.greenBrand : (theme.accent as string);
    const fg = green ? '#0A0A0A' : (theme.accentText as string);
    const onAction = () => { const a = item.action; retract(); a?.onPress(); };
    return (
      <Animated.View style={[s.card, { backgroundColor: bg }, style]} accessible accessibilityRole="alert" accessibilityLabel={`${item.title}. ${item.message}`}>
        <View style={[s.cardIcon, { backgroundColor: green ? 'rgba(10,10,10,0.1)' : theme.isDark ? 'rgba(10,10,10,0.1)' : 'rgba(255,255,255,0.14)' }]}>
          <Feather name={green ? 'credit-card' : 'bell'} size={17} color={fg} />
        </View>
        <View style={s.cardBody}>
          <Text style={[s.cardTitle, { color: fg }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{item.title}</Text>
          <Text style={[s.cardMsg, { color: fg }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{item.message}</Text>
        </View>
        {item.action ? (
          <Pressable onPress={onAction} style={({ pressed }) => [s.cardAction, { backgroundColor: green ? 'rgba(10,10,10,0.12)' : theme.isDark ? 'rgba(10,10,10,0.12)' : 'rgba(255,255,255,0.16)', opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel={item.action.label} hitSlop={6}>
            <Text style={[s.cardActionText, { color: fg }]} maxFontSizeMultiplier={1.1}>{item.action.label.toUpperCase()}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    );
  }

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
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 14 },
    }),
  },
  cardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontFamily: FONTS.sansBold, fontSize: 14, lineHeight: 18 },
  cardMsg: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 17, opacity: 0.85, marginTop: 1 },
  cardAction: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 999 },
  cardActionText: { fontFamily: FONTS.bebas, fontSize: 15, letterSpacing: 1, includeFontPadding: false },
});
