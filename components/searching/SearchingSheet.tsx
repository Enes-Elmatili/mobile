// components/searching/SearchingSheet.tsx — le contenu de la feuille pendant
// la recherche : une ligne mono (vague · temps), un titre qui change avec les
// faits, la demande, la réassurance et Annuler. Rendu dans la feuille unique
// du suivi (missionview), pas dans une feuille à part.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { MOTION } from '@/lib/motion/springs';
import { usePresence } from '@/lib/motion/usePresence';
import { cleanName } from '@/lib/displayName';
import type { MissionBrief } from '@/lib/mission/brief';
import type { Pro } from '@/lib/mission/useSearching';
import { MissionRow } from '@/components/mission/MissionRow';

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const firstName = (name: string | null | undefined) => cleanName(name ?? '').split(/\s+/)[0] || '';

function Headline({ text, sub }: { text: string; sub: string }) {
  const theme = useAppTheme();
  const [shown, setShown] = useState({ text, sub });
  const [visible, setVisible] = useState(true);
  const presence = usePresence(visible, { from: 'bottom', preset: MOTION.pane });
  useEffect(() => {
    if (text === shown.text && sub === shown.sub) return;
    setVisible(false);
    const id = setTimeout(() => { setShown({ text, sub }); setVisible(true); }, 160);
    return () => clearTimeout(id);
  }, [text, sub, shown]);
  return (
    <Animated.View style={presence.style}>
      <Text style={[s.h1, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{shown.text}</Text>
      <Text style={[s.sub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{shown.sub}</Text>
    </Animated.View>
  );
}

type Props = {
  brief: MissionBrief;
  pros: Pro[];
  round: number;
  remaining: number | null;
  nextWaveAt: number | null;
  startedAt: number;
  now: number;
  expiresAt?: string | null;
  cancelling?: boolean;
  isScheduled?: boolean;
  scheduledLabel?: string | null;
  acceptedName?: string | null;
  onCancel: () => void;
};

export function SearchingSheet({ brief, pros, round, remaining, nextWaveAt, startedAt, now, expiresAt, cancelling, isScheduled, scheduledLabel, acceptedName, onCancel }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const awake = pros.filter((p) => p.wave > 0 && !p.declined);
  const declinedCount = pros.filter((p) => p.declined).length;
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const expiresIn = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : null;
  const nextIn = nextWaveAt ? Math.max(0, Math.ceil((nextWaveAt - now) / 1000)) : null;

  let headline: string;
  let sub: string;
  if (acceptedName) {
    headline = t('searching.h_accepted', { name: firstName(acceptedName) });
    sub = t('searching.s_accepted');
  } else if (isScheduled) {
    headline = t('searching.h_scheduled');
    sub = scheduledLabel ? t('searching.s_scheduled', { when: scheduledLabel }) : t('searching.s_scheduled_generic');
  } else if (awake.length === 0 && round === 0) {
    headline = t('searching.h_notifying');
    sub = t('searching.s_first');
  } else if (awake.length === 0 && remaining === 0) {
    headline = t('searching.h_wider');
    sub = t('searching.s_wider');
  } else if (awake.length === 0) {
    headline = t('searching.h_next_wave');
    sub = nextIn != null ? t('searching.s_next_wave', { time: mmss(nextIn) }) : t('searching.s_first');
  } else {
    headline = awake.length === 1 ? t('searching.h_one', { name: firstName(awake[0].name) }) : t('searching.h_many', { n: awake.length });
    sub = nextIn != null && remaining ? t('searching.s_first_next', { time: mmss(nextIn) }) : t('searching.s_first');
  }

  const eyebrow = [
    round > 0 ? t('searching.wave_n', { n: Math.max(1, round) }) : t('searching.searching'),
    mmss(elapsed),
    expiresIn != null && expiresIn < 300 ? t('searching.expires_in', { time: mmss(expiresIn) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <View>
      <Text style={[s.eyebrow, { color: theme.textMuted }]} numberOfLines={1}>{eyebrow.toUpperCase()}</Text>
      <Headline text={headline} sub={sub} />
      {declinedCount > 0 && !acceptedName && !isScheduled ? (
        <Text style={[s.note, { color: theme.textMuted }]}>{t('searching.declined_n', { count: declinedCount })}</Text>
      ) : null}
      <View style={s.request}>
        <MissionRow brief={brief} amountMode="gross" standalone onPress={() => {}} />
      </View>
      <Text style={[s.reassurance, { color: theme.textMuted }]}>{acceptedName ? t('tracking.accepted_reassurance') : t('searching.reassurance')}</Text>
      {!acceptedName ? (
        <Pressable
          style={({ pressed }) => [s.cancel, (pressed || cancelling) && { opacity: 0.55 }]}
          onPress={onCancel}
          disabled={cancelling}
          accessibilityRole="button"
          accessibilityLabel={t('ext.searching_cancel_search')}
          hitSlop={8}
        >
          <Text style={[s.cancelText, { color: cancelling ? theme.textMuted : COLORS.red }]}>
            {cancelling ? t('ext.searching_cancelling') : t('searching.cancel')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  eyebrow:      { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  h1:           { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.3, includeFontPadding: false },
  sub:          { fontFamily: FONTS.sans, fontSize: 13, marginTop: 4 },
  note:         { fontFamily: FONTS.sans, fontSize: 12, marginTop: 6 },
  request:      { marginTop: 14, marginHorizontal: -16 },
  reassurance:  { fontFamily: FONTS.sans, fontSize: 11, textAlign: 'center', marginTop: 12 },
  cancel:       { alignItems: 'center', paddingVertical: 12, marginTop: 2 },
  cancelText:   { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
