// components/cockpit/MissionCard.tsx — la mission acceptée, en carte blanche
// au-dessus du dock : on la tape pour reprendre l'intervention. Remplace la
// pastille « mission en cours » : la journée s'efface, la mission prend la place.
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { usePresence } from '@/lib/motion/usePresence';
import { usePressScale } from '@/lib/motion/press';
import { MOTION } from '@/lib/motion/springs';
import { feedback } from '@/lib/feedback/feedback';
import { placeShort } from '@/components/mission/blocks';

export type MissionLite = { id: number | string; status?: string | null; serviceType?: string | null; address?: string | null; clientName?: string | null; netCents?: number | null };

type Props = { visible: boolean; bottom: number; mission: MissionLite | null; onPress: () => void };

function MissionCardBase({ visible, bottom, mission, onPress }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { style: presence } = usePresence(visible && !!mission, { from: 'bottom', preset: MOTION.land });
  const press = usePressScale();
  if (!mission) return null;
  const st = (mission.status || '').toUpperCase();
  const kicker = st === 'ONGOING' ? t('cockpit.mission_ongoing') : st === 'QUOTE_SENT' ? t('cockpit.mission_quote_sent') : st === 'QUOTE_ACCEPTED' ? t('cockpit.mission_quote_accepted') : t('cockpit.mission_accepted');
  return (
    <Animated.View style={[s.wrap, { bottom }, presence]} pointerEvents={visible ? 'box-none' : 'none'}>
      <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={t('provider.resume_mission')}>
        <Animated.View style={[s.card, { backgroundColor: theme.accent }, press.style]}>
          <View style={s.body}>
            <Text style={[s.k, { color: theme.accentText }]} numberOfLines={1} maxFontSizeMultiplier={1}>{`${kicker} · #${mission.id}`.toUpperCase()}</Text>
            <Text style={[s.title, { color: theme.accentText }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
              {[mission.serviceType || t('missions.mission'), placeShort(mission.address ?? null)].filter(Boolean).join(' · ')}
            </Text>
            <Text style={[s.sub, { color: theme.accentText }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
              {[mission.clientName, mission.address].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <View style={[s.go, { backgroundColor: theme.isDark ? 'rgba(10,10,10,0.12)' : 'rgba(255,255,255,0.14)' }]}>
            <Feather name="arrow-right" size={18} color={theme.accentText} />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const MissionCard = memo(MissionCardBase);

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 5 },
  card: { borderRadius: 20, padding: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1 },
  k: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.5, opacity: 0.7 },
  title: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 0.3, marginTop: 4, includeFontPadding: false },
  sub: { fontFamily: FONTS.sans, fontSize: 12, opacity: 0.8, marginTop: 2 },
  go: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
