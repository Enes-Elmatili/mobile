// components/request/StepHeader.tsx
// En-tête du stepper (planche 1A) : bouton retour, titre de l'étape en Bebas
// avec le compteur, une seule ligne de progression (2 pt) qui avance sur
// MOTION.pane depuis sa valeur courante, puis les puces des décisions prises.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { StepCrumbs } from './StepCrumbs';
import type { Crumb } from '@/lib/request/crumbs';
import { PressScale } from '@/components/ui/PressScale';

type Props = {
  step: number;
  total: number;
  title: string;
  onBack: () => void;
  backLabel: string;
  crumbs?: Crumb[];
  onJump?: (step: number) => void;
};

export function StepHeader({ step, total, title, onBack, backLabel, crumbs = [], onJump }: Props) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const progress = useSharedValue(step / total);

  useEffect(() => {
    const target = step / total;
    progress.value = reduced ? withTiming(target, { duration: 120 }) : withSpring(target, MOTION.pane);
  }, [step, total, reduced, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View>
      <View style={s.backRow}>
        <PressScale
          onPress={onBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={backLabel}
          accessibilityRole="button"
          style={[s.backBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
        >
          <Feather name="arrow-left" size={18} color={theme.text as string} />
        </PressScale>
      </View>
      <View style={s.titleRow}>
        <Text style={[s.title, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{title}</Text>
        <Text style={[s.counter, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{step} / {total}</Text>
      </View>
      <View style={[s.track, { backgroundColor: theme.border }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: step }}>
        <Animated.View style={[s.fill, { backgroundColor: theme.accent }, fill]} />
      </View>
      {onJump ? <StepCrumbs crumbs={crumbs} onJump={onJump} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  backRow:  { paddingHorizontal: 16, paddingVertical: 6 },
  backBtn:  { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 6 },
  title:    { fontFamily: FONTS.bebas, fontSize: 34, letterSpacing: 0.5, includeFontPadding: false, flexShrink: 1 },
  counter:  { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.5 },
  track:    { height: 2, marginTop: 12 },
  fill:     { height: '100%' },
});
