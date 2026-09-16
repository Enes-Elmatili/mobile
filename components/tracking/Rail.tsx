// components/tracking/Rail.tsx — la chronologie en rail vertical à points :
// les faits passés en vert, le prévu en creux, l'heure en mono à droite.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

export type RailRow = { key: string; label: string; when?: string | null; done?: boolean };

export function Rail({ rows }: { rows: RailRow[] }) {
  const theme = useAppTheme();
  return (
    <View style={s.wrap} accessibilityRole="list">
      <View style={[s.line, { backgroundColor: theme.borderLight }]} />
      {rows.map((r) => (
        <View key={r.key} style={s.row} accessible accessibilityLabel={`${r.label}${r.when ? `, ${r.when}` : ''}`}>
          <View style={[s.dot, { borderColor: r.done ? theme.greenText : theme.border, backgroundColor: r.done ? theme.greenText : theme.cardBg }]} />
          <Text style={[s.label, { color: r.done ? theme.text : theme.textSub }, r.done && { fontFamily: FONTS.sansMedium }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{r.label}</Text>
          {r.when ? <Text style={[s.when, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{r.when}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 16, position: 'relative' },
  line: { position: 'absolute', left: 5, top: 10, bottom: 10, width: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  label: { flex: 1, fontFamily: FONTS.sans, fontSize: 13.5 },
  when: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 0.5, fontVariant: ['tabular-nums'] },
});
