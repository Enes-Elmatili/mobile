// components/tracking/MoneyLine.tsx
// Le montant et sa promesse : « 89 € TTC · Prix fixe. Rien de plus à payer. »
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { formatEUR } from '@/lib/format';

type Props = { amount: number | null; caption: string; promise: string };

export function MoneyLine({ amount, caption, promise }: Props) {
  const theme = useAppTheme();
  return (
    <View style={[s.row, { borderColor: theme.border }]} accessible accessibilityLabel={`${amount != null ? formatEUR(amount, 0) : ''} ${caption}. ${promise}`}>
      <View style={s.amt}>
        {amount != null ? <Text style={[s.amount, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{formatEUR(amount, 0)}</Text> : null}
        <Text style={[s.cap, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{caption}</Text>
      </View>
      <Text style={[s.promise, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{promise}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  amt: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  amount: { fontFamily: FONTS.bebas, fontSize: 26, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  cap: { fontFamily: FONTS.sans, fontSize: 11.5 },
  promise: { flex: 1, textAlign: 'right', fontFamily: FONTS.sans, fontSize: 11.5, lineHeight: 15 },
});
