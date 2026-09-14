// components/gains/Ledger.tsx — les trois lignes de l'argent d'une mission :
// payé par le client, commission FIXED au taux réel de la mission, net.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { formatEURCents } from '@/lib/format';

type Props = { gross: number | null; commission: number | null; rate: number | null; net: number; /** Fond de la carte. */ tone?: 'card' | 'bg' };

export function Ledger({ gross, commission, rate, net, tone = 'card' }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const rows: { key: string; label: string; value: string; total?: boolean }[] = [];
  if (gross != null) rows.push({ key: 'gross', label: t('gains.paid_by_client'), value: formatEURCents(gross) });
  if (commission != null) rows.push({ key: 'commission', label: rate != null ? t('gains.commission', { rate: Math.round(rate * 100) }) : t('gains.commission_unknown'), value: `−${formatEURCents(commission)}` });
  rows.push({ key: 'net', label: t('gains.your_net'), value: formatEURCents(net), total: true });
  return (
    <View style={[s.card, { backgroundColor: tone === 'card' ? theme.surface : theme.bg }]} accessibilityRole="summary">
      {rows.map((r, i) => (
        <View key={r.key} style={[s.row, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}>
          <Text style={[s.label, { color: r.total ? theme.text : theme.textSub }, r.total && { fontFamily: FONTS.sansMedium }]} maxFontSizeMultiplier={1.3}>{r.label}</Text>
          <Text style={[s.value, { color: theme.text }, r.total && s.valueTotal]} maxFontSizeMultiplier={1.2}>{r.value}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 10 },
  label: { fontFamily: FONTS.sans, fontSize: 13 },
  value: { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  valueTotal: { fontSize: 26 },
});
