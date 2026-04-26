// components/ui/StatStrip.tsx — Row of stat items separated by 1px dividers
// Design system pattern: DM Mono label (uppercase) + Bebas value + optional unit
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

interface StatItemData {
  label: string;
  value: string | number;
  unit?: string;
}

interface StatStripProps {
  items: StatItemData[];
}

export default function StatStrip({ items }: StatStripProps) {
  const theme = useAppTheme();
  return (
    <View style={s.row}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={[s.sep, { backgroundColor: theme.borderLight }]} />}
          <View style={s.item}>
            <Text style={[s.label, { color: theme.textMuted }]}>{item.label}</Text>
            <View style={s.valueRow}>
              <Text style={[s.value, { color: theme.text }]}>{item.value}</Text>
              {item.unit ? (
                <Text style={[s.unit, { color: theme.textSub }]}>{item.unit}</Text>
              ) : null}
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  sep: { width: 1, marginVertical: 4 },
  item: { flex: 1, paddingHorizontal: 4 },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: {
    fontFamily: FONTS.bebas,
    fontSize: 24,
    lineHeight: 24,
  },
  unit: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
});
