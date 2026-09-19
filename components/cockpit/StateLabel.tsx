// components/cockpit/StateLabel.tsx — l'état, écrit en haut de la carte.
// Le disque (barre flottante) porte l'action ; cette étiquette dit où l'on en
// est : « vous êtes invisible » hors ligne, « en ligne · 2 demandes · 12:04 »
// avec un chrono qui tourne, « vous êtes occupé · mission #12 » en ambre,
// rouge sans GPS ou sans réseau. Ce qui bouge est une information, pas un
// symbole. Elle s'efface quand une demande monte.
import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAppTheme, COLORS, FONTS } from '@/hooks/use-app-theme';
import { usePresence } from '@/lib/motion/usePresence';
import type { CockpitStage } from '@/lib/cockpit/stage';
import { clockOf } from '@/lib/cockpit/day';

type Props = {
  stage: CockpitStage;
  /** Demandes reçues et encore ouvertes (les points ambre). */
  count: number;
  /** Depuis quand on est en ligne (ms), pour le chrono. */
  onlineSince: number | null;
  missionId?: number | string | null;
  top: number;
};

function StateLabelBase({ stage, count, onlineSince, missionId, top }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const visible = stage !== 'incoming';
  const { style: presence } = usePresence(visible, { from: 'island' });
  const [clock, setClock] = useState(() => (onlineSince ? clockOf(onlineSince, Date.now()) : ''));

  // Le chrono n'existe qu'en ligne : rien ne boucle hors ligne.
  useEffect(() => {
    if (!onlineSince || stage === 'off' || stage === 'gps' || stage === 'net') { setClock(''); return; }
    setClock(clockOf(onlineSince, Date.now()));
    const iv = setInterval(() => setClock(clockOf(onlineSince, Date.now())), 1000);
    return () => clearInterval(iv);
  }, [onlineSince, stage]);

  const tone = stage === 'busy' ? COLORS.amber : stage === 'gps' || stage === 'net' ? theme.danger : stage === 'off' ? theme.textMuted : COLORS.greenBrand;
  const title = stage === 'busy' ? t('cockpit.busy') : stage === 'gps' ? t('cockpit.gps_title') : stage === 'net' ? t('cockpit.net_title') : stage === 'off' ? t('cockpit.invisible') : t('cockpit.online');
  const sub = stage === 'busy'
    ? [missionId != null ? t('cockpit.mission_n', { id: missionId }) : null, clock].filter(Boolean).join(' · ')
    : stage === 'gps'
      ? t('cockpit.gps_veil')
      : stage === 'net'
        ? t('cockpit.net_veil')
        : stage === 'off'
          ? t('cockpit.go_hint')
          : [count > 0 ? t('cockpit.demand_count', { count }) : t('cockpit.demand_none'), clock].filter(Boolean).join(' · ');

  return (
    <Animated.View style={[s.wrap, { top }, presence]} pointerEvents="none">
      <View style={[s.pill, { backgroundColor: theme.isDark ? 'rgba(10,10,10,0.78)' : 'rgba(255,255,255,0.9)', borderColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
        <View style={[s.dot, { backgroundColor: tone }]} />
        <Text style={[s.title, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2} accessibilityRole="header">{title.toUpperCase()}</Text>
        {sub ? <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{`· ${sub}`}</Text> : null}
      </View>
    </Animated.View>
  );
}

export const StateLabel = memo(StateLabelBase);

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingLeft: 11, paddingRight: 13, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  title: { fontFamily: FONTS.bebas, fontSize: 15, letterSpacing: 1.2, includeFontPadding: false },
  sub: { fontFamily: FONTS.sans, fontSize: 12, fontVariant: ['tabular-nums'], flexShrink: 1 },
});
