// components/agenda/rows.tsx — les pièces de l'agenda (planche « Missions,
// c'est l'agenda ») : la semaine, « maintenant », « à prendre », le fil du
// jour (mission · trajet · creux · libre), le pied du jour, les mois passés.
// Les statuts se lisent dans la matière (estompé = fait, ambre = en cours,
// « DEVIS » = devis à rédiger), jamais dans une pastille de texte.
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS, alpha } from '@/hooks/use-app-theme';
import { usePressScale } from '@/lib/motion/press';
import { feedback } from '@/lib/feedback/feedback';
import { formatEUR } from '@/lib/format';
import { cleanName } from '@/lib/displayName';
import { isQuoteMode, netFor, type MissionBrief } from '@/lib/mission/brief';
import { distanceLabel, placeShort, serviceName } from '@/components/mission/blocks';
import type { AgendaItem, MonthGroup, TimelineRow, Week } from '@/lib/agenda/model';

const clock = (ms: number) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// ─── La semaine ──────────────────────────────────────────────────────────────
function DayCell({ day, selected, label, onPress, width }: { day: Week['days'][number]; selected: boolean; label: string; onPress: () => void; width: number }) {
  const theme = useAppTheme();
  const dots = Math.min(3, day.count);
  return (
    <Pressable onPress={onPress} style={[s.day, { width }, selected && { backgroundColor: theme.accent }]} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${label} ${day.dayOfMonth}${day.count ? `, ${day.count}` : ''}`}>
      <Text style={[s.dayLabel, { color: selected ? alpha(theme.accentText, 0.6) : theme.textMuted }]} maxFontSizeMultiplier={1.2}>{label.toUpperCase()}</Text>
      <Text style={[s.dayNum, { color: selected ? theme.accentText : day.isToday ? theme.text : theme.textSub }]} maxFontSizeMultiplier={1.2}>{day.dayOfMonth}</Text>
      <View style={s.dots}>
        {Array.from({ length: dots }).map((_, i) => <View key={i} style={[s.dot, { backgroundColor: selected ? alpha(theme.accentText, 0.5) : day.quote && i === 0 ? COLORS.amber : theme.textSub }]} />)}
        {day.isToday && !selected && !dots ? <View style={[s.dot, { backgroundColor: COLORS.greenBrand }]} /> : null}
      </View>
    </Pressable>
  );
}

export function AgendaWeek({ weeks, selectedKey, onSelect, width, dayLabel, initialIndex, jump, onWeekChange }: {
  weeks: Week[]; selectedKey: string; onSelect: (key: string) => void; width: number; dayLabel: (dow: number) => string; initialIndex: number;
  /** Demande de défilement vers une semaine (le bouton « Aujourd'hui ») : `n` change à chaque demande. */
  jump?: { index: number; n: number }; onWeekChange?: (index: number) => void;
}) {
  const cell = Math.floor((width - 24) / 7);
  const listRef = useRef<FlatList<Week>>(null);
  useEffect(() => { if (jump && jump.n > 0) listRef.current?.scrollToIndex({ index: jump.index, animated: true }); }, [jump]);
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) onWeekChange?.(first.index);
  });
  const render = useCallback(({ item }: { item: Week }) => (
    <View style={[s.week, { width }]}>
      {item.days.map((d) => <DayCell key={d.key} day={d} width={cell} selected={d.key === selectedKey} label={dayLabel(d.dow)} onPress={() => { feedback.haptic('selection'); onSelect(d.key); }} />)}
    </View>
  ), [width, cell, selectedKey, dayLabel, onSelect]);
  return (
    <FlatList
      ref={listRef}
      data={weeks}
      keyExtractor={(w) => String(w.start)}
      renderItem={render}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={initialIndex}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      onViewableItemsChanged={onViewable.current}
      viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      style={{ flexGrow: 0 }}
    />
  );
}

// ─── Titres de section ───────────────────────────────────────────────────────
export function SectionHead({ title, aside }: { title: string; aside?: string | null }) {
  const theme = useAppTheme();
  return (
    <View style={s.sec}>
      <Text style={[s.secTitle, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{title.toUpperCase()}</Text>
      {aside ? <Text style={[s.secAside, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{aside.toUpperCase()}</Text> : null}
    </View>
  );
}

// ─── Maintenant ──────────────────────────────────────────────────────────────
export function NowRow({ item, sub, onPress }: { item: AgendaItem; sub: string; onPress: () => void }) {
  const press = usePressScale(0.98);
  const title = [serviceName(item.brief), item.brief.client?.name ? cleanName(item.brief.client.name) : null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={title}>
      <Animated.View style={[s.now, press.style]}>
        <Text style={s.nowTime} maxFontSizeMultiplier={1.2}>{clock(item.at)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.nowTitle} numberOfLines={1} maxFontSizeMultiplier={1.2}>{title}</Text>
          <Text style={s.nowSub} numberOfLines={1} maxFontSizeMultiplier={1.2}>{sub}</Text>
        </View>
        <Feather name="arrow-right" size={18} color={COLORS.amber} />
      </Animated.View>
    </Pressable>
  );
}

// ─── À prendre ───────────────────────────────────────────────────────────────
function SwipeAction({ progress, icon, label, color, align }: { progress: SharedValue<number>; icon: React.ComponentProps<typeof Feather>['name']; label: string; color: string; align: 'left' | 'right' }) {
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, progress.value * 1.5), transform: [{ scale: 0.8 + 0.2 * Math.min(1, progress.value) }] }));
  return (
    <View style={[s.action, align === 'left' ? { alignItems: 'flex-start' } : { alignItems: 'flex-end' }]}>
      <Animated.View style={[s.actionPill, { backgroundColor: color }, style]}>
        <Feather name={icon} size={16} color="#0A0A0A" />
        <Text style={s.actionText}>{label}</Text>
      </Animated.View>
    </View>
  );
}

export function TakeRow({ brief, when, onPress, onAccept, onDecline }: { brief: MissionBrief; when: string; onPress: () => void; onAccept?: () => void; onDecline?: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const press = usePressScale(0.98);
  const ref = useRef<SwipeableMethods>(null);
  const net = netFor(brief);
  const quote = isQuoteMode(brief.money.pricingMode ?? brief.service.pricingMode);
  const amount = net != null ? formatEUR(net, 0) : brief.money.calloutFee != null ? formatEUR(brief.money.calloutFee, 0) : null;
  const dist = distanceLabel(brief, t)?.split(' · ')[1] ?? null;
  const sub = [placeShort(brief.place.address), dist, when, quote ? t('mission.quote').toLowerCase() : null].filter(Boolean).join(' · ');
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      leftThreshold={72}
      rightThreshold={72}
      renderLeftActions={onAccept ? (p) => <SwipeAction progress={p} icon="check" label={t('mission.accept')} color={COLORS.greenBrand} align="left" /> : undefined}
      renderRightActions={onDecline ? (p) => <SwipeAction progress={p} icon="x" label={t('mission.refuse')} color={COLORS.amber} align="right" /> : undefined}
      onSwipeableWillOpen={() => feedback.haptic('medium')}
      onSwipeableOpen={(direction) => { ref.current?.close(); if (direction === 'right') onAccept?.(); else onDecline?.(); }}
      containerStyle={s.takeWrap}
    >
      <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={`${serviceName(brief)}, ${amount ?? ''}`}>
        <Animated.View style={[s.take, { backgroundColor: theme.cardBg, borderColor: theme.border }, press.style]}>
          <Text style={[s.takeAmt, { color: theme.greenText }]} maxFontSizeMultiplier={1.2}>{amount ?? '—'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{serviceName(brief)}</Text>
            <Text style={[s.rowSub, { color: theme.textSub }]} numberOfLines={2} maxFontSizeMultiplier={1.2}>{sub}</Text>
          </View>
          <View style={[s.go, { backgroundColor: theme.accent }]}><Feather name="arrow-right" size={15} color={theme.accentText as string} /></View>
        </Animated.View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

// ─── Le fil du jour ──────────────────────────────────────────────────────────
function MissionLine({ row, onPress }: { row: Extract<TimelineRow, { kind: 'mission' }>; onPress: () => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const press = usePressScale(0.98);
  const { item, done, quote, net, isCurrent } = row;
  const client = item.brief.client?.name ? cleanName(item.brief.client.name) : null;
  const sub = [client, placeShort(item.brief.place.address), quote ? t('agenda.quote_todo') : item.brief.service.durationMinutes ? t('mission.minutes', { n: item.brief.service.durationMinutes }) : null].filter(Boolean).join(' · ');
  return (
    <View style={s.line}>
      <Text style={[s.hour, { color: done ? theme.textMuted : theme.textSub }]} maxFontSizeMultiplier={1.2}>{clock(item.at)}</Text>
      <Pressable onPress={() => { feedback.haptic('light'); onPress(); }} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`${clock(item.at)} ${serviceName(item.brief)}`}>
        <Animated.View style={[s.mission, { backgroundColor: theme.cardBg, borderColor: isCurrent ? alpha(COLORS.amber, 0.35) : theme.border, opacity: done ? 0.55 : 1 }, isCurrent && { backgroundColor: alpha(COLORS.amber, 0.10) }, press.style]}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[s.rowTitle, { color: theme.text }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{serviceName(item.brief)}</Text>
            <Text style={[s.rowSub, { color: theme.textSub }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{sub}</Text>
          </View>
          {quote ? (
            <Text style={[s.net, { color: COLORS.amber }]} maxFontSizeMultiplier={1.2}>{t('mission.quote').toUpperCase()}</Text>
          ) : net != null ? (
            <Text style={[s.net, { color: done ? theme.greenText : theme.text }]} maxFontSizeMultiplier={1.2}>{done ? `+${formatEUR(net, 0)}` : formatEUR(net, 0)}</Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </View>
  );
}

export const Timeline = memo(function Timeline({ rows, onPressMission }: { rows: TimelineRow[]; onPressMission: (item: AgendaItem, isCurrent: boolean) => void }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={s.tl}>
      {rows.map((row, i) => {
        if (row.kind === 'mission') return <MissionLine key={row.item.id} row={row} onPress={() => onPressMission(row.item, row.isCurrent)} />;
        if (row.kind === 'trip') return (
          <View key={`trip-${i}`} style={s.between}><View style={[s.rule, { backgroundColor: theme.border }]} /><Feather name="arrow-right" size={12} color={theme.textSub as string} /><Text style={[s.betweenText, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{t('agenda.trip', { n: row.minutes })}</Text></View>
        );
        if (row.kind === 'gap') return (
          <View key={`gap-${i}`} style={s.between}><View style={[s.rule, { backgroundColor: theme.border }]} /><Text style={[s.betweenText, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{t('agenda.free_until', { time: clock(row.untilMs) }).toUpperCase()}</Text></View>
        );
        return <Text key="free" style={[s.free, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{t('agenda.free_rest')}</Text>;
      })}
    </View>
  );
});

export function DayFoot({ label, net }: { label: string; net: number }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={[s.foot, { borderTopColor: theme.borderLight }]}>
      <Text style={[s.footLabel, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{label}</Text>
      <Text style={[s.footAmt, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{formatEUR(net, 0)} <Text style={[s.footUnit, { color: theme.textSub }]}>{t('agenda.net').toUpperCase()}</Text></Text>
    </View>
  );
}

export function EmptyDay({ title, sub }: { title: string; sub: string }) {
  const theme = useAppTheme();
  return (
    <View style={s.empty}>
      <Feather name="calendar" size={28} color={theme.textMuted as string} />
      <Text style={[s.emptyTitle, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{title.toUpperCase()}</Text>
      <Text style={[s.emptySub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{sub}</Text>
    </View>
  );
}

// ─── Passées ─────────────────────────────────────────────────────────────────
export function PastMonth({ group, label, open, onToggle, onPress, dayLabel }: { group: MonthGroup; label: string; open: boolean; onToggle: () => void; onPress: (item: AgendaItem) => void; dayLabel: (ms: number) => string }) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View>
      <Pressable onPress={() => { feedback.haptic('selection'); onToggle(); }} style={[s.month, { borderTopColor: theme.borderLight }]} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${label}, ${t('agenda.n_missions', { count: group.count })}, ${formatEUR(group.net, 0)}`}>
        <Text style={[s.monthName, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{label.toUpperCase()}</Text>
        <Text style={[s.monthCount, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{t('agenda.n_missions', { count: group.count })}</Text>
        <Text style={[s.monthAmt, { color: theme.greenText }]} maxFontSizeMultiplier={1.2}>{formatEUR(group.net, 0)}</Text>
        <Feather name={open ? 'chevron-down' : 'chevron-right'} size={14} color={theme.textMuted as string} />
      </Pressable>
      {open ? group.items.map((it) => {
        const cancelled = it.status !== 'DONE';
        const net = netFor(it.brief);
        return (
          <Pressable key={it.id} onPress={() => { feedback.haptic('light'); onPress(it); }} style={s.past} accessibilityRole="button" accessibilityLabel={`${dayLabel(it.at)} ${serviceName(it.brief)}`}>
            <Text style={[s.pastDay, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{dayLabel(it.at).toUpperCase()}</Text>
            <Text style={{ flex: 1 }} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              <Text style={[s.pastTitle, { color: theme.text }]}>{serviceName(it.brief)}</Text>
              <Text style={[s.rowSub, { color: theme.textSub }]}>{[placeShort(it.brief.place.address), cancelled ? t('agenda.cancelled') : null].filter(Boolean).map((x) => ` · ${x}`).join('')}</Text>
            </Text>
            {net != null ? <Text style={[s.pastAmt, cancelled ? { color: theme.textMuted, textDecorationLine: 'line-through' } : { color: theme.greenText }]} maxFontSizeMultiplier={1.2}>{cancelled ? formatEUR(net, 0) : `+${formatEUR(net, 0)}`}</Text> : null}
          </Pressable>
        );
      }) : null}
    </View>
  );
}

/** Le mois courant ouvert par défaut ; l'ouverture des autres se souvient. */
export function useOpenMonths(currentKey: string) {
  const [open, setOpen] = useState<Record<string, boolean>>({ [currentKey]: true });
  const toggle = useCallback((k: string) => setOpen((o) => ({ ...o, [k]: !(o[k] ?? k === currentKey) })), [currentKey]);
  const isOpen = useCallback((k: string) => open[k] ?? k === currentKey, [open, currentKey]);
  return { isOpen, toggle };
}

const s = StyleSheet.create({
  week: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12 },
  day: { alignItems: 'center', gap: 5, paddingVertical: 8, borderRadius: 14 },
  dayLabel: { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 0.5 },
  dayNum: { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  sec: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18 },
  secTitle: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2 },
  secAside: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1 },
  now: { marginHorizontal: 20, marginTop: 10, padding: 12, paddingHorizontal: 14, borderRadius: 16, backgroundColor: alpha(COLORS.amber, 0.10), borderWidth: 1, borderColor: alpha(COLORS.amber, 0.25), flexDirection: 'row', alignItems: 'center', gap: 12 },
  nowTime: { fontFamily: FONTS.bebas, fontSize: 20, color: COLORS.amber, minWidth: 46, includeFontPadding: false },
  nowTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, color: '#F4F4F2' },
  nowSub: { fontFamily: FONTS.sans, fontSize: 12, color: 'rgba(244,244,242,0.7)', marginTop: 2 },
  takeWrap: { marginHorizontal: 20, marginTop: 8 },
  take: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  takeAmt: { fontFamily: FONTS.bebas, fontSize: 22, minWidth: 58, includeFontPadding: false },
  go: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  action: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999 },
  actionText: { fontFamily: FONTS.sansMedium, fontSize: 12.5, color: '#0A0A0A' },
  rowTitle: { fontFamily: FONTS.sansMedium, fontSize: 14, lineHeight: 18 },
  rowSub: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 16, marginTop: 1 },
  tl: { marginHorizontal: 20, marginTop: 10 },
  line: { flexDirection: 'row', gap: 0, alignItems: 'flex-start', marginBottom: 8 },
  hour: { width: 44, paddingTop: 14, fontFamily: FONTS.bebas, fontSize: 15, letterSpacing: 0.5, includeFontPadding: false },
  mission: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1 },
  net: { fontFamily: FONTS.bebas, fontSize: 20, includeFontPadding: false },
  between: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 44, paddingLeft: 2, paddingBottom: 12 },
  rule: { width: 1, height: 22, marginRight: 6 },
  betweenText: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1 },
  free: { marginLeft: 46, fontFamily: FONTS.sans, fontSize: 12, paddingTop: 4, paddingBottom: 6 },
  foot: { marginHorizontal: 20, marginTop: 6, paddingTop: 12, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  footLabel: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
  footAmt: { fontFamily: FONTS.bebas, fontSize: 22, includeFontPadding: false },
  footUnit: { fontFamily: FONTS.monoMedium, fontSize: 11, letterSpacing: 1 },
  empty: { alignItems: 'center', marginHorizontal: 28, marginTop: 28 },
  emptyTitle: { fontFamily: FONTS.bebas, fontSize: 22, letterSpacing: 0.5, marginTop: 12, includeFontPadding: false },
  emptySub: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  month: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, marginHorizontal: 20 },
  monthName: { fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 0.5, includeFontPadding: false },
  monthCount: { fontFamily: FONTS.sans, fontSize: 12, flex: 1 },
  monthAmt: { fontFamily: FONTS.bebas, fontSize: 18, includeFontPadding: false },
  past: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingLeft: 32, paddingRight: 20 },
  pastDay: { fontFamily: FONTS.monoMedium, fontSize: 11, minWidth: 44 },
  pastTitle: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  pastAmt: { fontFamily: FONTS.bebas, fontSize: 16, includeFontPadding: false },
});
