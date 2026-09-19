// components/cockpit/Dock.tsx — la barre du bas, qui ne porte que l'état.
// Hors ligne elle ne dit rien (le GO parle) ; en ligne elle écrit « Vous êtes
// en ligne » avec le nombre de demandes et un chrono qui tourne — ce qui bouge
// est une information, pas un symbole. Ambre en mission, rouge sans GPS.
import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
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
  bottom: number;
  height: number;
  /** Zone de contenu : le texte s'y centre, à droite du stop. */
  contentLeft: number;
  contentWidth: number;
};

function DockBase({ stage, count, onlineSince, missionId, bottom, height, contentLeft, contentWidth }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const visible = stage !== 'incoming';
  const { style: presence } = usePresence(visible, { from: 'bottom' });
  const [clock, setClock] = useState(() => (onlineSince ? clockOf(onlineSince, Date.now()) : ''));

  // Le chrono n'existe qu'en ligne : rien ne boucle hors ligne.
  useEffect(() => {
    if (!onlineSince || stage === 'off' || stage === 'gps' || stage === 'net') { setClock(''); return; }
    setClock(clockOf(onlineSince, Date.now()));
    const iv = setInterval(() => setClock(clockOf(onlineSince, Date.now())), 1000);
    return () => clearInterval(iv);
  }, [onlineSince, stage]);

  const talking = stage !== 'off';
  const tone = stage === 'busy' ? COLORS.amber : stage === 'gps' || stage === 'net' ? theme.danger : theme.text;
  const title = stage === 'busy' ? t('cockpit.busy') : stage === 'gps' ? t('cockpit.gps_title') : stage === 'net' ? t('cockpit.net_title') : t('cockpit.online');
  const sub = stage === 'busy'
    ? [missionId != null ? t('cockpit.mission_n', { id: missionId }) : null, clock].filter(Boolean).join(' · ')
    : stage === 'gps'
      ? t('cockpit.gps_sub')
      : stage === 'net'
        ? t('cockpit.net_sub')
        : [count > 0 ? t('cockpit.demand_count', { count }) : t('cockpit.demand_none'), clock].filter(Boolean).join(' · ');

  // Le texte apparaît quand le GO est parti, le fond se teinte en carte.
  const talk = useSharedValue(talking ? 1 : 0);
  useEffect(() => { talk.value = withTiming(talking ? 1 : 0, { duration: 260 }); }, [talking, talk]);
  const textStyle = useAnimatedStyle(() => ({ opacity: talk.value, transform: [{ translateY: (1 - talk.value) * 6 }] }));
  const quietBg = theme.bg as string;
  const talkBg = theme.cardBg as string;
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(talk.value, [0, 1], [quietBg, talkBg]) }));

  return (
    <Animated.View
      style={[s.dock, { bottom, height, borderTopColor: theme.borderLight }, bgStyle, presence]}
      pointerEvents="none"
    >
      <Animated.View style={[s.st, { left: contentLeft + 56, width: contentWidth - 112 }, textStyle]} pointerEvents="none" accessibilityElementsHidden={!talking} importantForAccessibility={talking ? 'yes' : 'no-hide-descendants'}>
        <Text style={[s.title, { color: tone }]} numberOfLines={1} maxFontSizeMultiplier={1.2} accessibilityRole="header" accessibilityLiveRegion="polite">{title.toUpperCase()}</Text>
        <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{sub}</Text>
      </Animated.View>
    </Animated.View>
  );
}

export const Dock = memo(DockBase);

const s = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, zIndex: 6, borderTopWidth: 1 },
  st: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.bebas, fontSize: 21, letterSpacing: 1, includeFontPadding: false },
  sub: { fontFamily: FONTS.sans, fontSize: 12.5, marginTop: 3, fontVariant: ['tabular-nums'] },
});
