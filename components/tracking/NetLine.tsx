// components/tracking/NetLine.tsx — ce que le prestataire gagne, toujours
// visible : « 245 € net · Prix fixe 306,81 € · commission 20 % ».
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { formatEUR } from '@/lib/format';
import { isQuoteMode, netFor, type MissionBrief } from '@/lib/mission/brief';

export function NetLine({ brief, commissionRate, sub }: { brief: MissionBrief; commissionRate?: number | null; sub?: string | null }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const gross = brief.money.gross;
  // Le taux figé sur la mission prime sur le net de la fiche (taux courant).
  const net = commissionRate != null && gross ? Math.round(gross * (1 - commissionRate) * 100) / 100 : netFor(brief);
  const quote = isQuoteMode(brief.money.pricingMode ?? brief.service.pricingMode);
  const rate = commissionRate ?? (gross && net != null ? Math.round((1 - net / gross) * 100) / 100 : null);
  const line = sub ?? (
    net != null && gross
      ? `${quote ? t('mission.quote') : t('mission.fixed')} ${formatEUR(gross)}${rate != null ? ` · ${t('gains.commission', { rate: Math.round(rate * 100) }).replace(/^[^·]*·\s*/, '')}` : ''}`
      : quote ? t('tracking.callout_promise') : ''
  );
  return (
    <View style={[s.row, { borderTopColor: theme.borderLight }]} accessible accessibilityLabel={`${net != null ? formatEUR(net, 0) : ''} ${t('mission.net')}. ${line}`}>
      <View style={s.amt}>
        <Text style={[s.net, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{net != null ? formatEUR(net, 0) : (brief.money.calloutFee != null ? formatEUR(brief.money.calloutFee, 0) : '—')}</Text>
        <Text style={[s.cap, { color: theme.textSub }]}>{net != null ? t('mission.net') : t('mission.callout')}</Text>
      </View>
      {line ? <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{line}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  amt: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  net: { fontFamily: FONTS.bebas, fontSize: 26, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  cap: { fontFamily: FONTS.sans, fontSize: 12 },
  sub: { flex: 1, textAlign: 'right', fontFamily: FONTS.sans, fontSize: 11.5, lineHeight: 15 },
});
