// components/request/WeekStrip.tsx
// Une semaine entière, lundi → dimanche, sept colonnes égales (planche 3A).
// En-tête « 15 – 21 septembre » et chevrons ; changer de semaine pousse la
// rangée latéralement (StepPager). Jours passés grisés et inertes, aujourd'hui
// porte un point. Sélection : fond accent, haptique selection.
import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { feedback } from '@/lib/feedback/feedback';
import { StepPager, type PagerDirection } from './StepPager';
import type { Week, WeekDay } from '@/lib/scheduling/weeks';
import { PressScale } from '@/components/ui/PressScale';

type Props = {
  weeks: Week[];
  selectedIso: string | null;
  onSelect: (iso: string) => void;
  /** Abréviation du jour (« Lun », ou « Auj. » pour aujourd'hui). */
  dayLabel: (d: WeekDay) => string;
  /** Mois en toutes lettres. */
  monthLabel: (month: number) => string;
  prevLabel: string;
  nextLabel: string;
};

function rangeLabel(w: Week, monthLabel: (m: number) => string): string {
  return w.from.month === w.to.month
    ? `${w.from.date} – ${w.to.date} ${monthLabel(w.from.month)}`
    : `${w.from.date} ${monthLabel(w.from.month)} – ${w.to.date} ${monthLabel(w.to.month)}`;
}

export function WeekStrip({ weeks, selectedIso, onSelect, dayLabel, monthLabel, prevLabel, nextLabel }: Props) {
  const theme = useAppTheme();
  const initial = Math.max(0, weeks.findIndex((w) => w.days.some((d) => d.iso === selectedIso)));
  const [index, setIndex] = useState(initial);
  const dirRef = useRef<PagerDirection>(1);
  const week = weeks[index];
  const canPrev = index > 0;
  const canNext = index < weeks.length - 1;

  const go = (delta: 1 | -1) => {
    feedback.haptic('light');
    dirRef.current = delta;
    setIndex((i) => Math.min(weeks.length - 1, Math.max(0, i + delta)));
  };

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={[s.range, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{rangeLabel(week, monthLabel)}</Text>
        <View style={s.arrows}>
          <PressScale onPress={() => go(-1)} disabled={!canPrev} hitSlop={8} accessibilityRole="button" accessibilityLabel={prevLabel} style={!canPrev && s.arrowOff}>
            <Feather name="chevron-left" size={20} color={theme.textSub as string} />
          </PressScale>
          <PressScale onPress={() => go(1)} disabled={!canNext} hitSlop={8} accessibilityRole="button" accessibilityLabel={nextLabel} style={!canNext && s.arrowOff}>
            <Feather name="chevron-right" size={20} color={theme.textSub as string} />
          </PressScale>
        </View>
      </View>
      <StepPager page={index} direction={dirRef.current} style={s.pager} render={() => (
        <View style={s.days}>
          {week.days.map((d) => {
            const selected = d.iso === selectedIso;
            return (
              <PressScale
                key={d.iso}
                disabled={d.isPast}
                onPress={() => { if (!selected) { feedback.haptic('selection'); onSelect(d.iso); } }}
                accessibilityRole="button"
                accessibilityLabel={`${dayLabel(d)} ${d.date} ${monthLabel(d.month)}`}
                accessibilityState={{ selected, disabled: d.isPast }}
                style={[s.day, selected && { backgroundColor: theme.accent }]}
              >
                <Text style={[s.dayName, { color: selected ? theme.accentText : theme.textMuted }]} maxFontSizeMultiplier={1.2}>{dayLabel(d).toUpperCase()}</Text>
                <Text style={[s.dayNum, { color: selected ? theme.accentText : d.isPast ? theme.textMuted : theme.text }]} maxFontSizeMultiplier={1.2}>{d.date}</Text>
                <View style={[s.todayDot, d.isToday && { backgroundColor: selected ? theme.accentText : theme.text }]} />
              </PressScale>
            );
          })}
        </View>
      )} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap:     { paddingTop: 16 },
  head:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  range:    { fontFamily: FONTS.sansMedium, fontSize: 13 },
  arrows:   { flexDirection: 'row', gap: 18 },
  arrowOff: { opacity: 0.3 },
  pager:    { height: 66 },
  // La sélection respire : 8 pt entre deux jours (4 de retrait de chaque côté), de l'air dedans.
  days:     { flexDirection: 'row', gap: 8 },
  day:      { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 10, borderRadius: 14 },
  dayName:  { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 0.5 },
  dayNum:   { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false, fontVariant: ['tabular-nums'] },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
});
