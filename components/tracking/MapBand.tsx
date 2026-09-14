// components/tracking/MapBand.tsx
// Pendant le travail, la carte n'est plus qu'un bandeau : par-dessus, une
// bande « {Prénom} · chez vous · DEPUIS 14:32 » avec l'appel.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import Avatar from '@/components/ui/Avatar';
import { feedback } from '@/lib/feedback/feedback';

type Props = { name: string; avatarUrl?: string | null; sinceLabel: string; onCall?: () => void; top: number };

export function MapBand({ name, avatarUrl, sinceLabel, onCall, top }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={[s.band, { top, backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.shadowOpacity }]}>
      <Avatar name={name} size={30} avatarUrl={avatarUrl} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[s.title, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{t('tracking.at_home', { name })}</Text>
        <Text style={[s.since, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{sinceLabel}</Text>
      </View>
      {onCall ? (
        <Pressable onPress={() => { feedback.haptic('light'); onCall(); }} accessibilityRole="button" accessibilityLabel={t('tracking.call', { name })} hitSlop={8}>
          <Feather name="phone" size={16} color={theme.textMuted as string} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  band: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, shadowColor: '#000', shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  title: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  since: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 0.5, marginTop: 1 },
});
