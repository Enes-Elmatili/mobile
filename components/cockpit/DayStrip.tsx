// components/cockpit/DayStrip.tsx — la journée, lisible en bas, hors ligne
// comme en ligne : rappels (virements, devis), prochaine mission avec son
// heure (ambre à moins de 30 min), puis trois tuiles qui gardent tout ce que
// l'ancien îlot montrait — mois + en attente, note + missions, rang + taux.
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, COLORS, FONTS } from '@/hooks/use-app-theme';
import { CascadeItem } from '@/lib/motion/useCascade';
import { feedback } from '@/lib/feedback/feedback';
import { formatClock, formatEURCents } from '@/lib/format';
import { placeShort } from '@/components/mission/blocks';
import { inLabel, type NextMission, type Reminder } from '@/lib/cockpit/day';

export type DayStats = {
  monthCents: number;
  pendingCents: number;
  avgRating: number;
  totalRatings: number;
  jobsCompleted: number;
  rank: number | null;
  acceptanceRate: number | null;
};

type Props = {
  visible: boolean;
  bottom: number;
  reminders: Reminder[];
  next: NextMission | null;
  stats: DayStats;
  loading: boolean;
  onReminder: (r: Reminder) => void;
  onNext: (m: NextMission) => void;
  onStats: () => void;
};

/** Un montant en euros : entier si rond (« 1 240 € »), sinon deux décimales. */
function euros(cents: number): string {
  return formatEURCents(cents, cents % 100 === 0 ? 0 : 2);
}

function Tile({ k, big, sub, onPress }: { k: string; big: string; sub: string | null; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={() => { feedback.haptic('light'); onPress(); }}
      style={({ pressed }) => [s.tile, { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={[k, big, sub].filter(Boolean).join(', ')}
    >
      <Text style={[s.k, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>{k.toUpperCase()}</Text>
      <Text style={[s.big, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} maxFontSizeMultiplier={1.2}>{big}</Text>
      {sub ? <Text style={[s.sub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{sub}</Text> : null}
    </Pressable>
  );
}

function DayStripBase({ visible, bottom, reminders, next, stats, loading, onReminder, onNext, onStats }: Props) {
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const dash = loading ? '—' : null;
  const decimal = (i18n.language || 'fr').startsWith('en') ? '.' : ',';
  const rating = stats.totalRatings > 0 ? stats.avgRating.toFixed(1).replace('.', decimal) : '—';
  return (
    <View style={[s.strip, { bottom }]} pointerEvents={visible ? 'box-none' : 'none'}>
      {reminders.length > 0 ? (
        <CascadeItem index={0} visible={visible} from="bottom" style={s.chips}>
          {reminders.map((r, i) => (
            <Pressable key={`${r.kind}-${r.requestId ?? i}`} onPress={() => { feedback.haptic('light'); onReminder(r); }} style={({ pressed }) => [s.chip, { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" hitSlop={4}>
              <View style={[s.dot, { backgroundColor: COLORS.amber }]} />
              <Text style={[s.chipText, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                {r.kind === 'payouts' ? t('cockpit.reminder_payouts') : t('cockpit.reminder_quote', { id: r.requestId })}
              </Text>
            </Pressable>
          ))}
        </CascadeItem>
      ) : null}
      {next ? (
        <CascadeItem index={1} visible={visible} from="bottom">
          <Pressable
            onPress={() => { feedback.haptic('light'); onNext(next); }}
            style={({ pressed }) => [s.card, { backgroundColor: theme.cardBg, borderColor: next.soon ? theme.accent : theme.border, opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`${t('cockpit.next_mission')}, ${inLabel(next.inMin, t)}, ${formatClock(new Date(next.startAt))}, ${[next.serviceType, placeShort(next.address), next.clientName].filter(Boolean).join(', ')}`}
          >
            <Text style={[s.time, { color: next.soon ? COLORS.amber : theme.text }]} maxFontSizeMultiplier={1.1}>{formatClock(new Date(next.startAt))}</Text>
            <View style={s.cardBody}>
              <Text style={[s.k, { color: next.soon ? COLORS.amber : theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.1}>{`${t('cockpit.next_mission')} · ${inLabel(next.inMin, t)}`.toUpperCase()}</Text>
              <Text style={[s.cardTitle, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                {[next.serviceType, placeShort(next.address), next.clientName].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={theme.textMuted} />
          </Pressable>
        </CascadeItem>
      ) : null}
      <CascadeItem index={2} visible={visible} from="bottom" style={s.tiles}>
        <Tile k={t('cockpit.month')} big={dash ?? euros(stats.monthCents)} sub={stats.pendingCents > 0 ? `+${formatEURCents(stats.pendingCents, 0)} ${t('provider.pending')}` : null} onPress={onStats} />
        <Tile k={t('cockpit.rating')} big={dash ?? rating} sub={t('cockpit.missions_done', { count: stats.jobsCompleted })} onPress={onStats} />
        <Tile k={t('cockpit.rank')} big={dash ?? (stats.rank != null ? `#${stats.rank}` : '—')} sub={stats.acceptanceRate != null ? t('cockpit.accepted_rate', { rate: stats.acceptanceRate }) : null} onPress={onStats} />
      </CascadeItem>
    </View>
  );
}

export const DayStrip = memo(DayStripBase);

const s = StyleSheet.create({
  strip: { position: 'absolute', left: 16, right: 16, zIndex: 5, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  cardBody: { flex: 1 },
  time: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 1, minWidth: 52, includeFontPadding: false },
  cardTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, marginTop: 3 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1 },
  k: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.2 },
  big: { fontFamily: FONTS.bebas, fontSize: 24, letterSpacing: 0.3, marginTop: 4, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  sub: { fontFamily: FONTS.sans, fontSize: 11.5, marginTop: 2 },
});
