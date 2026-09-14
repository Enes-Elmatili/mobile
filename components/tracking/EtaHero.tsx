// components/tracking/EtaHero.tsx
// Les minutes d'abord : rouleau de chiffres (DigitReel) et « MIN · 1,1 KM ».
// Sans position GPS du prestataire : « Départ confirmé », pas de « Calcul… ».
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { DigitReel } from '@/components/ui/DigitReel';

type Props = { etaMin: number | null; distanceKm: number | null; hasGps: boolean };

export function EtaHero({ etaMin, distanceKm, hasGps }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  if (!hasGps || etaMin == null) {
    return (
      <View style={s.wrap}>
        <Text style={[s.fallbackTitle, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('tracking.no_gps_title')}</Text>
        <Text style={[s.fallbackSub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('tracking.no_gps_sub')}</Text>
      </View>
    );
  }
  const km = distanceKm != null ? distanceKm.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;
  return (
    <View style={[s.wrap, s.row]} accessible accessibilityLabel={`${etaMin} ${t('tracking.min')}${km ? ` · ${km} ${t('tracking.km')}` : ''}`}>
      <DigitReel value={etaMin} lineHeight={62} textStyle={{ fontFamily: FONTS.bebas, fontSize: 62, color: theme.text as string, letterSpacing: 1 }} />
      <Text style={[s.unit, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>
        {t('tracking.min')}{km ? ` · ${km} ${t('tracking.km')}` : ''}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  unit: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 1, includeFontPadding: false },
  fallbackTitle: { fontFamily: FONTS.bebas, fontSize: 30, includeFontPadding: false },
  fallbackSub: { fontFamily: FONTS.sans, fontSize: 13, marginTop: 4 },
});
