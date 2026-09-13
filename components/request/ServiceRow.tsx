// components/request/ServiceRow.tsx
// Une prestation (planche 2A, sans montant) : nom, description sur une ligne,
// pastille « Prix fixe » / « Sur devis », radio qui « prend » sur MOTION.take.
// Aucune ligne n'est estompée : la sélection se lit sur le fond et le radio.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

type Props = {
  label: string;
  description?: string | null;
  /** "fixed_forfait" | "estimate" | "diagnostic" (Subcategory.pricingMode) */
  pricingMode?: string | null;
  selected: boolean;
  onPress: () => void;
  fixedLabel: string;
  quoteLabel: string;
};

export function ServiceRow({ label, description, pricingMode, selected, onPress, fixedLabel, quoteLabel }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const press = usePressScale(0.98);
  const isQuote = pricingMode === 'estimate' || pricingMode === 'diagnostic';

  const check = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    const target = selected ? 1 : 0;
    check.value = reduced ? withTiming(target, { duration: 100 }) : withSpring(target, MOTION.take);
  }, [selected, reduced, check]);
  const checkStyle = useAnimatedStyle(() => ({ opacity: check.value, transform: [{ scale: check.value }] }));

  return (
    <Pressable
      onPress={() => { feedback.haptic('selection'); onPress(); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={`${label}, ${isQuote ? quoteLabel : fixedLabel}`}
    >
      <Animated.View style={[s.row, { borderBottomColor: theme.borderLight }, selected && { backgroundColor: theme.surfaceAlt, borderBottomColor: 'transparent' }, press.style]}>
        <View style={s.main}>
          <Text style={[s.name, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{label}</Text>
          {description ? (
            <Text style={[s.desc, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{description}</Text>
          ) : null}
        </View>
        <View style={[s.pill, { backgroundColor: isQuote ? 'rgba(200,130,10,0.15)' : 'rgba(21,193,110,0.15)' }]}>
          <Text style={[s.pillText, { color: isQuote ? COLORS.amber : theme.greenText }]} maxFontSizeMultiplier={1.2}>{isQuote ? quoteLabel : fixedLabel}</Text>
        </View>
        <View style={[s.radio, { borderColor: selected ? theme.accent : theme.border, backgroundColor: selected ? theme.accent : 'transparent' }]}>
          <Animated.View style={checkStyle}>
            <Feather name="check" size={13} color={theme.accentText as string} />
          </Animated.View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 8, borderRadius: 14, borderBottomWidth: 1 },
  main:     { flex: 1, minWidth: 0 },
  name:     { fontFamily: FONTS.sansMedium, fontSize: 15 },
  desc:     { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 2 },
  pill:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, minWidth: 70, alignItems: 'center' },
  pillText: { fontFamily: FONTS.sansMedium, fontSize: 11 },
  radio:    { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
