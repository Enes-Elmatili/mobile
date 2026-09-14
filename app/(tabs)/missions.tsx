// app/(tabs)/missions.tsx — Provider Mission Hub
// --- Design FIXED : Dark mode support, FONTS/COLORS from design system ---

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
  Linking, Platform,
  TextInput, ScrollView, Modal, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { api } from '@/lib/api';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { devLog, devWarn, devError } from '@/lib/logger';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { MOTION } from '@/lib/motion/springs';
import { SHEET_SPRING } from '@/lib/motion/sheet';
import { BrandRefreshHeader, useBrandRefresh } from '@/components/ui/BrandRefresh';
import { briefOf, netFor, type MissionBrief } from '@/lib/mission/brief';
import { MissionRow } from '@/components/mission/MissionRow';
import { AccessBlock, ClientBlock, EarnRow, MissionTitle } from '@/components/mission/blocks';
import { PhotoGallery } from '@/components/mission/photos';
import { SplitPane, useSplitPane } from '@/lib/layout';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import { useTabBarPadding } from './_layout';
import { useSocket } from '@/lib/SocketContext';
import { useCall } from '@/lib/webrtc/CallContext';
import { feedback } from '@/lib/feedback/feedback';
import { formatEUR as formatEuros } from '@/lib/format';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

const LOCALE_MAP: Record<string, string> = { fr: 'fr-FR', nl: 'nl-BE', en: 'en-GB' };
const getLocale = () => LOCALE_MAP[i18n.language] || 'fr-FR';



// --- Grayscale map style (source unique) ---
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK } from '@/constants/mapStyles';
import { useLayoutClass } from '@/lib/layout';

// ============================================================================
// TYPES
// ============================================================================

type MissionStatus =
  | 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE'
  | 'CANCELLED' | 'PENDING_PAYMENT' | 'EXPIRED'
  | 'QUOTE_PENDING' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED';

type Mission = {
  id: string;
  title: string;
  serviceType?: string;
  description: string;
  price: number;
  status: MissionStatus;
  location?: { address?: string; lat?: number; lng?: number };
  address?: string;
  client?: { id?: string; name: string; phone?: string };
  createdAt?: string;
  scheduledAt?: string;
  lat?: number;
  lng?: number;
  /** Fiche mission (services/missionBrief) — celle du serveur, sinon le repli. */
  brief: MissionBrief;
};

type Tab = 'opportunities' | 'upcoming' | 'history';

// --- Opportunity types ---
interface Opportunity {
  id: number;
  serviceType: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  price: number | null;
  preferredTimeStart: string;
  urgent?: boolean;
  // Infos d'accès (déjà renvoyées par l'API — champs scalaires de Request)
  accessFloor?: number | null;
  accessHasElevator?: boolean | null;
  accessBuildingType?: string | null; // "apartment" | "house" | "office"
  accessNotes?: string | null;
  category: { id: number; name: string; icon: string | null };
  subcategory: { id: number; name: string } | null;
  client: { name: string; avatarUrl?: string | null; city?: string | null };
  brief: MissionBrief;
}

function formatScheduledDate(iso: string, tr?: (k: string, opts?: any) => string): { day: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const locale = getLocale();

  const day = d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  const T = tr || ((k: string) => k);
  let relative = '';
  if (diffDays === 0) relative = T('stepper.today');
  else if (diffDays === 1) relative = T('missions.tomorrow');
  else if (diffDays <= 7) relative = T('missions.in_days', { n: diffDays });
  else relative = T('missions.in_days', { n: diffDays });

  return { day, time, relative };
}

// ============================================================================
// UTILS
// ============================================================================


const formatTime = (d?: string) => {
  if (!d) return null;
  return new Date(d).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
};

const formatMonthKey = (d?: string) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' });
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth() &&
  a.getDate()     === b.getDate();

const STATUS_CFG: Record<MissionStatus, { labelKey: string; icon: string; active?: boolean; done?: boolean }> = {
  PUBLISHED:       { labelKey: 'ext.missions_status_published',     icon: 'radio',                    active: true },
  ACCEPTED:        { labelKey: 'ext.missions_status_accepted',      icon: 'check-circle',             active: true },
  ONGOING:         { labelKey: 'ext.missions_status_ongoing',       icon: 'zap',                      active: true },
  DONE:            { labelKey: 'ext.missions_status_done',          icon: 'check-circle',             done: true },
  CANCELLED:       { labelKey: 'ext.missions_status_cancelled',     icon: 'x-circle' },
  PENDING_PAYMENT: { labelKey: 'ext.missions_status_payment',       icon: 'credit-card' },
  EXPIRED:         { labelKey: 'ext.missions_status_expired',       icon: 'clock' },
  QUOTE_PENDING:   { labelKey: 'ext.missions_status_quote_pending', icon: 'file-text',                active: true },
  QUOTE_SENT:      { labelKey: 'ext.missions_status_quote_sent',    icon: 'check-circle' },
  QUOTE_ACCEPTED:  { labelKey: 'ext.missions_status_quote_accepted',icon: 'check-circle',             active: true },
};

const UPCOMING_STATUSES: MissionStatus[] = ['PUBLISHED', 'ACCEPTED', 'ONGOING', 'PENDING_PAYMENT', 'QUOTE_PENDING', 'QUOTE_SENT'];
const HISTORY_STATUSES:  MissionStatus[] = ['DONE', 'CANCELLED', 'EXPIRED'];

// ============================================================================
// CONFIRM MODAL
// ============================================================================

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({
  visible, title, message,
  confirmLabel, cancelLabel,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  const { t: trI18n } = useTranslation();
  const finalConfirm = confirmLabel ?? trI18n('common.confirm');
  const finalCancel = cancelLabel ?? trI18n('common.cancel');
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  // Feuille de confirmation : monte sur le ressort des sheets, redescend en 180 ms.
  const slideY = useSharedValue(320);
  const backdrop = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: 200 });
      slideY.value = withSpring(0, SHEET_SPRING);
    } else {
      backdrop.value = withTiming(0, { duration: 160 });
      slideY.value = withTiming(320, { duration: 180 });
    }
  }, [visible, backdrop, slideY]);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }));

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCancel} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={cm.overlay} onPress={onCancel}>
        <Reanimated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)' }, backdropStyle]} />
      </Pressable>
      <Reanimated.View style={[cm.sheet, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity > 0.1 ? t.shadowOpacity : 0.14, paddingBottom: Math.max(insets.bottom + 12, Platform.OS === 'ios' ? 40 : 28) }, sheetStyle]}>
        <View style={[cm.handle, { backgroundColor: t.border }]} />
        <Text style={[cm.title, { color: t.text }]}>{title}</Text>
        {message ? <Text style={[cm.message, { color: t.textSub }]}>{message}</Text> : null}
        <View style={cm.actions}>
          <TouchableOpacity style={[cm.cancelBtn, { borderColor: t.border }]} onPress={onCancel} activeOpacity={0.75}>
            <Text style={[cm.cancelLabel, { color: t.textSub }]}>{finalCancel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: t.accent }]} onPress={onConfirm} activeOpacity={0.75}>
            <Text style={[cm.confirmLabel, { color: t.accentText }]}>{finalConfirm}</Text>
          </TouchableOpacity>
        </View>
      </Reanimated.View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 24, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
    }),
  },
  handle:       { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:        { fontSize: 20, fontFamily: FONTS.sansMedium, textAlign: 'center', letterSpacing: -0.3, marginBottom: 10 },
  message:      { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  actions:      { flexDirection: 'row', gap: 10 },
  cancelBtn:    { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, alignItems: 'center' },
  cancelLabel:  { fontSize: 15, fontFamily: FONTS.sansMedium },
  confirmBtn:   { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  confirmLabel: { fontSize: 15, fontFamily: FONTS.sansMedium },
});

// ============================================================================
// DAY PICKER
// ============================================================================

function buildDays(count = 10, tr?: (k: string) => string) {
  const T = tr || ((k: string) => k);
  const DAY_NAMES  = [
    T('stepper.day_sun'), T('stepper.day_mon'), T('stepper.day_tue'),
    T('stepper.day_wed'), T('stepper.day_thu'), T('stepper.day_fri'), T('stepper.day_sat'),
  ];
  const result: { iso: string; dayName: string; dayNum: string; isToday: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    result.push({
      iso:     d.toISOString().split('T')[0],
      dayName: i === 0 ? T('stepper.today') : DAY_NAMES[d.getDay()],
      dayNum:  String(d.getDate()),
      isToday: i === 0,
    });
  }
  return result;
}

function DayPicker({ selected, onSelect }: { selected: string | null; onSelect: (iso: string | null) => void }) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const DAYS = useMemo(() => buildDays(10, tr), [tr]);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={dp.container}
      style={[dp.scroll, { backgroundColor: t.bg, borderBottomColor: t.border }]}
    >
      {/* "Tous" */}
      <TouchableOpacity
        style={[dp.chip, { backgroundColor: t.surface }, selected === null && [dp.chipSelected, { backgroundColor: t.accent }]]}
        onPress={() => onSelect(null)}
        activeOpacity={0.75}
      >
        <Text style={[dp.chipLabel, { color: t.textSub }, selected === null && [dp.chipLabelSelected, { color: t.accentText }]]}>{tr('ext.missions_all')}</Text>
      </TouchableOpacity>

      {DAYS.map(day => {
        const active = selected === day.iso;
        return (
          <TouchableOpacity
            key={day.iso}
            style={[dp.day, { backgroundColor: t.surface }, active && [dp.daySelected, { backgroundColor: t.accent }]]}
            onPress={() => onSelect(active ? null : day.iso)}
            activeOpacity={0.75}
          >
            <Text style={[dp.dayName, { color: t.textMuted }, active && { color: t.isDark ? 'rgba(8,8,8,0.65)' : 'rgba(255,255,255,0.65)' }]}>{day.dayName}</Text>
            <Text style={[dp.dayNum, { color: t.text }, active && { color: t.accentText }]}>{day.dayNum}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const dp = StyleSheet.create({
  scroll:    { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  container: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSelected:      { borderColor: 'transparent' },
  chipLabel:         { fontSize: 13, fontFamily: FONTS.sansMedium },
  chipLabelSelected: { },
  day: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, minWidth: 52,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  daySelected:     { borderColor: 'transparent' },
  dayName:         { fontSize: 10, fontFamily: FONTS.sansMedium, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  dayNum:          { fontSize: 18, fontFamily: FONTS.bebas, includeFontPadding: false },
});

// ============================================================================
// EARNINGS BANNER
// ============================================================================

function EarningsBanner({ missions }: { missions: Mission[] }) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const today   = new Date();
  const todayMs = missions.filter(m => {
    const d = m.scheduledAt || m.createdAt;
    return d && isSameDay(new Date(d), today) && UPCOMING_STATUSES.includes(m.status);
  });
  const doneTodayEarnings = missions
    .filter(m => {
      const d = m.scheduledAt || m.createdAt;
      return m.status === 'DONE' && d && isSameDay(new Date(d), today);
    })
    .reduce((acc, m) => acc + (netFor(m.brief) ?? 0), 0);

  if (todayMs.length === 0 && doneTodayEarnings === 0) return null;

  return (
    <View style={[eb.wrap, { backgroundColor: t.surface }]}>
      <View style={eb.left}>
        <Feather name="zap" size={14} color={t.textSub} />
        <Text style={[eb.text, { color: t.textSub }]}>
          {todayMs.length > 0
            ? `${todayMs.length} ${tr('missions.today_count')}`
            : tr('missions.day_complete')}
        </Text>
      </View>
      {doneTodayEarnings > 0 && (
        <Text style={[eb.earnings, { color: t.text }]}>+{formatEuros(doneTodayEarnings)}</Text>
      )}
    </View>
  );
}

const eb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 4, marginBottom: 2,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  left:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text:     { fontSize: 13, fontFamily: FONTS.sansMedium },
  earnings: { fontSize: 14, fontFamily: FONTS.monoMedium },
});

// ============================================================================
// FILTER BAR (historique)
// ============================================================================

function FilterBar({ options, selected, onSelect }: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  const t = useAppTheme();
  return (
    <FlatList
      horizontal
      data={options}
      keyExtractor={item => item.key}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 10 }}
      renderItem={({ item }) => {
        const active = item.key === selected;
        return (
          <TouchableOpacity
            style={[fb.chip, { backgroundColor: t.surface }, active && { backgroundColor: t.accent }]}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <Text numberOfLines={1} style={[fb.chipText, { color: t.textSub }, active && { color: t.accentText }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const fb = StyleSheet.create({
  chip: {
    paddingHorizontal: 16, height: 32, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  chipText:      { fontSize: 13, fontFamily: FONTS.sansMedium },
});

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ tab, onGoOnline, dayEarnings }: { tab: Tab; onGoOnline: () => void; dayEarnings?: number }) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  if (tab === 'history') {
    return (
      <View style={es.wrap}>
        <Feather name="clock" size={40} color={t.textMuted} />
        <Text style={[es.title, { color: t.text }]}>{tr('missions.no_history')}</Text>
        <Text style={[es.sub, { color: t.textMuted }]}>{tr('missions.history_appear_here')}</Text>
      </View>
    );
  }

  if (dayEarnings && dayEarnings > 0) {
    return (
      <View style={es.wrap}>
        <View style={[es.checkCircle, { backgroundColor: t.accent }]}>
          <Feather name="check" size={32} color={t.accentText} />
        </View>
        <Text style={[es.heroAmount, { color: t.text }]}>+{formatEuros(dayEarnings)}</Text>
        <Text style={[es.title, { color: t.text }]}>{tr('missions.day_complete')}</Text>
        <Text style={[es.sub, { color: t.textMuted }]}>{tr('missions.day_earnings_sub')}</Text>
      </View>
    );
  }

  return (
    <View style={es.wrap}>
      <View style={[es.iconWrap, { backgroundColor: t.surface }]}>
        <Feather name="navigation" size={44} color={t.textMuted} />
      </View>
      <Text style={[es.title, { color: t.text }]}>{tr('missions.no_upcoming')}</Text>
      <Text style={[es.sub, { color: t.textMuted }]}>{tr('missions.go_online_sub')}</Text>
      <TouchableOpacity style={[es.cta, { backgroundColor: t.accent }]} onPress={onGoOnline} activeOpacity={0.85}>
        <View style={[es.ctaDot, { backgroundColor: t.accentText }]} />
        <Text style={[es.ctaText, { color: t.accentText }]}>{tr('missions.go_online_cta')}</Text>
        <Feather name="arrow-right" size={16} color={t.accentText} />
      </TouchableOpacity>
    </View>
  );
}

const es = StyleSheet.create({
  wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 80, gap: 12 },
  iconWrap:{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  heroAmount: { fontSize: 36, fontFamily: FONTS.bebas, includeFontPadding: false, letterSpacing: -1.5 },
  title:   { fontSize: 17, fontFamily: FONTS.sansMedium, textAlign: 'center' },
  sub:     { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 20 },
  cta:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, marginTop: 8 },
  ctaDot:  { width: 8, height: 8, borderRadius: 4 },
  ctaText: { fontSize: 15, fontFamily: FONTS.sansMedium },
});

// ============================================================================
// TAB BAR
// ============================================================================

function TabBar({ tab, onChange, upcomingCount, opportunityCount }: {
  tab: Tab; onChange: (t: Tab) => void; upcomingCount: number; opportunityCount: number;
}) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const TAB_INDEX: Record<Tab, number> = { opportunities: 0, upcoming: 1, history: 2 };
  const TAB_LABELS: Record<Tab, string> = { opportunities: tr('missions.tab_opportunities'), upcoming: tr('missions.tab_upcoming'), history: tr('missions.tab_history') };

  // L'indicateur glisse sous l'onglet actif (MOTION.tab), depuis sa position courante.
  const indicator = useSharedValue(TAB_INDEX[tab]);
  useEffect(() => {
    indicator.value = withSpring(TAB_INDEX[tab], MOTION.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TAB_INDEX est constant
  }, [tab, indicator]);
  const indicatorStyle = useAnimatedStyle(() => ({ left: `${indicator.value * 33.33}%` }));

  return (
    <View style={[tb.wrap, { backgroundColor: t.surface }]}>
      <Reanimated.View style={[tb.indicator, tb.indicator3, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity }, indicatorStyle]} />
      {(['opportunities', 'upcoming', 'history'] as Tab[]).map(tb2 => (
        <TouchableOpacity key={tb2} style={tb.tab} onPress={() => onChange(tb2)} activeOpacity={0.75}>
          <Text style={[tb.label, { color: t.textMuted }, tab === tb2 && { color: t.text, fontFamily: FONTS.sansMedium }]}>
            {TAB_LABELS[tb2]}
          </Text>
          {tb2 === 'upcoming' && upcomingCount > 0 && (
            <View style={[tb.badge, { backgroundColor: t.accent }]}>
              <Text style={[tb.badgeText, { color: t.accentText }]}>{upcomingCount}</Text>
            </View>
          )}
          {tb2 === 'opportunities' && opportunityCount > 0 && (
            <View style={[tb.badge, { backgroundColor: t.accent }]}>
              <Text style={[tb.badgeText, { color: t.accentText }]}>{opportunityCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tb = StyleSheet.create({
  wrap:      { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 14, padding: 4, position: 'relative' },
  indicator: { position: 'absolute', top: 4, bottom: 4, width: '50%', borderRadius: 11,
    ...Platform.select({ ios: { shadowColor: '#000', shadowRadius: 6 }, android: { elevation: 2 } }) },
  indicator3: { width: '33.33%' },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 4 },
  label:     { fontSize: 13, fontFamily: FONTS.sans },
  badge:     { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  badgeText: { fontSize: 10, fontFamily: FONTS.monoMedium },
});

// ============================================================================
// MISSION DETAIL -- Bottom Sheet
// ============================================================================

function MissionDetail({ mission, onNavigate, onComplete, onViewFull, inPane = false }: {
  inPane?: boolean;
  mission: Mission; onNavigate: () => void; onComplete: () => void; onViewFull: () => void;
}) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const router = useRouter();
  const { initiateCall } = useCall();
  const tabBarPadding = useTabBarPadding();
  const cfg         = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = !!(cfg.active) && !!(mission.lat || mission.location?.lat);
  const address     = mission.location?.address || mission.address || '';
  const lat         = mission.lat || mission.location?.lat;
  const lng         = mission.lng || mission.location?.lng;
  const hasCoords   = !!(lat && lng);
  const createdAt   = mission.createdAt  ? new Date(mission.createdAt)  : null;
  const scheduledAt = mission.scheduledAt ? new Date(mission.scheduledAt) : null;

  const fmtT = (d: Date | null) => d ? d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtD = (d: Date | null) => d ? d.toLocaleDateString(getLocale(), { day: 'numeric', month: 'long' }) : '—';

  const badgeBg    = cfg.done ? t.surface : cfg.active ? t.accent : t.surface;
  const badgeColor = cfg.done ? t.textSub : cfg.active ? t.accentText : t.textMuted;

  // Dans un volet (SplitPane), pas de contexte gorhom : ScrollView natif.
  const Scroller = inPane ? ScrollView : BottomSheetScrollView;
  return (
    <Scroller contentContainerStyle={[sd.scroll, { paddingBottom: tabBarPadding }]} showsVerticalScrollIndicator={false}>
      {/* -- Mini-carte -- */}
      {hasCoords ? (
        <View style={sd.mapContainer}>
          <MapView
            provider={PROVIDER_DEFAULT}
            customMapStyle={t.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
            style={sd.map}
            initialRegion={{ latitude: lat!, longitude: lng!, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
            showsPointsOfInterest={false} showsBuildings={false}
          >
            <Marker coordinate={{ latitude: lat!, longitude: lng! }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[sd.markerOuter, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,26,0.12)' }]}><View style={[sd.markerInner, { backgroundColor: t.accent, borderColor: t.cardBg }]} /></View>
            </Marker>
          </MapView>
          <View style={sd.mapOverlay}>
            <View style={[sd.mapAddrBadge, { backgroundColor: t.isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.94)' }]}>
              <Feather name="map-pin" size={11} color={t.textSub} />
              <Text style={[sd.mapAddrText, { color: t.text }]} numberOfLines={1}>{address}</Text>
            </View>
          </View>
          {/* Badge statut flottant */}
          <View style={[sd.mapStatusPill, { backgroundColor: badgeBg }]}>
            <Feather name={cfg.icon as any} size={10} color={badgeColor} />
            <Text style={[sd.mapStatusText, { color: badgeColor }]}>{tr(cfg.labelKey)}</Text>
          </View>
        </View>
      ) : (
        <View style={[sd.mapFallback, { backgroundColor: t.surface }]}>
          <Feather name="map" size={24} color={t.textMuted} />
          <Text style={[sd.mapFallbackText, { color: t.textMuted }]}>{address || tr('ext.missions_no_address')}</Text>
        </View>
      )}

      <View style={sd.body}>
        {/* Fiche mission (planche 4A) : quoi, photos, accès, client, gain */}
        <MissionTitle brief={mission.brief} big />
        <View style={sd.blocks}>
          <PhotoGallery photos={mission.brief.photos} title={tr('mission.client_photos')} />
          <AccessBlock brief={mission.brief} />
          <ClientBlock
            brief={mission.brief}
            onMessage={mission.client?.id ? () => router.push({ pathname: '/messages/[userId]', params: { userId: mission.client!.id!, name: mission.client!.name, requestId: String(mission.id) } }) : undefined}
            onCall={mission.client?.id ? () => initiateCall({ targetUserId: mission.client!.id!, targetName: mission.client!.name, requestId: String(mission.id) }) : undefined}
            phone={mission.client?.phone ?? null}
          />
          <View style={sd.earnWrap}><EarnRow brief={mission.brief} /></View>
        </View>

        {/* Divider */}
        <View style={[sd.sep, { backgroundColor: t.border }]} />

        {/* Chronologie */}
        {(createdAt || scheduledAt) && (
          <>
            <Text style={[sd.sectionLabel, { color: t.textMuted }]}>{tr('missions.timeline')}</Text>
            {createdAt && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.text} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{tr('missions.order_placed')} · {fmtD(createdAt)} · {fmtT(createdAt)}</Text>
                </View>
              </View>
            )}
            {cfg.active && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.text} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{tr('missions.confirmed_action')}</Text>
                </View>
              </View>
            )}
            {scheduledAt && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.textMuted} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{tr('missions.departure_planned')} · {fmtD(scheduledAt)} · {fmtT(scheduledAt)}</Text>
                </View>
              </View>
            )}
            <View style={sd.infoRow}>
              <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Feather name="circle" size={10} color={t.textMuted} /></View>
              <View style={sd.infoContent}>
                <Text style={[sd.infoValue, { color: t.textMuted }]}>{tr('missions.finished_action')}</Text>
              </View>
            </View>
            <View style={[sd.sep, { backgroundColor: t.border }]} />
          </>
        )}

      </View>
        {/* -- CTA -- */}
        {mission.status === 'QUOTE_PENDING' && (
          <View style={sd.actionsBlock}>
            <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
              <Feather name="file-text" size={18} color={t.accentText} />
              <Text style={[sd.navBtnText, { color: t.accentText }]}>{tr('ext.missions_send_quote')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {mission.status === 'QUOTE_SENT' && (
          <View style={[sd.actionsBlock, { opacity: 0.6 }]}>
            <View style={[sd.navBtn, { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}>
              <Feather name="clock" size={18} color={t.textMuted} />
              <Text style={[sd.navBtnText, { color: t.textMuted }]}>{tr('missions.waiting_response')}</Text>
            </View>
          </View>
        )}
        {mission.status === 'QUOTE_ACCEPTED' && (
          <View style={sd.actionsBlock}>
            <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
              <Feather name="arrow-right" size={18} color={t.accentText} />
              <Text style={[sd.navBtnText, { color: t.accentText }]}>{tr('ext.missions_start_mission')}</Text>
            </TouchableOpacity>
          </View>
        )}
        {(canNavigate || canComplete || cfg.active) && !['QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'].includes(mission.status) && (
          <View style={sd.actionsBlock}>
            {cfg.active && (
              <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
                <Feather name="arrow-right" size={18} color={t.accentText} />
                <Text style={[sd.navBtnText, { color: t.accentText }]}>{tr('ext.missions_resume_mission')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

    </Scroller>
  );
}

// ============================================================================
// OPPORTUNITY DETAIL -- Bottom Sheet (avant acceptation)
// ============================================================================

function OpportunityDetail({ opportunity, onAccept, onDecline, accepting, inPane = false }: {
  inPane?: boolean;
  opportunity: Opportunity;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
}) {
  const t = useAppTheme();
  const { t: tr } = useTranslation();
  const tabBarPadding = useTabBarPadding();
  const item = opportunity;
  const { day, time, relative } = formatScheduledDate(item.preferredTimeStart, tr);
  const lat = item.lat, lng = item.lng;
  const hasCoords = !!(lat && lng);
  const address = item.address || '';

  const buildingLabel =
    item.accessBuildingType === 'house'     ? tr('ext.missions_building_house')
    : item.accessBuildingType === 'office'    ? tr('ext.missions_building_office')
    : item.accessBuildingType === 'apartment' ? tr('ext.missions_building_apartment')
    : null;
  const accessRows: { icon: string; text: string }[] = [];
  if (item.accessFloor != null)
    accessRows.push({ icon: 'corner-right-up', text: item.accessFloor === 0 ? tr('ext.missions_ground_floor') : tr('ext.missions_floor_n', { n: item.accessFloor }) });
  if (item.accessHasElevator != null)
    accessRows.push({ icon: 'chevrons-up', text: item.accessHasElevator ? tr('ext.missions_elevator_available') : tr('ext.missions_no_elevator') });
  if (buildingLabel) accessRows.push({ icon: 'home', text: buildingLabel });

  const Scroller = inPane ? ScrollView : BottomSheetScrollView;
  return (
    <Scroller contentContainerStyle={[sd.scroll, { paddingBottom: tabBarPadding }]} showsVerticalScrollIndicator={false}>
      {/* -- Mini-carte -- */}
      {hasCoords ? (
        <View style={sd.mapContainer}>
          <MapView
            provider={PROVIDER_DEFAULT}
            customMapStyle={t.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT}
            style={sd.map}
            initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
            showsPointsOfInterest={false} showsBuildings={false}
          >
            <Marker coordinate={{ latitude: lat, longitude: lng }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[sd.markerOuter, { backgroundColor: t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,26,26,0.12)' }]}><View style={[sd.markerInner, { backgroundColor: t.accent, borderColor: t.cardBg }]} /></View>
            </Marker>
          </MapView>
          <View style={sd.mapOverlay}>
            <View style={[sd.mapAddrBadge, { backgroundColor: t.isDark ? 'rgba(26,26,26,0.9)' : 'rgba(255,255,255,0.94)' }]}>
              <Feather name="map-pin" size={11} color={t.textSub} />
              <Text style={[sd.mapAddrText, { color: t.text }]} numberOfLines={1}>{address}</Text>
            </View>
          </View>
          {item.urgent ? (
            <View style={[sd.mapStatusPill, { backgroundColor: t.accent }]}>
              <Feather name="zap" size={10} color={t.accentText} />
              <Text style={[sd.mapStatusText, { color: t.accentText }]}>{tr('ext.missions_urgent')}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[sd.mapFallback, { backgroundColor: t.surface }]}>
          <Feather name="map" size={24} color={t.textMuted} />
          <Text style={[sd.mapFallbackText, { color: t.textMuted }]}>{address || tr('ext.missions_no_address')}</Text>
        </View>
      )}

      <View style={sd.body}>
        {/* Fiche mission (planche 4A) : quoi, photos, accès, client, gain */}
        <MissionTitle brief={item.brief} big />
        <View style={sd.blocks}>
          <PhotoGallery photos={item.brief.photos} title={tr('mission.client_photos')} />
          <View style={sd.factRow}>
            <Feather name="calendar" size={14} color={t.textMuted} />
            <Text style={[sd.factText, { color: t.text }]}>{day} · {time} · {relative}</Text>
          </View>
          <AccessBlock brief={item.brief} />
          <ClientBlock brief={item.brief} />
          <View style={sd.earnWrap}><EarnRow brief={item.brief} /></View>
        </View>
      </View>
      {/* -- CTA Refuser / Accepter -- */}
      <View style={[sd.actionsBlock, { flexDirection: 'row', gap: 10 }]}>
        <TouchableOpacity
          style={[opp.declineBtn, { borderColor: t.border, flex: 1, justifyContent: 'center' }]}
          onPress={onDecline} disabled={accepting} activeOpacity={0.7}
          accessibilityRole="button" accessibilityLabel={tr('ext.missions_refuse')}
        >
          <Feather name="x" size={18} color={t.textSub} />
          <Text style={[opp.declineText, { color: t.textSub }]}>{tr('ext.missions_refuse')}</Text>
        </TouchableOpacity>
        {/* Moment 6 : accepter est un geste — glisser, pas taper. */}
        <View style={{ flex: 2 }}>
          <SlideToConfirm label={tr('provider.accept')} onConfirm={onAccept} disabled={accepting} />
        </View>
      </View>
    </Scroller>
  );
}

// Styles conservés des anciennes cartes : bouton Refuser de la fiche, état vide des opportunités.
const opp = StyleSheet.create({
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  declineText: { fontSize: 14, fontFamily: FONTS.sansMedium },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.sansMedium, marginTop: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 20 },
});

const sd = StyleSheet.create({
  scroll: { paddingBottom: 80 },
  mapContainer: { height: 150, marginTop: 8, overflow: 'hidden', position: 'relative' },
  map:          { ...StyleSheet.absoluteFillObject },
  markerOuter:  { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  markerInner:  { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5 },
  mapOverlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 24, backgroundColor: 'rgba(0,0,0,0.15)' },
  mapAddrBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  mapAddrText:  { fontSize: 12, fontFamily: FONTS.sansMedium, maxWidth: 260 },
  mapStatusPill:{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  mapStatusText:{ fontSize: 11, fontFamily: FONTS.sansMedium },
  mapFallback:  { height: 80, marginHorizontal: 20, marginTop: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5 },
  mapFallbackText: { fontSize: 12, fontFamily: FONTS.sans },

  body: { paddingHorizontal: 20, paddingTop: 14 },
  blocks: { marginTop: 4, marginHorizontal: -20 },
  earnWrap: { paddingHorizontal: 24, marginTop: 18 },
  factRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 16 },
  factText: { fontFamily: FONTS.sansMedium, fontSize: 13 },


  sep: { height: StyleSheet.hairlineWidth, marginVertical: 10 },

  sectionLabel: { fontSize: 11, fontFamily: FONTS.mono, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  infoIcon:     { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoContent:  { flex: 1 },
  infoValue:    { fontSize: 14, fontFamily: FONTS.sans, lineHeight: 20 },


  actionsBlock: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 10,
  },
  navBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15 },
  navBtnText:     { fontSize: 15, fontFamily: FONTS.sansMedium },
  completeBtnText:{ fontSize: 15, fontFamily: FONTS.sansMedium },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Missions() {
  const router = useRouter();
  const { socket } = useSocket();
  const [missions,        setMissions]        = useState<Mission[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const brandRefresh = useBrandRefresh();
  const [error,           setError]           = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [loadingDetails,  setLoadingDetails]  = useState(false);
  const [tab,             setTab]             = useState<Tab>('opportunities');
  const [historyFilter,   setHistoryFilter]   = useState<string>('all');
  const [, setCompleting] = useState<string | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchActive,    setSearchActive]    = useState(false);
  const [selectedDay,     setSelectedDay]     = useState<string | null>(null);
  const t = useAppTheme();
  const { t: tr } = useTranslation();

  // Opportunity state
  const [opportunities,    setOpportunities]    = useState<Opportunity[]>([]);
  const [loadingOpps,      setLoadingOpps]      = useState(true);
  const [oppError,         setOppError]         = useState<string | null>(null);
  const [acceptingOpp,     setAcceptingOpp]     = useState<number | null>(null);
  const tabBarPadding = useTabBarPadding();

  // Modals
  const [completeModal, setCompleteModal] = useState<Mission | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const { height: windowHeight } = useLayoutClass();
  // Sheet détail montée UNIQUEMENT quand ouverte : toujours montée avec
  // index={-1} + enableDynamicSizing, gorhom l'auto-ouvre sur Android et son
  // backdrop plein écran bloque tous les touchs. Le state contrôle le montage
  // et sert aussi au bouton back Android.
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  // Deux volets sur regular : le détail vit à droite, le sheet ne s'ouvre plus.
  const isSplit = useSplitPane();
  const closeDetailSheet = useCallback(() => { bottomSheetRef.current?.close(); }, []);
  useAndroidBackClose(detailSheetOpen, closeDetailSheet);

  // -- Data --
  const loadMissions = useCallback(async () => {
    try {
      setError(null);
      const response = await api.requests.list();
      const raw: any[] = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];

      const list: Mission[] = raw.map((r: any) => ({
        id:          String(r.id),
        title:       r.serviceType || r.title || tr('missions.mission'),
        serviceType: r.serviceType,
        description: r.description || '',
        price:       r.price || 0,
        status:      r.status as MissionStatus,
        address:     r.address,
        location:    r.address ? { address: r.address, lat: r.lat, lng: r.lng } : undefined,
        lat:         r.lat,
        lng:         r.lng,
        client:      r.client ? { id: r.client.id, name: r.client.name || '', phone: r.client.phone } : undefined,
        createdAt:   r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
        brief:       briefOf(r),
      }));

      setMissions(list);
    } catch (e: any) {
      devError('Missions load error:', e);
      setError(tr('missions.load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // -- Opportunities --
  const fetchOpportunities = useCallback(async () => {
    try {
      const res = await api.get('/requests/opportunities');
      const data = res?.data ?? res;
      const list: any[] = Array.isArray(data) ? data : data?.data ?? [];
      setOpportunities(list.map((o) => ({ ...o, brief: briefOf(o) })));
      setOppError(null);
    } catch (e) {
      devError('Opportunities load error:', e);
      // Pas d'état vide trompeur : on distingue l'échec réseau de "0 opportunité".
      setOppError(tr('missions.load_error'));
    } finally {
      setLoadingOpps(false);
    }
  }, [tr]);

  const handleAcceptOpp = useCallback(async (requestId: number) => {
    setAcceptingOpp(requestId);
    try {
      await api.post(`/requests/${requestId}/accept`);
      feedback.haptic('success');
      setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
      await loadMissions();
    } catch (e: any) {
      const code = e?.response?.data?.code || e?.data?.code;
      if (code === 'INVALID_STATE' || code === 'ALREADY_TAKEN') {
        setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
        feedback.error('provider.mission_unavailable_msg');
      } else {
        const msg = e?.response?.data?.message || e?.message || tr('common.error');
        feedback.error(msg);
      }
    } finally {
      setAcceptingOpp(null);
    }
  }, [loadMissions]);

  const handleDeclineOpp = useCallback(async (requestId: number) => {
    // Remove immediately from local list (optimistic), then call backend to persist
    // the decline so the rebroadcast loop skips this provider for this request.
    setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
    feedback.haptic('light');
    try {
      await api.post(`/requests/${requestId}/refuse`);
    } catch (e: any) {
      // Non-fatal: local state already updated. Just log for debugging.
      const msg = e?.response?.data?.message || e?.message || tr('common.error');
      feedback.error(msg);
    }
  }, []);

  // Real-time socket listener for new opportunities + quote status updates + claims
  useEffect(() => {
    if (!socket) return;
    const handleOpp = () => { fetchOpportunities(); };
    const handleStatus = () => { loadMissions(); };
    // When any provider accepts a request, remove it locally from the opportunities list
    // so it disappears instantly for all other providers without waiting for a refresh.
    const handleClaimed = (requestId: number | string) => {
      const idNum = typeof requestId === 'string' ? Number(requestId) : requestId;
      setOpportunities((prev) => prev.filter((o) => o.id !== idNum));
    };
    // Client a annulé → retirer l'opportunité ET rafraîchir les missions
    // actives (cas d'une mission déjà acceptée puis annulée).
    const handleCancelled = (data: any) => {
      handleClaimed(data?.id ?? data);
      loadMissions();
    };
    socket.on('new_opportunity', handleOpp);
    socket.on('request:statusUpdated', handleStatus);
    socket.on('request:claimed', handleClaimed);
    socket.on('request:cancelled', handleCancelled);
    return () => {
      socket.off('new_opportunity', handleOpp);
      socket.off('request:statusUpdated', handleStatus);
      socket.off('request:claimed', handleClaimed);
      socket.off('request:cancelled', handleCancelled);
    };
  }, [socket, fetchOpportunities, loadMissions]);

  // Refetch au focus (retour depuis earnings/dashboard…) avec cache court —
  // les sockets gèrent le temps réel, le focus rattrape les events manqués.
  const lastFetchRef = useRef(0);
  useFocusEffect(useCallback(() => {
    const now = Date.now();
    if (now - lastFetchRef.current > 60_000) {
      lastFetchRef.current = now;
      loadMissions();
      fetchOpportunities();
    }
  }, [loadMissions, fetchOpportunities]));
  const onRefresh = () => { lastFetchRef.current = Date.now(); setRefreshing(true); loadMissions(); fetchOpportunities(); };

  // -- Auto-redirect quand l'heure planifiee d'une mission ACCEPTED arrive --
  // On ne redirige QUE les missions dont le scheduledAt est strictement dans le futur
  // au moment du montage de l'effet. Cela evite de rediriger immediatement apres
  // l'acceptation d'une opportunite urgente (scheduledAt = maintenant ou passe).
  const redirectedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const initialNow = Date.now();
    const pending = missions.filter(m => {
      if (m.status !== 'ACCEPTED' || !m.scheduledAt) return false;
      const scheduled = new Date(m.scheduledAt).getTime();
      return scheduled > initialNow;
    });
    if (pending.length === 0) return;

    const check = () => {
      const now = Date.now();
      for (const m of pending) {
        if (redirectedRef.current.has(m.id)) continue;
        const scheduled = new Date(m.scheduledAt!).getTime();
        if (now >= scheduled) {
          redirectedRef.current.add(m.id);
          feedback.haptic('success');
          router.replace({ pathname: '/request/[id]/ongoing', params: { id: m.id } });
          return;
        }
      }
    };

    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [missions, router]);

  // -- Filtered lists --
  const upcomingMissions = useMemo(() => missions.filter(m => UPCOMING_STATUSES.includes(m.status)), [missions]);
  const historyMissions  = useMemo(() => missions.filter(m => HISTORY_STATUSES.includes(m.status)),  [missions]);

  const todayDoneEarnings = useMemo(() => {
    const today = new Date();
    return missions
      .filter(m => {
        const d = m.scheduledAt || m.createdAt;
        return m.status === 'DONE' && d && isSameDay(new Date(d), today);
      })
      .reduce((acc, m) => acc + (netFor(m.brief) ?? 0), 0);
  }, [missions]);

  const historyFilterOptions = useMemo(() => {
    const months = new Set(historyMissions.map(m => formatMonthKey(m.createdAt)));
    return [{ key: 'all', label: tr('ext.missions_all') }, ...Array.from(months).map(m => ({ key: m, label: m }))];
  }, [historyMissions]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return historyMissions;
    return historyMissions.filter(m => formatMonthKey(m.createdAt) === historyFilter);
  }, [historyMissions, historyFilter]);

  const displayedList = useMemo(() => {
    let base = tab === 'upcoming' ? upcomingMissions : filteredHistory;

    if (selectedDay && tab === 'upcoming') {
      base = base.filter(m => {
        const d = m.scheduledAt || m.createdAt;
        return d && new Date(d).toISOString().split('T')[0] === selectedDay;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      base = base.filter(m =>
        m.title.toLowerCase().includes(q) ||
        (m.address || m.location?.address || '').toLowerCase().includes(q) ||
        (m.client?.name || '').toLowerCase().includes(q)
      );
    }

    return base;
  }, [tab, upcomingMissions, filteredHistory, selectedDay, searchQuery]);

  // -- Actions --
  const openOpportunity = useCallback((item: Opportunity) => {
    setSelectedMission(null);
    setSelectedOpportunity(item);
    setDetailSheetOpen(true);
  }, []);

  const handleMissionPress = async (missionId: string) => {
    setSelectedOpportunity(null);
    setLoadingDetails(true);
    setDetailSheetOpen(true);
    try {
      const raw = await api.get(`/requests/${missionId}`);
      const r   = raw?.data || raw;
      setSelectedMission({
        id:          String(r.id),
        title:       r.serviceType || r.title || tr('missions.mission'),
        serviceType: r.serviceType,
        description: r.description || '',
        price:       r.price || 0,
        status:      r.status,
        address:     r.address,
        location:    r.address ? { address: r.address, lat: r.lat, lng: r.lng } : undefined,
        lat:         r.lat,
        lng:         r.lng,
        client:      r.client ? { id: r.client.id, name: r.client.name || '', phone: r.client.phone } : undefined,
        createdAt:   r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
        brief:       briefOf(r),
      });
    } catch { devError('Error loading mission details'); }
    finally   { setLoadingDetails(false); }
  };

  const handleNavigate = (mission: Mission) => {
    const lat = mission.lat || mission.location?.lat;
    const lng = mission.lng || mission.location?.lng;
    if (!lat || !lng) return;
    const url = Platform.select({
      ios:     `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleComplete = useCallback((mission: Mission) => {
    setCompleteModal(mission);
  }, []);

  const doConfirmComplete = useCallback(async () => {
    const mission = completeModal;
    if (!mission) return;
    setCompleteModal(null);
    setCompleting(mission.id);
    if (selectedMission?.id === mission.id) bottomSheetRef.current?.close();

    try {
      const response = await api.post(`/requests/${mission.id}/complete`);
      devLog(`[Missions] Mission ${mission.id} terminée. Net: ${response?.earnings ?? '—'}`);
      await loadMissions();
      router.push({ pathname: '/request/[id]/earnings', params: { id: mission.id } });
    } catch (error: any) {
      if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
        await loadMissions();
        devWarn('[Missions] Statut mission deja change -- rechargement');
      } else {
        devError('[Missions] Impossible de terminer:', error?.message);
      }
    } finally {
      setCompleting(null);
    }
  }, [completeModal, selectedMission, loadMissions, router]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.35} />
    ), []
  );

  const renderMission = useCallback(({ item }: { item: Mission }) => {
    const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.PUBLISHED;
    const isActive = cfg.active ?? false;
    return (
      <MissionRow
        brief={item.brief}
        time={formatTime(item.scheduledAt)}
        showClient
        onPress={() => {
          if (isActive) {
            router.replace({ pathname: '/request/[id]/ongoing', params: { id: item.id } });
          } else {
            handleMissionPress(item.id);
          }
        }}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleMissionPress est stable dans la pratique
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: t.bg }]}>
      <SplitPane
        master={(
          <>

      {/* -- Header -- */}
      <View style={[s.header, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
        <View style={s.headerRow}>
          <View>
            {upcomingMissions.length > 0 && (
              <Text style={[s.headerSub, { color: t.textMuted }]}>
                {upcomingMissions.length} {tr('ext.missions_to_come_upper', { plural: upcomingMissions.length > 1 ? 'S' : '' })}
              </Text>
            )}
            <Text style={[s.headerTitle, { color: t.text }]}>{tr('ext.missions_title')}</Text>
          </View>
          {!searchActive && (
            <TouchableOpacity
              style={[s.searchIconBtn, { backgroundColor: t.surface }]}
              onPress={() => setSearchActive(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={tr('common.search')}
            >
              <Feather name="search" size={20} color={t.text} />
            </TouchableOpacity>
          )}
        </View>

        {searchActive && (
          <View style={[s.searchBar, { backgroundColor: t.surface }]}>
            <Feather name="search" size={15} color={t.textMuted} style={{ marginLeft: 12 }} />
            <TextInput
              style={[s.searchInput, { color: t.text }]}
              placeholder={tr('ext.missions_search_placeholder')}
              placeholderTextColor={t.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onBlur={() => { if (!searchQuery) setSearchActive(false); }}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                style={{ paddingHorizontal: 10 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={tr('ext.missions_clear_search_a11y')}
              >
                <Feather name="x-circle" size={16} color={t.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* -- Tabs -- */}
      <TabBar tab={tab} onChange={setTab} upcomingCount={upcomingMissions.length} opportunityCount={opportunities.length} />

      {/* -- Erreur opportunités (échec réseau ≠ 0 opportunité) -- */}
      {tab === 'opportunities' && !loadingOpps && oppError && (
        <View style={[s.errorBanner, { backgroundColor: t.surface }]}>
          <Feather name="alert-circle" size={15} color={t.text} />
          <Text style={[s.errorText, { color: t.text }]}>{oppError}</Text>
          <TouchableOpacity onPress={() => { setLoadingOpps(true); fetchOpportunities(); }}>
            <Text style={[s.retryText, { color: t.text }]}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* -- Opportunites tab -- */}
      {tab === 'opportunities' && <BrandRefreshHeader style={brandRefresh.headerStyle} />}
      {tab === 'opportunities' && (
        loadingOpps ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={t.accent} />
          </View>
        ) : (
          <Reanimated.FlatList
            data={opportunities}
            keyExtractor={(item) => String(item.id)}
            onScroll={brandRefresh.onScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <MissionRow
                brief={item.brief}
                onPress={() => openOpportunity(item)}
                onSwipeAccept={acceptingOpp ? undefined : () => handleAcceptOpp(item.id)}
                onSwipeRefuse={acceptingOpp ? undefined : () => handleDeclineOpp(item.id)}
              />
            )}
            contentContainerStyle={[s.list, { paddingBottom: tabBarPadding }, !opportunities.length && s.listEmpty]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="transparent" colors={['transparent']} />
            }
            ListEmptyComponent={
              oppError ? null : (
                <View style={opp.emptyWrap}>
                  <Feather name="search" size={48} color={t.textMuted} />
                  <Text style={[opp.emptyTitle, { color: t.text }]}>{tr('ext.missions_no_opp_title')}</Text>
                  <Text style={[opp.emptySub, { color: t.textSub }]}>
                    {tr('ext.missions_no_opp_sub')}
                  </Text>
                </View>
              )
            }
          />
        )
      )}

      {/* -- DayPicker (uniquement A venir) -- */}
      {tab === 'upcoming' && (
        <DayPicker selected={selectedDay} onSelect={setSelectedDay} />
      )}

      {/* -- Bandeau CA journalier -- */}
      {tab === 'upcoming' && (
        <EarningsBanner missions={missions} />
      )}

      {/* -- Filtres Historique -- */}
      {tab === 'history' && historyFilterOptions.length > 1 && (
        <FilterBar options={historyFilterOptions} selected={historyFilter} onSelect={setHistoryFilter} />
      )}

      {/* -- Erreur -- */}
      {error && tab !== 'opportunities' && (
        <View style={[s.errorBanner, { backgroundColor: t.surface }]}>
          <Feather name="alert-circle" size={15} color={t.text} />
          <Text style={[s.errorText, { color: t.text }]}>{error}</Text>
          <TouchableOpacity onPress={loadMissions}>
            <Text style={[s.retryText, { color: t.text }]}>{tr('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* -- Liste missions (A venir / Historique) -- */}
      {tab !== 'opportunities' && (
        <FlatList
          data={displayedList}
          renderItem={renderMission}
          keyExtractor={item => item.id}
          contentContainerStyle={[s.list, { paddingBottom: tabBarPadding }, !displayedList.length && s.listEmpty]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          ListEmptyComponent={
            <EmptyState tab={tab} onGoOnline={() => router.replace('/(tabs)/dashboard')} dayEarnings={tab === 'upcoming' ? todayDoneEarnings : undefined} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* -- Bottom Sheet Detail -- */}
          </>
        )}
        detail={isSplit && detailSheetOpen ? (
          <>
      {(() => {
        if (!isSplit || !detailSheetOpen) return null;
        if (loadingDetails) return <ActivityIndicator size="large" color={t.accent} style={{ marginTop: 60 }} />;
        if (selectedMission) return (
          <MissionDetail
            inPane
            mission={selectedMission}
            onNavigate={() => handleNavigate(selectedMission)}
            onComplete={() => { setDetailSheetOpen(false); handleComplete(selectedMission); }}
            onViewFull={() => {
              setDetailSheetOpen(false);
              const st = selectedMission.status?.toUpperCase();
              if (st === 'QUOTE_PENDING') router.push({ pathname: '/request/[id]/send-quote', params: { id: selectedMission.id } });
              else router.replace({ pathname: '/request/[id]/ongoing', params: { id: selectedMission.id } });
            }}
          />
        );
        if (selectedOpportunity) return (
          <OpportunityDetail
            inPane
            opportunity={selectedOpportunity}
            accepting={acceptingOpp === selectedOpportunity.id}
            onAccept={() => { setDetailSheetOpen(false); handleAcceptOpp(selectedOpportunity.id); }}
            onDecline={() => { setDetailSheetOpen(false); handleDeclineOpp(selectedOpportunity.id); }}
          />
        );
        return null;
      })()}
          </>
        ) : null}
        placeholder={(
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.4, color: t.textMuted, textTransform: 'uppercase' }}>{tr('missions.select_hint', { defaultValue: 'Sélectionnez une mission' })}</Text>
          </View>
        )}
      />
      {detailSheetOpen && !isSplit && (
      <BottomSheet ref={bottomSheetRef} index={0} enableDynamicSizing enablePanDownToClose onClose={() => setDetailSheetOpen(false)} backdropComponent={renderBackdrop} backgroundStyle={{ backgroundColor: t.cardBg }} handleIndicatorStyle={{ backgroundColor: t.border }} maxDynamicContentSize={windowHeight * 0.85}>
        {loadingDetails ? (
          <ActivityIndicator size="large" color={t.accent} style={{ marginTop: 60 }} />
        ) : selectedMission ? (
          <MissionDetail
            mission={selectedMission}
            onNavigate={() => handleNavigate(selectedMission)}
            onComplete={() => {
              bottomSheetRef.current?.close();
              handleComplete(selectedMission);
            }}
            onViewFull={() => {
              bottomSheetRef.current?.close();
              const st = selectedMission.status?.toUpperCase();
              if (st === 'QUOTE_PENDING') {
                router.push({ pathname: '/request/[id]/send-quote', params: { id: selectedMission.id } });
              } else {
                router.replace({ pathname: '/request/[id]/ongoing', params: { id: selectedMission.id } });
              }
            }}
          />
        ) : selectedOpportunity ? (
          <OpportunityDetail
            opportunity={selectedOpportunity}
            accepting={acceptingOpp === selectedOpportunity.id}
            onAccept={() => {
              bottomSheetRef.current?.close();
              handleAcceptOpp(selectedOpportunity.id);
            }}
            onDecline={() => {
              bottomSheetRef.current?.close();
              handleDeclineOpp(selectedOpportunity.id);
            }}
          />
        ) : null}
      </BottomSheet>
      )}

      {/* -- Modal confirmation "Terminer" -- */}
      <ConfirmModal
        visible={!!completeModal}
        title={tr('missions.complete_confirm') + ' ?'}
        message={completeModal ? `${completeModal.title}` : undefined}
        confirmLabel={tr('missions.complete_cta')}
        cancelLabel={tr('common.cancel')}
        onConfirm={doConfirmComplete}
        onCancel={() => setCompleteModal(null)}
      />

    </SafeAreaView>
  );
}

// ============================================================================
// STYLES GLOBAUX
// ============================================================================

const s = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 34, fontFamily: FONTS.bebas, includeFontPadding: false, letterSpacing: 0.5 },
  headerSub:   { fontSize: 11, fontFamily: FONTS.mono, marginTop: 6, letterSpacing: 0.9, textTransform: 'uppercase' },
  searchIconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchBar:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, height: 44, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: FONTS.sans, paddingHorizontal: 10, height: 44 },

  list:      { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32 },
  listEmpty: { flex: 1 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4, borderRadius: 12, padding: 12 },
  errorText:   { flex: 1, fontSize: 13, fontFamily: FONTS.sans },
  retryText:   { fontSize: 13, fontFamily: FONTS.sansMedium },
});
