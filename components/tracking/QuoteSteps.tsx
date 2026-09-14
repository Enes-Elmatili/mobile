// components/tracking/QuoteSteps.tsx
// Les quatre étapes du devis : envoyée, frais payés, diagnostic sur place,
// devis sous 72 h. Faites = coche verte, en cours = bord accent.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { formatEUR } from '@/lib/format';

type Props = { calloutFee: number | null; current: 'diag' | '72h' };

export function QuoteSteps({ calloutFee, current }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const steps: { key: string; label: string; state: 'done' | 'now' | 'next' }[] = [
    { key: 'sent', label: t('tracking.quote_step_sent'), state: 'done' },
    { key: 'paid', label: t('tracking.quote_step_paid', { amount: calloutFee != null ? formatEUR(calloutFee, 0) : '' }).trim(), state: 'done' },
    { key: 'diag', label: t('tracking.quote_step_diag'), state: current === 'diag' ? 'now' : 'done' },
    { key: '72h', label: t('tracking.quote_step_72h'), state: current === '72h' ? 'now' : 'next' },
  ];
  return (
    <View style={s.row} accessibilityRole="list">
      {steps.map((st) => (
        <View key={st.key} style={[s.step, { backgroundColor: theme.bg }, st.state === 'now' && { borderWidth: 1, borderColor: theme.accent }]}>
          <Text style={[s.label, { color: st.state === 'next' ? theme.textSub : theme.text }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>
            {st.state === 'done' ? <Text style={{ color: theme.greenText }}>✓ </Text> : null}{st.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 14 },
  step: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: FONTS.sansMedium, fontSize: 9.5, lineHeight: 12, textAlign: 'center' },
});
