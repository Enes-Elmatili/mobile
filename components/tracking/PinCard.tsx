// components/tracking/PinCard.tsx
// Le code d'arrivée : compact pendant le trajet (on le prépare), héros à la
// porte (lisible à bout de bras, à travers l'entrebâillement). Le passage
// compact → héros est un ressort « prend » sur les chiffres.
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useTakeScale } from '@/lib/motion';

type Props = { code: string; mode: 'compact' | 'hero'; name: string };

export function PinCard({ code, mode, name }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const take = useTakeScale(mode === 'hero', { on: 1.06, off: 1 });
  useEffect(() => { /* le mode pilote le ressort via useTakeScale */ }, [mode]);
  const digits = code.split('');
  if (mode === 'hero') {
    return (
      <View style={[s.hero, { backgroundColor: theme.bg }]} accessible accessibilityLabel={`${t('mission_view.pin_label_full')} ${digits.join(' ')}`}>
        <Animated.View style={[s.digitsRow, take.style]}>
          {digits.map((d, i) => <Text key={i} style={[s.heroDigit, { color: theme.text }]} maxFontSizeMultiplier={1.1}>{d}</Text>)}
        </Animated.View>
        <Text style={[s.heroSub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('tracking.at_door_sub')}</Text>
      </View>
    );
  }
  return (
    <View style={[s.compact, { borderColor: theme.border }]} accessible accessibilityLabel={`${t('mission_view.pin_label_full')} ${digits.join(' ')}`}>
      <Feather name="key" size={14} color={theme.textMuted as string} />
      <Text style={[s.compactDigits, { color: theme.text }]} maxFontSizeMultiplier={1.1}>{code}</Text>
      <Text style={[s.compactHint, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('tracking.pin_compact', { name })}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  compact: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  compactDigits: { fontFamily: FONTS.bebas, fontSize: 26, letterSpacing: 6, includeFontPadding: false },
  compactHint: { flex: 1, fontFamily: FONTS.sans, fontSize: 11.5, lineHeight: 15 },
  hero: { marginTop: 14, padding: 18, borderRadius: 20, alignItems: 'center' },
  digitsRow: { flexDirection: 'row', gap: 14 },
  heroDigit: { fontFamily: FONTS.bebas, fontSize: 64, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  heroSub: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 17, textAlign: 'center', marginTop: 8 },
});
