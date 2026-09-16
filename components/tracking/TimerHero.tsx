// components/tracking/TimerHero.tsx — le chrono vivant : mm:ss en rouleau de
// chiffres, depuis un horodatage serveur. Jamais « 0 MIN ».
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { DigitReel } from '@/components/ui/DigitReel';

export function TimerHero({ since }: { since: string | number | null }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const iv = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(iv); }, []);
  const start = since != null ? new Date(since).getTime() : now;
  const total = Math.max(0, Math.floor((now - start) / 1000));
  const mm = Math.floor(total / 60), ss = total % 60;
  const style = { fontFamily: FONTS.bebas, fontSize: 72, color: theme.text as string, letterSpacing: 2 };
  return (
    <View style={s.row} accessible accessibilityLabel={`${mm} ${t('tracking.min')} ${ss}`}>
      <DigitReel value={String(mm).padStart(2, '0')} lineHeight={72} textStyle={style} />
      <Text style={[s.colon, { color: theme.textSub }]}>:</Text>
      <DigitReel value={String(ss).padStart(2, '0')} lineHeight={72} textStyle={style} />
      <Text style={[s.unit, { color: theme.textSub }]}>{t('tracking.min')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  colon: { fontFamily: FONTS.bebas, fontSize: 60, includeFontPadding: false, marginHorizontal: 2 },
  unit: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 1, marginLeft: 8, includeFontPadding: false },
});
