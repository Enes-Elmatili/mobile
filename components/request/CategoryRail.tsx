// components/request/CategoryRail.tsx
// Rangée de pilules de catégories (planche 2A). Jusqu'à trois catégories les
// pilules se partagent la largeur (aspect segmenté) ; au-delà elles prennent
// la largeur de leur libellé et la rangée défile, avec un fondu à droite.
// Prêt pour les services qui s'ouvriront plus tard : aucune limite codée.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';

export type RailItem = { id: number; label: string };

type Props = { items: RailItem[]; selectedId: number | null; onSelect: (id: number) => void };

function Pill({ label, active, fill, onPress }: { label: string; active: boolean; fill: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const press = usePressScale();
  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={fill && s.fillItem}
    >
      <Animated.View style={[s.pill, { backgroundColor: active ? theme.accent : theme.surface }, press.style]}>
        <Text style={[s.label, { color: active ? theme.accentText : theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export function CategoryRail({ items, selectedId, onSelect }: Props) {
  const theme = useAppTheme();
  const fill = items.length <= 3;
  const select = (id: number) => {
    if (id === selectedId) return;
    feedback.haptic('selection');
    onSelect(id);
  };
  if (fill) {
    return (
      <View style={s.rowFill}>
        {items.map((it) => <Pill key={it.id} label={it.label} active={it.id === selectedId} fill onPress={() => select(it.id)} />)}
      </View>
    );
  }
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rowScroll}>
        {items.map((it) => <Pill key={it.id} label={it.label} active={it.id === selectedId} fill={false} onPress={() => select(it.id)} />)}
      </ScrollView>
      <LinearGradient
        colors={[`${theme.bg}00`, theme.bg as string]}
        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
        style={s.fade}
        pointerEvents="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  rowFill:   { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 12 },
  rowScroll: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 12, paddingRight: 48 },
  fillItem:  { flex: 1 },
  pill:      { height: 40, borderRadius: 20, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  label:     { fontFamily: FONTS.sansMedium, fontSize: 14 },
  fade:      { position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 },
});
