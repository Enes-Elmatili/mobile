// components/tracking/RequestRow.tsx
// « Votre demande », repliée en une ligne (vignette, prestation, n photos,
// montant) ; un tap déplie la fiche complète (ligne, photos, accès).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { formatEUR } from '@/lib/format';
import type { MissionBrief } from '@/lib/mission/brief';
import { categoryIcon, serviceName } from '@/components/mission/blocks';
import { photoUri } from '@/components/mission/photos';
import { ClientRequestSummary } from '@/components/mission/ClientRequestSummary';

type Props = { brief: MissionBrief; amount: number | null; amountCaption?: string; inset?: number };

export function RequestRow({ brief, amount, amountCaption, inset = 20 }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const press = usePressScale(0.98);
  const first = brief.photos[0];
  const sub = [serviceName(brief), brief.photos.length ? t('tracking.photos_n', { n: brief.photos.length }) : null].filter(Boolean).join(' · ');
  return (
    <View style={s.wrap}>
      <Pressable onPress={() => { feedback.haptic('light'); setOpen((v) => !v); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t('tracking.your_request')}>
        <Animated.View style={[s.row, { backgroundColor: theme.bg }, press.style]}>
          <View style={[s.thumb, { backgroundColor: theme.surface }]}>
            {first ? <Image source={{ uri: photoUri(first.url) ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : <Feather name={categoryIcon(brief)} size={18} color={theme.textSub as string} />}
            {brief.photos.length > 1 ? <View style={[s.count, { backgroundColor: theme.accent }]}><Text style={[s.countText, { color: theme.accentText }]}>{brief.photos.length}</Text></View> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.title, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{t('tracking.your_request')}</Text>
            <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{sub}</Text>
          </View>
          {amount != null ? (
            <View style={s.amt}>
              <Text style={[s.amount, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{formatEUR(amount, 0)}</Text>
              {amountCaption ? <Text style={[s.amountCap, { color: theme.textMuted }]}>{amountCaption}</Text> : null}
            </View>
          ) : null}
          <Feather name={open ? 'chevron-up' : 'chevron-right'} size={16} color={theme.textMuted as string} />
        </Animated.View>
      </Pressable>
      {open ? <View style={{ marginTop: 6 }}><ClientRequestSummary brief={brief} hideProvider inset={inset} /></View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14 },
  thumb: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'visible', flexShrink: 0 },
  count: { position: 'absolute', right: -4, bottom: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: FONTS.sansMedium, fontSize: 10 },
  title: { fontFamily: FONTS.sansMedium, fontSize: 13.5 },
  sub: { fontFamily: FONTS.sans, fontSize: 11.5, marginTop: 2 },
  amt: { alignItems: 'flex-end' },
  amount: { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  amountCap: { fontFamily: FONTS.sans, fontSize: 10 },
});
