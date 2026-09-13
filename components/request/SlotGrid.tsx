// components/request/SlotGrid.tsx
// Tableau des créneaux (planche 3A) : une ligne par moment de la journée,
// quatre colonnes égales, l'étiquette en première colonne. Les cases
// manquantes restent vides. Les créneaux inertes (passés) sont grisés.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';

type Group = { label: string; slots: string[] };
type Props = {
  groups: Group[];
  selected: string | null;
  onSelect: (slot: string) => void;
  isDisabled: (slot: string) => boolean;
  columns?: number;
};

export function SlotGrid({ groups, selected, onSelect, isDisabled, columns = 4 }: Props) {
  const theme = useAppTheme();
  return (
    <View style={s.grid}>
      {groups.map((g) => (
        <View key={g.label} style={s.row}>
          <Text style={[s.rowLabel, { color: theme.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{g.label.toUpperCase()}</Text>
          {Array.from({ length: columns }, (_, i) => {
            const slot = g.slots[i];
            if (!slot) return <View key={`empty-${i}`} style={s.cell} />;
            const active = slot === selected;
            const off = isDisabled(slot);
            return (
              <Pressable
                key={slot}
                disabled={off}
                onPress={() => { if (!active) { feedback.haptic('selection'); onSelect(slot); } }}
                accessibilityRole="button"
                accessibilityLabel={`${g.label} ${slot}`}
                accessibilityState={{ selected: active, disabled: off }}
                style={[s.cell, s.cellFilled, { backgroundColor: theme.surface }, active && { backgroundColor: theme.accent }, off && s.cellOff]}
              >
                <Text style={[s.time, { color: active ? theme.accentText : off ? theme.textMuted : theme.textSub }]} maxFontSizeMultiplier={1.2}>{slot}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid:       { paddingTop: 18, gap: 8 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel:   { width: 64, fontFamily: FONTS.sansMedium, fontSize: 11, letterSpacing: 0.8 },
  cell:       { flex: 1, height: 40 },
  cellFilled: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellOff:    { opacity: 0.4 },
  time:       { fontFamily: FONTS.sansMedium, fontSize: 13, fontVariant: ['tabular-nums'] },
});
