// components/mission/IncomingMissionCard.tsx
// Le contenu de la mission entrante (planche 2A), dans l'ordre où le
// prestataire lit : quoi (prestation, catégorie, mode, durée, anneau du compte
// à rebours), les photos du client, les faits (quand, où, accès, client, sa
// phrase), le gain, puis le geste : glisser pour accepter, Refuser.
// L'enveloppe (glissé depuis le bas, poignée, fondu sur la carte) reste dans
// components/provider/ProviderDashboard.tsx.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { feedback } from '@/lib/feedback/feedback';
import type { MissionBrief } from '@/lib/mission/brief';
import { CountdownRing, EarnRow, MissionFacts, MissionTitle } from './blocks';
import { PhotoThumbs } from './photos';

type Props = {
  brief: MissionBrief;
  timeLeft: number;
  total: number;
  expired: boolean;
  /** Acceptée : le titre passe au vert, l'anneau s'efface, le curseur garde sa coche, plus de « Refuser ». */
  accepted?: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingMissionCard({ brief, timeLeft, total, expired, accepted = false, onAccept, onDecline }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={s.wrap}>
      <Text style={[s.kicker, { color: accepted ? COLORS.green : expired ? COLORS.red : COLORS.amber }]}>
        {accepted ? t('cockpit.mission_accepted') : expired ? t('provider.last_chance') : t('mission_sheet.new_mission')}
      </Text>
      <MissionTitle brief={brief} right={!expired && !accepted ? <CountdownRing seconds={timeLeft} total={total} /> : null} />
      {brief.photos.length ? <View style={s.photos}><PhotoThumbs photos={brief.photos} /></View> : null}
      <View style={s.facts}><MissionFacts brief={brief} /></View>
      <View style={s.earn}><EarnRow brief={brief} /></View>
      <View style={s.slide}>
        <SlideToConfirm label={t('mission.slide_accept')} onConfirm={onAccept} done={accepted} />
      </View>
      <Pressable onPress={() => { feedback.haptic('light'); onDecline(); }} disabled={accepted} style={[s.refuse, accepted && { opacity: 0 }]} accessibilityRole="button" accessibilityLabel={expired ? t('missions.cancel') : t('provider.decline')} accessibilityElementsHidden={accepted}>
        <Text style={[s.refuseText, { color: expired ? COLORS.red : theme.textMuted }]}>{expired ? t('missions.cancel') : t('mission.refuse')}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap:       { paddingHorizontal: 20, paddingTop: 14 },
  kicker:     { fontFamily: FONTS.bebas, fontSize: 11, letterSpacing: 2.5, opacity: 0.8, marginBottom: 10, includeFontPadding: false },
  photos:     { marginTop: 14 },
  facts:      { marginTop: 14 },
  earn:       { marginTop: 14 },
  slide:      { marginTop: 14 },
  refuse:     { alignItems: 'center', paddingVertical: 12 },
  refuseText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
