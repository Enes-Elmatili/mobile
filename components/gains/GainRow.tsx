// components/gains/GainRow.tsx — une mission, une ligne : icône de catégorie,
// prestation · commune, date, net à droite et l'état de l'argent en mono.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { formatDay, formatDayShort, formatEURCents } from '@/lib/format';
import type { GainLine } from '@/lib/gains/model';

const ICONS: Record<string, React.ComponentProps<typeof Feather>['name']> = { plomberie: 'droplet', serrurerie: 'key', electricite: 'zap', menage: 'wind', bricolage: 'tool', jardinage: 'sun' };

export function stateLabel(line: GainLine, t: (k: string, o?: any) => string, lang: string): string {
  if (line.state === 'refunded') return t('gains.refunded_short');
  if (line.state === 'paid') return t('gains.paid_short');
  return t('gains.arrive_short', { date: formatDayShort(line.arrivesAt, lang).toUpperCase() });
}

export function GainRow({ line, onPress }: { line: GainLine; onPress: (l: GainLine) => void }) {
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const press = usePressScale(0.98);
  const icon = ICONS[line.tx.mission?.categorySlug ?? ''] ?? (line.net < 0 ? 'corner-up-left' : 'tool');
  const title = line.title ?? (line.net < 0 ? t('gains.other_debit') : t('gains.other_credit'));
  const sub = [formatDay(line.date, i18n.language), line.city].filter(Boolean).join(' · ');
  const state = stateLabel(line, t, i18n.language);
  const amount = `${line.net < 0 ? '−' : '+'}${formatEURCents(Math.abs(line.net), 0)}`;
  return (
    <Pressable onPress={() => { feedback.haptic('light'); onPress(line); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${title}, ${sub}, ${amount}, ${state}`}>
      <Animated.View style={[s.row, { borderBottomColor: theme.borderLight }, press.style]}>
        <View style={[s.ic, { backgroundColor: theme.surface }]}><Feather name={icon} size={16} color={theme.textSub as string} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.title, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{title}</Text>
          <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{sub}</Text>
        </View>
        <View style={s.amt}>
          <Text style={[s.amount, { color: line.net < 0 ? theme.textSub : theme.text }]} maxFontSizeMultiplier={1.2}>{amount}</Text>
          <Text style={[s.state, { color: line.state === 'paid' ? theme.greenText : theme.textMuted }]} maxFontSizeMultiplier={1.2}>{state}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  ic: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontFamily: FONTS.sansMedium, fontSize: 13.5 },
  sub: { fontFamily: FONTS.sans, fontSize: 11.5, marginTop: 2 },
  amt: { alignItems: 'flex-end', flexShrink: 0 },
  amount: { fontFamily: FONTS.bebas, fontSize: 19, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  state: { fontFamily: FONTS.monoMedium, fontSize: 9.5, letterSpacing: 0.5, marginTop: 2 },
});
