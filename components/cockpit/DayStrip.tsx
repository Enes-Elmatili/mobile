// components/cockpit/DayStrip.tsx — la journée, lisible en bas, hors ligne
// comme en ligne : rappels (virements, devis) et prochaine mission avec son
// heure (ambre à moins de 30 min). Pas de chiffres ici : le mois est dans
// Gains, la note et le rang dans le profil — l'accueil ne montre que ce qui
// sert à travailler.
import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, COLORS, FONTS } from '@/hooks/use-app-theme';
import { CascadeItem } from '@/lib/motion/useCascade';
import { feedback } from '@/lib/feedback/feedback';
import { formatClock } from '@/lib/format';
import { placeShort } from '@/components/mission/blocks';
import { inLabel, type NextMission, type Reminder } from '@/lib/cockpit/day';

type Props = {
  visible: boolean;
  bottom: number;
  left: number;
  width: number;
  /** Écran bas : puces plus serrées. */
  dense: boolean;
  reminders: Reminder[];
  next: NextMission | null;
  onReminder: (r: Reminder) => void;
  onNext: (m: NextMission) => void;
};

function DayStripBase({ visible, bottom, left, width, dense, reminders, next, onReminder, onNext }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={[s.strip, { bottom, left, width }]} pointerEvents={visible ? 'box-none' : 'none'}>
      {reminders.length > 0 ? (
        <CascadeItem index={0} visible={visible} from="bottom" style={[s.chips, dense && s.chipsDense]}>
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
    </View>
  );
}

export const DayStrip = memo(DayStripBase);

const s = StyleSheet.create({
  strip: { position: 'absolute', zIndex: 5, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipsDense: { gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  cardBody: { flex: 1 },
  time: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 1, minWidth: 52, includeFontPadding: false },
  cardTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, marginTop: 3 },
  k: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.2 },
});
