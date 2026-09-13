// components/request/StepCrumbs.tsx
// Rangée de puces : ce qui est déjà décidé (adresse, prestation). Une puce
// ramène à son étape, en arrière seulement.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import type { Crumb } from '@/lib/request/crumbs';

function Chip({ crumb, onJump }: { crumb: Crumb; onJump: (step: number) => void }) {
  const theme = useAppTheme();
  const press = usePressScale();
  return (
    <Pressable
      onPress={() => { feedback.haptic('light'); onJump(crumb.step); }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={crumb.label}
    >
      <Animated.View style={[s.chip, { backgroundColor: theme.surface }, press.style]}>
        <Feather name="check" size={12} color={COLORS.greenBrand} />
        <Text style={[s.text, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{crumb.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function StepCrumbs({ crumbs, onJump }: { crumbs: Crumb[]; onJump: (step: number) => void }) {
  if (crumbs.length === 0) return null;
  return (
    <View style={s.row}>
      {crumbs.map((c) => <Chip key={c.step} crumb={c} onJump={onJump} />)}
    </View>
  );
}

const s = StyleSheet.create({
  row:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 24, paddingTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 8, paddingRight: 10, borderRadius: 999, maxWidth: 220 },
  text: { fontFamily: FONTS.sans, fontSize: 12, flexShrink: 1 },
});
