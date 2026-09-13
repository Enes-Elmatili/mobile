// components/ui/SegmentedControl.tsx
// Contrôle segmenté (2 à 3 options) : piste `surface`, indicateur `accent` qui
// glisse sous l'option active sur MOTION.tab depuis sa position courante.
// `value` peut être null : l'indicateur est alors invisible.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { useReduceMotion } from '@/lib/motion/sheet';
import { feedback } from '@/lib/feedback/feedback';

export type SegmentOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
};

const PAD = 3;

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = useAppTheme();
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(0);
  const index = options.findIndex((o) => o.value === value);
  const slot = width > 0 ? (width - PAD * 2) / options.length : 0;

  const x = useSharedValue(Math.max(0, index) * slot);
  const visible = useSharedValue(index >= 0 ? 1 : 0);
  useEffect(() => {
    const target = Math.max(0, index) * slot;
    x.value = reduced ? withTiming(target, { duration: 120 }) : withSpring(target, MOTION.tab);
    visible.value = withTiming(index >= 0 ? 1 : 0, { duration: 120 });
  }, [index, slot, reduced, x, visible]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], opacity: visible.value, width: slot }));

  return (
    <View
      style={[s.track, { backgroundColor: theme.surface }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityRole="tablist"
    >
      <Animated.View pointerEvents="none" style={[s.indicator, { backgroundColor: theme.accent }, indicator]} />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={s.item}
            onPress={() => { if (!active) { feedback.haptic('selection'); onChange(o.value); } }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
          >
            <Text style={[s.label, { color: active ? theme.accentText : theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track:     { flexDirection: 'row', borderRadius: 12, padding: PAD, position: 'relative' },
  indicator: { position: 'absolute', top: PAD, bottom: PAD, left: PAD, borderRadius: 9 },
  item:      { flex: 1, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  label:     { fontFamily: FONTS.sansMedium, fontSize: 14 },
});
