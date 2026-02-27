/* eslint-disable @typescript-eslint/no-unused-vars */
// app/(tabs)/missions.tsx — Provider Mission Hub
// ─── Design FIXED : Palette Noir/Blanc/Gris, DayPicker horizontal, Zéro Alert ─

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, SafeAreaView,
  Animated, Easing, Dimensions, Linking, Platform,
  TextInput, ScrollView, Modal, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

const { width } = Dimensions.get('window');
const NET_RATE = 0.85;

// ─── Grayscale map style ──────────────────────────────────────────────────────
const MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi',     elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road',    elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#d0d0d0' }] },
];

// ============================================================================
// TYPES
// ============================================================================

type MissionStatus =
  | 'PUBLISHED' | 'ACCEPTED' | 'ONGOING' | 'DONE'
  | 'CANCELLED' | 'PENDING_PAYMENT' | 'EXPIRED';

type Mission = {
  id: string;
  title: string;
  serviceType?: string;
  description: string;
  price: number;
  status: MissionStatus;
  location?: { address?: string; lat?: number; lng?: number };
  address?: string;
  client?: { name: string; phone?: string };
  createdAt?: string;
  scheduledAt?: string;
  lat?: number;
  lng?: number;
};

type Tab = 'upcoming' | 'history';

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const formatShortDate = (d?: string) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

const formatTime = (d?: string) => {
  if (!d) return null;
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const formatMonthKey = (d?: string) => {
  if (!d) return 'Inconnu';
  return new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth()    === b.getMonth() &&
  a.getDate()     === b.getDate();

// Monochrome statuts — seul le vert #059669 est autorisé pour les gains
const STATUS_CFG: Record<MissionStatus, { label: string; icon: string; active?: boolean; done?: boolean }> = {
  PUBLISHED:       { label: 'Publié',    icon: 'radio-outline',            active: true },
  ACCEPTED:        { label: 'Confirmé',  icon: 'checkmark-circle-outline', active: true },
  ONGOING:         { label: 'En cours',  icon: 'flash-outline',            active: true },
  DONE:            { label: 'Terminé',   icon: 'checkmark-done-outline',   done: true },
  CANCELLED:       { label: 'Annulé',    icon: 'close-circle-outline' },
  PENDING_PAYMENT: { label: 'Paiement',  icon: 'card-outline' },
  EXPIRED:         { label: 'Expiré',    icon: 'time-outline' },
};

const SERVICE_ICONS: Record<string, string> = {
  plomberie: 'water-outline', electricite: 'flash-outline',
  bricolage: 'hammer-outline', menage: 'sparkles-outline',
  jardinage: 'leaf-outline', demenagement: 'cube-outline', peinture: 'color-palette-outline',
};

const getServiceIcon = (type?: string): string => {
  if (!type) return 'construct-outline';
  const key = type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = Object.keys(SERVICE_ICONS).find(k => key.includes(k));
  return match ? SERVICE_ICONS[match] : 'construct-outline';
};

const UPCOMING_STATUSES: MissionStatus[] = ['PUBLISHED', 'ACCEPTED', 'ONGOING', 'PENDING_PAYMENT'];
const HISTORY_STATUSES:  MissionStatus[] = ['DONE', 'CANCELLED', 'EXPIRED'];

// ============================================================================
// CONFIRM MODAL — remplace Alert.alert
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
  confirmLabel = 'Confirmer', cancelLabel = 'Annuler',
  onConfirm, onCancel,
}: ConfirmModalProps) {
  const slideAnim = useRef(new Animated.Value(320)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 22, stiffness: 280, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 320, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={cm.overlay} onPress={onCancel}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)', opacity: fadeAnim }]} />
      </Pressable>
      <Animated.View style={[cm.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={cm.handle} />
        <Text style={cm.title}>{title}</Text>
        {message ? <Text style={cm.message}>{message}</Text> : null}
        <View style={cm.actions}>
          <TouchableOpacity style={cm.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
            <Text style={cm.cancelLabel}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cm.confirmBtn} onPress={onConfirm} activeOpacity={0.75}>
            <Text style={cm.confirmLabel}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 16 },
    }),
  },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginBottom: 20 },
  title:        { fontSize: 20, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', letterSpacing: -0.3, marginBottom: 10 },
  message:      { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  actions:      { flexDirection: 'row', gap: 10 },
  cancelBtn:    { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center' },
  cancelLabel:  { fontSize: 15, fontWeight: '700', color: '#888' },
  confirmBtn:   { flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: '#1A1A1A', alignItems: 'center' },
  confirmLabel: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ============================================================================
// DAY PICKER — barre horizontale 7 jours glissants
// ============================================================================

function buildDays(count = 10) {
  const DAY_NAMES  = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const result: { iso: string; dayName: string; dayNum: string; isToday: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    result.push({
      iso:     d.toISOString().split('T')[0],
      dayName: i === 0 ? 'Auj.' : DAY_NAMES[d.getDay()],
      dayNum:  String(d.getDate()),
      isToday: i === 0,
    });
  }
  return result;
}

const DAYS = buildDays(10);

function DayPicker({ selected, onSelect }: { selected: string | null; onSelect: (iso: string | null) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={dp.container}
      style={dp.scroll}
    >
      {/* "Tous" */}
      <TouchableOpacity
        style={[dp.chip, selected === null && dp.chipSelected]}
        onPress={() => onSelect(null)}
        activeOpacity={0.75}
      >
        <Text style={[dp.chipLabel, selected === null && dp.chipLabelSelected]}>Tous</Text>
      </TouchableOpacity>

      {DAYS.map(day => {
        const active = selected === day.iso;
        return (
          <TouchableOpacity
            key={day.iso}
            style={[dp.day, active && dp.daySelected]}
            onPress={() => onSelect(active ? null : day.iso)}
            activeOpacity={0.75}
          >
            <Text style={[dp.dayName, active && dp.dayNameSelected]}>{day.dayName}</Text>
            <Text style={[dp.dayNum, active && dp.dayNumSelected]}>{day.dayNum}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const dp = StyleSheet.create({
  scroll:    { flexGrow: 0, backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  container: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F5F5F5', borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSelected:      { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  chipLabel:         { fontSize: 13, fontWeight: '600', color: '#888' },
  chipLabelSelected: { color: '#FFF', fontWeight: '700' },
  day: {
    alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 14, backgroundColor: '#F5F5F5', minWidth: 52,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  daySelected:     { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  dayName:         { fontSize: 10, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  dayNameSelected: { color: 'rgba(255,255,255,0.65)' },
  dayNum:          { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  dayNumSelected:  { color: '#FFF' },
});

// ============================================================================
// EARNINGS BANNER — bandeau CA journalier
// ============================================================================

function EarningsBanner({ missions }: { missions: Mission[] }) {
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
    .reduce((acc, m) => acc + m.price * NET_RATE, 0);

  if (todayMs.length === 0 && doneTodayEarnings === 0) return null;

  return (
    <View style={eb.wrap}>
      <View style={eb.left}>
        <Ionicons name="flash-outline" size={14} color="#888" />
        <Text style={eb.text}>
          {todayMs.length > 0
            ? `${todayMs.length} mission${todayMs.length > 1 ? 's' : ''} aujourd'hui`
            : 'Journée complétée'}
        </Text>
      </View>
      {doneTodayEarnings > 0 && (
        <Text style={eb.earnings}>+{formatEuros(doneTodayEarnings)}</Text>
      )}
    </View>
  );
}

const eb = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 4, marginBottom: 2,
    backgroundColor: '#F5F5F5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  left:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text:     { fontSize: 13, fontWeight: '600', color: '#555' },
  earnings: { fontSize: 14, fontWeight: '800', color: '#059669' },
});

// ============================================================================
// MISSION CARD — style "Lame" Uber-like
// ============================================================================

function MissionCard({
  mission, onPress, onNavigate, onComplete,
}: {
  mission: Mission;
  onPress: () => void;
  onNavigate: () => void;
  onComplete: () => void;
}) {
  const cfg      = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const net      = mission.price * NET_RATE;
  const dateStr  = mission.scheduledAt || mission.createdAt;
  const time     = formatTime(dateStr);
  const address  = mission.location?.address || mission.address || 'Adresse inconnue';
  const isActive = cfg.active ?? false;
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = isActive && !!(mission.lat || mission.location?.lat);

  // Badge monochrome
  const badgeBg    = cfg.done ? '#F0F0F0' : isActive ? '#1A1A1A' : '#F0F0F0';
  const badgeColor = cfg.done ? '#555'    : isActive ? '#FFF'    : '#ADADAD';

  return (
    <TouchableOpacity style={[mc.card, isActive && mc.cardActive]} onPress={onPress} activeOpacity={0.78}>

      {/* Barre temporelle à gauche */}
      <View style={mc.timeCol}>
        {time ? (
          <>
            <Text style={[mc.timeText, isActive && mc.timeTextActive]}>{time}</Text>
            <View style={[mc.timeLine, isActive && mc.timeLineActive]} />
          </>
        ) : (
          <View style={[mc.timeDot, isActive && mc.timeDotActive]} />
        )}
      </View>

      {/* Contenu principal */}
      <View style={mc.body}>
        <View style={mc.topRow}>
          <View style={mc.info}>
            <Text style={mc.title} numberOfLines={1}>{mission.title}</Text>
            {mission.client?.name && (
              <Text style={mc.client} numberOfLines={1}>{mission.client.name}</Text>
            )}
            <View style={mc.addrRow}>
              <Ionicons name="location-outline" size={11} color="#ADADAD" />
              <Text style={mc.addr} numberOfLines={1}>{address}</Text>
            </View>
          </View>

          {/* Gains à droite — vert uniquement */}
          <View style={mc.earningsCol}>
            <Text style={mc.earningsNet}>+{formatEuros(net)}</Text>
            <Text style={mc.earningsLabel}>net</Text>
          </View>
        </View>

        {/* Footer : badge statut + actions rapides */}
        <View style={mc.footer}>
          <View style={[mc.badge, { backgroundColor: badgeBg }]}>
            <Ionicons name={cfg.icon as any} size={10} color={badgeColor} />
            <Text style={[mc.badgeText, { color: badgeColor }]}>{cfg.label}</Text>
          </View>

          <View style={mc.quickActions}>
            {canNavigate && (
              <TouchableOpacity style={mc.quickBtn} onPress={onNavigate} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={15} color="#1A1A1A" />
              </TouchableOpacity>
            )}
            {canComplete && (
              <TouchableOpacity style={[mc.quickBtn, mc.quickBtnComplete]} onPress={onComplete} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={15} color="#059669" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const mc = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 18, marginBottom: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
  cardActive: { borderWidth: 1.5, borderColor: '#1A1A1A' },

  // Colonne temporelle gauche
  timeCol:       { width: 56, alignItems: 'center', paddingTop: 16, paddingBottom: 12, gap: 4 },
  timeText:      { fontSize: 12, fontWeight: '700', color: '#ADADAD' },
  timeTextActive:{ color: '#1A1A1A' },
  timeLine:      { flex: 1, width: 2, backgroundColor: '#F0F0F0', borderRadius: 1 },
  timeLineActive:{ backgroundColor: '#1A1A1A' },
  timeDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0E0E0', marginTop: 4 },
  timeDotActive: { backgroundColor: '#1A1A1A' },

  // Corps
  body:   { flex: 1, paddingRight: 14, paddingTop: 14, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  info:   { flex: 1, gap: 3 },
  title:  { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  client: { fontSize: 12, color: '#888', fontWeight: '500' },
  addrRow:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  addr:   { fontSize: 11, color: '#ADADAD', flex: 1 },

  // Gains
  earningsCol:   { alignItems: 'flex-end', paddingLeft: 10 },
  earningsNet:   { fontSize: 18, fontWeight: '900', color: '#059669', letterSpacing: -0.4 },
  earningsLabel: { fontSize: 10, color: '#ADADAD', fontWeight: '600' },

  // Footer
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  quickActions:{ flexDirection: 'row', gap: 6 },
  quickBtn:    { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  quickBtnComplete: { backgroundColor: '#ECFDF5' },
});

// ============================================================================
// FILTER BAR (historique)
// ============================================================================

function FilterBar({ options, selected, onSelect }: {
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  return (
    <FlatList
      horizontal
      data={options}
      keyExtractor={item => item.key}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingVertical: 10 }}
      renderItem={({ item }) => {
        const active = item.key === selected;
        return (
          <TouchableOpacity
            style={[fb.chip, active && fb.chipActive]}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.8}
          >
            <Text numberOfLines={1} style={[fb.chipText, active && fb.chipTextActive]}>
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
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  chipActive:    { backgroundColor: '#1A1A1A' },
  chipText:      { fontSize: 13, fontWeight: '600', color: '#888' },
  chipTextActive:{ color: '#FFF', fontWeight: '700' },
});

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ tab, onGoOnline }: { tab: Tab; onGoOnline: () => void }) {
  if (tab === 'history') {
    return (
      <View style={es.wrap}>
        <Ionicons name="time-outline" size={40} color="#D0D0D0" />
        <Text style={es.title}>Aucun historique</Text>
        <Text style={es.sub}>Vos missions terminées apparaîtront ici.</Text>
      </View>
    );
  }
  return (
    <View style={es.wrap}>
      <View style={es.iconWrap}>
        <Ionicons name="navigate-circle-outline" size={44} color="#D0D0D0" />
      </View>
      <Text style={es.title}>Aucune mission à venir</Text>
      <Text style={es.sub}>Passez en ligne pour commencer à recevoir des missions.</Text>
      <TouchableOpacity style={es.cta} onPress={onGoOnline} activeOpacity={0.85}>
        <View style={es.ctaDot} />
        <Text style={es.ctaText}>Passer en ligne</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const es = StyleSheet.create({
  wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 80, gap: 12 },
  iconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  title:   { fontSize: 17, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  sub:     { fontSize: 14, color: '#ADADAD', textAlign: 'center', lineHeight: 20 },
  cta:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A1A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, marginTop: 8 },
  ctaDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34C759' },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// CLIENT AVATAR
// ============================================================================

function ClientAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[cav.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[cav.text, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}
const cav = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A1A' },
  text:   { color: '#FFF', fontWeight: '800', letterSpacing: 0.5 },
});

// ============================================================================
// TAB BAR
// ============================================================================

function TabBar({ tab, onChange, upcomingCount }: {
  tab: Tab; onChange: (t: Tab) => void; upcomingCount: number;
}) {
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(indicatorX, { toValue: tab === 'upcoming' ? 0 : 1, tension: 220, friction: 22, useNativeDriver: false }).start();
  }, [tab]);

  const indicatorLeft = indicatorX.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  return (
    <View style={tb.wrap}>
      <Animated.View style={[tb.indicator, { left: indicatorLeft }]} />
      {(['upcoming', 'history'] as Tab[]).map(t => (
        <TouchableOpacity key={t} style={tb.tab} onPress={() => onChange(t)} activeOpacity={0.75}>
          <Text style={[tb.label, tab === t && tb.labelActive]}>
            {t === 'upcoming' ? 'À venir' : 'Historique'}
          </Text>
          {t === 'upcoming' && upcomingCount > 0 && (
            <View style={tb.badge}>
              <Text style={tb.badgeText}>{upcomingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tb = StyleSheet.create({
  wrap:      { flexDirection: 'row', backgroundColor: '#F5F5F5', marginHorizontal: 16, marginTop: 10, marginBottom: 4, borderRadius: 14, padding: 4, position: 'relative' },
  indicator: { position: 'absolute', top: 4, bottom: 4, width: '50%', backgroundColor: '#FFF', borderRadius: 11,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6 }, android: { elevation: 2 } }) },
  tab:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  label:     { fontSize: 14, fontWeight: '600', color: '#ADADAD' },
  labelActive:{ color: '#1A1A1A', fontWeight: '700' },
  badge:     { backgroundColor: '#1A1A1A', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// MISSION DETAIL — Bottom Sheet
// ============================================================================

function MissionDetail({ mission, onNavigate, onComplete, onViewFull }: {
  mission: Mission; onNavigate: () => void; onComplete: () => void; onViewFull: () => void;
}) {
  const cfg         = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const net         = mission.price * NET_RATE;
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = !!(cfg.active) && !!(mission.lat || mission.location?.lat);
  const isDone      = mission.status === 'DONE';
  const address     = mission.location?.address || mission.address || '';
  const lat         = mission.lat || mission.location?.lat;
  const lng         = mission.lng || mission.location?.lng;
  const hasCoords   = !!(lat && lng);
  const createdAt   = mission.createdAt  ? new Date(mission.createdAt)  : null;
  const scheduledAt = mission.scheduledAt ? new Date(mission.scheduledAt) : null;

  const fmtT = (d: Date | null) => d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
  const fmtD = (d: Date | null) => d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : '—';

  const badgeBg    = cfg.done ? '#F0F0F0' : cfg.active ? '#1A1A1A' : '#F0F0F0';
  const badgeColor = cfg.done ? '#555'    : cfg.active ? '#FFF'    : '#ADADAD';

  return (
    <BottomSheetScrollView contentContainerStyle={sd.scroll} showsVerticalScrollIndicator={false}>
      <View style={sd.handle} />

      {/* ── Mini-carte Silver ── */}
      {hasCoords ? (
        <View style={sd.mapContainer}>
          <MapView
            provider={PROVIDER_DEFAULT}
            customMapStyle={MAP_STYLE}
            style={sd.map}
            initialRegion={{ latitude: lat!, longitude: lng!, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            scrollEnabled={false} zoomEnabled={false} pitchEnabled={false} rotateEnabled={false}
            showsPointsOfInterest={false} showsBuildings={false}
          >
            <Marker coordinate={{ latitude: lat!, longitude: lng! }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={sd.markerOuter}><View style={sd.markerInner} /></View>
            </Marker>
          </MapView>
          <View style={sd.mapOverlay}>
            <View style={sd.mapAddrBadge}>
              <Ionicons name="location-outline" size={11} color="#555" />
              <Text style={sd.mapAddrText} numberOfLines={1}>{address}</Text>
            </View>
          </View>
          {/* Badge statut flottant — monochrome */}
          <View style={[sd.mapStatusPill, { backgroundColor: badgeBg }]}>
            <Ionicons name={cfg.icon as any} size={10} color={badgeColor} />
            <Text style={[sd.mapStatusText, { color: badgeColor }]}>{cfg.label}</Text>
          </View>
        </View>
      ) : (
        <View style={sd.mapFallback}>
          <Ionicons name="map-outline" size={24} color="#D0D0D0" />
          <Text style={sd.mapFallbackText}>{address || 'Adresse non disponible'}</Text>
        </View>
      )}

      <View style={sd.body}>
        {/* Titre */}
        <View style={sd.titleRow}>
          <Text style={sd.title}>{mission.title}</Text>
          {mission.client?.name && (
            <View style={sd.clientRow}>
              <ClientAvatar name={mission.client.name} size={24} />
              <Text style={sd.clientName}>{mission.client.name}</Text>
            </View>
          )}
        </View>

        {/* Gains — bloc vert */}
        <View style={sd.earningsBlock}>
          <View>
            <Text style={sd.earningsLabel}>Gain net (85%)</Text>
            <Text style={sd.earningsNet}>{formatEuros(net)}</Text>
          </View>
          <View style={sd.earningsDivider} />
          <View>
            <Text style={sd.earningsLabel}>Brut client</Text>
            <Text style={sd.earningsGross}>{formatEuros(mission.price)}</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={sd.sep} />

        {/* Chronologie */}
        {(createdAt || scheduledAt) && (
          <>
            <Text style={sd.sectionLabel}>Chronologie</Text>
            {createdAt && (
              <View style={sd.infoRow}>
                <View style={sd.infoIcon}><Ionicons name="ellipse" size={12} color="#ADADAD" /></View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>Commande passée</Text>
                  <Text style={sd.infoValue}>{fmtD(createdAt)} · {fmtT(createdAt)}</Text>
                </View>
              </View>
            )}
            {scheduledAt && (
              <View style={sd.infoRow}>
                <View style={sd.infoIcon}><Ionicons name="calendar-outline" size={12} color="#ADADAD" /></View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>Départ prévu</Text>
                  <Text style={sd.infoValue}>{fmtD(scheduledAt)} · {fmtT(scheduledAt)}</Text>
                </View>
              </View>
            )}
            <View style={sd.sep} />
          </>
        )}

        {/* Adresse + description */}
        {(address || mission.description) && (
          <>
            <Text style={sd.sectionLabel}>Détails mission</Text>
            {address ? (
              <View style={sd.infoRow}>
                <View style={sd.infoIcon}><Ionicons name="location-outline" size={12} color="#ADADAD" /></View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>Adresse</Text>
                  <Text style={sd.infoValue}>{address}</Text>
                </View>
              </View>
            ) : null}
            {mission.description ? (
              <View style={sd.infoRow}>
                <View style={sd.infoIcon}><Ionicons name="document-text-outline" size={12} color="#ADADAD" /></View>
                <View style={sd.infoContent}>
                  <Text style={sd.infoLabel}>Description</Text>
                  <Text style={sd.infoValue}>{mission.description}</Text>
                </View>
              </View>
            ) : null}
            <View style={sd.sep} />
          </>
        )}

        {/* Client card */}
        {mission.client && (
          <>
            <Text style={sd.sectionLabel}>Client</Text>
            <View style={sd.clientCard}>
              <ClientAvatar name={mission.client.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={sd.clientCardName}>{mission.client.name}</Text>
                {mission.client.phone && (
                  <Text style={sd.clientCardPhone}>{mission.client.phone}</Text>
                )}
              </View>
              {mission.client.phone && (
                <TouchableOpacity
                  style={sd.callBtn}
                  onPress={() => Linking.openURL(`tel:${mission.client!.phone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={16} color="#FFF" />
                </TouchableOpacity>
              )}
            </View>
            <View style={sd.sep} />
          </>
        )}

        {/* Actions */}
        <View style={sd.actions}>
          {canNavigate && (
            <TouchableOpacity style={sd.navBtn} onPress={onNavigate} activeOpacity={0.85}>
              <Ionicons name="navigate" size={18} color="#FFF" />
              <Text style={sd.navBtnText}>S'y rendre (GPS)</Text>
            </TouchableOpacity>
          )}
          {canComplete && (
            <TouchableOpacity style={sd.completeBtn} onPress={onComplete} activeOpacity={0.85}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={sd.completeBtnText}>Terminer la mission</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </BottomSheetScrollView>
  );
}

const sd = StyleSheet.create({
  scroll: { paddingBottom: 40 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E0E0E0', alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  // Map
  mapContainer: { height: 170, marginTop: 8, overflow: 'hidden', position: 'relative' },
  map:          { ...StyleSheet.absoluteFillObject },
  markerOuter:  { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(26,26,26,0.12)', alignItems: 'center', justifyContent: 'center' },
  markerInner:  { width: 12, height: 12, borderRadius: 6, backgroundColor: '#1A1A1A', borderWidth: 2.5, borderColor: '#FFF' },
  mapOverlay:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 10, paddingTop: 24, backgroundColor: 'rgba(0,0,0,0.15)' },
  mapAddrBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  mapAddrText:  { fontSize: 12, color: '#1A1A1A', fontWeight: '600', maxWidth: 260 },
  mapStatusPill:{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  mapStatusText:{ fontSize: 11, fontWeight: '800' },
  mapFallback:  { height: 80, backgroundColor: '#F5F5F5', marginHorizontal: 20, marginTop: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 5 },
  mapFallbackText: { fontSize: 12, color: '#ADADAD', fontWeight: '500' },

  // Body
  body: { paddingHorizontal: 20, paddingTop: 18 },
  titleRow: { marginBottom: 16, gap: 6 },
  title:    { fontSize: 22, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.4 },
  clientRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientName:{ fontSize: 13, color: '#888', fontWeight: '600' },

  // Gains
  earningsBlock:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 16, padding: 16, marginBottom: 18 },
  earningsLabel:  { fontSize: 11, color: '#ADADAD', fontWeight: '600', marginBottom: 3 },
  earningsNet:    { fontSize: 28, fontWeight: '900', color: '#059669', letterSpacing: -0.8 },
  earningsDivider:{ width: StyleSheet.hairlineWidth, height: 44, backgroundColor: '#E0E0E0', marginHorizontal: 20 },
  earningsGross:  { fontSize: 16, fontWeight: '600', color: '#ADADAD' },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginVertical: 14 },

  // Info rows
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  infoIcon:     { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoContent:  { flex: 1 },
  infoLabel:    { fontSize: 10, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue:    { fontSize: 14, fontWeight: '600', color: '#1A1A1A', lineHeight: 20 },

  // Client card
  clientCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  clientCardName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  clientCardPhone:{ fontSize: 13, color: '#ADADAD', marginTop: 2 },
  callBtn:        { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },

  // Actions
  actions:        { marginTop: 4, gap: 10, marginBottom: 8 },
  navBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A1A1A', borderRadius: 16, paddingVertical: 15 },
  navBtnText:     { fontSize: 15, fontWeight: '700', color: '#FFF' },
  completeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', borderRadius: 16, paddingVertical: 15 },
  completeBtnText:{ fontSize: 15, fontWeight: '700', color: '#FFF' },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function Missions() {
  const router = useRouter();
  const [missions,        setMissions]        = useState<Mission[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [loadingDetails,  setLoadingDetails]  = useState(false);
  const [tab,             setTab]             = useState<Tab>('upcoming');
  const [historyFilter,   setHistoryFilter]   = useState<string>('all');
  const [completing,      setCompleting]      = useState<string | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchActive,    setSearchActive]    = useState(false);
  const [selectedDay,     setSelectedDay]     = useState<string | null>(null);

  // Modals
  const [completeModal, setCompleteModal] = useState<Mission | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints     = useMemo(() => ['55%', '90%'], []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const loadMissions = useCallback(async () => {
    try {
      setError(null);
      const response = await api.requests.list();
      const raw: any[] = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];

      const list: Mission[] = raw.map((r: any) => ({
        id:          String(r.id),
        title:       r.serviceType || r.title || 'Mission',
        serviceType: r.serviceType,
        description: r.description || '',
        price:       r.price || 0,
        status:      r.status as MissionStatus,
        address:     r.address,
        location:    r.address ? { address: r.address, lat: r.lat, lng: r.lng } : undefined,
        lat:         r.lat,
        lng:         r.lng,
        client:      r.client ? { name: r.client.name || '', phone: r.client.phone } : undefined,
        createdAt:   r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
      }));

      setMissions(list);
    } catch (e: any) {
      console.error('Missions load error:', e);
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadMissions(); }, [loadMissions]);
  const onRefresh = () => { setRefreshing(true); loadMissions(); };

  // ── Filtered lists ────────────────────────────────────────────────────────
  const upcomingMissions = useMemo(() => missions.filter(m => UPCOMING_STATUSES.includes(m.status)), [missions]);
  const historyMissions  = useMemo(() => missions.filter(m => HISTORY_STATUSES.includes(m.status)),  [missions]);

  const historyFilterOptions = useMemo(() => {
    const months = new Set(historyMissions.map(m => formatMonthKey(m.createdAt)));
    return [{ key: 'all', label: 'Tous' }, ...Array.from(months).map(m => ({ key: m, label: m }))];
  }, [historyMissions]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return historyMissions;
    return historyMissions.filter(m => formatMonthKey(m.createdAt) === historyFilter);
  }, [historyMissions, historyFilter]);

  const displayedList = useMemo(() => {
    let base = tab === 'upcoming' ? upcomingMissions : filteredHistory;

    // Filtre par jour sélectionné
    if (selectedDay && tab === 'upcoming') {
      base = base.filter(m => {
        const d = m.scheduledAt || m.createdAt;
        return d && new Date(d).toISOString().split('T')[0] === selectedDay;
      });
    }

    // Recherche texte
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleMissionPress = async (missionId: string) => {
    setLoadingDetails(true);
    bottomSheetRef.current?.expand();
    try {
      const raw = await api.get(`/requests/${missionId}`);
      const r   = raw?.data || raw;
      setSelectedMission({
        id:          String(r.id),
        title:       r.serviceType || r.title || 'Mission',
        serviceType: r.serviceType,
        description: r.description || '',
        price:       r.price || 0,
        status:      r.status,
        address:     r.address,
        location:    r.address ? { address: r.address, lat: r.lat, lng: r.lng } : undefined,
        lat:         r.lat,
        lng:         r.lng,
        client:      r.client ? { name: r.client.name || '', phone: r.client.phone } : undefined,
        createdAt:   r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
      });
    } catch { console.error('Error loading mission details'); }
    finally   { setLoadingDetails(false); }
  };

  const handleNavigate = (mission: Mission) => {
    const lat = mission.lat || mission.location?.lat;
    const lng = mission.lng || mission.location?.lng;
    if (!lat || !lng) return; // Coordonnées absentes — silencieux
    const url = Platform.select({
      ios:     `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
    });
    if (url) Linking.openURL(url);
  };

  // handleComplete — plus d'Alert, on ouvre le ConfirmModal
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
      const earnings = response.earnings ?? (mission.price * NET_RATE);
      console.log(`[Missions] Mission ${mission.id} terminée. Gains: ${formatEuros(earnings)}`);
      await loadMissions();
      router.push({ pathname: '/request/[id]/earnings', params: { id: mission.id } });
    } catch (error: any) {
      if (error?.data?.code === 'INVALID_STATE' || error?.status === 400) {
        await loadMissions();
        console.warn('[Missions] Statut mission déjà changé — rechargement');
      } else {
        console.error('[Missions] Impossible de terminer:', error?.message);
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

  const renderMission = useCallback(({ item }: { item: Mission }) => (
    <MissionCard
      mission={item}
      onPress={() => handleMissionPress(item.id)}
      onNavigate={() => handleNavigate(item)}
      onComplete={() => handleComplete(item)}
    />
  ), [handleComplete]);

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color="#1A1A1A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headerTitle}>Missions</Text>
            {upcomingMissions.length > 0 && (
              <Text style={s.headerSub}>
                {upcomingMissions.length} mission{upcomingMissions.length > 1 ? 's' : ''} à venir
              </Text>
            )}
          </View>
          {!searchActive && (
            <TouchableOpacity
              style={s.searchIconBtn}
              onPress={() => setSearchActive(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={20} color="#1A1A1A" />
            </TouchableOpacity>
          )}
        </View>

        {searchActive && (
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={15} color="#ADADAD" style={{ marginLeft: 12 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Rechercher une mission..."
              placeholderTextColor="#ADADAD"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onBlur={() => { if (!searchQuery) setSearchActive(false); }}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingHorizontal: 10 }}>
                <Ionicons name="close-circle" size={16} color="#ADADAD" />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── Tabs ── */}
      <TabBar tab={tab} onChange={setTab} upcomingCount={upcomingMissions.length} />

      {/* ── DayPicker (uniquement À venir) ── */}
      {tab === 'upcoming' && (
        <DayPicker selected={selectedDay} onSelect={setSelectedDay} />
      )}

      {/* ── Bandeau CA journalier ── */}
      {tab === 'upcoming' && (
        <EarningsBanner missions={missions} />
      )}

      {/* ── Filtres Historique ── */}
      {tab === 'history' && historyFilterOptions.length > 1 && (
        <FilterBar options={historyFilterOptions} selected={historyFilter} onSelect={setHistoryFilter} />
      )}

      {/* ── Erreur ── */}
      {error && (
        <View style={s.errorBanner}>
          <Ionicons name="alert-circle-outline" size={15} color="#1A1A1A" />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadMissions}>
            <Text style={s.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Liste ── */}
      <FlatList
        data={displayedList}
        renderItem={renderMission}
        keyExtractor={item => item.id}
        contentContainerStyle={[s.list, !displayedList.length && s.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A1A1A" />}
        ListEmptyComponent={
          <EmptyState tab={tab} onGoOnline={() => router.replace('/(tabs)/dashboard')} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Bottom Sheet Detail ── */}
      <BottomSheet ref={bottomSheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backdropComponent={renderBackdrop}>
        {loadingDetails ? (
          <ActivityIndicator size="large" color="#1A1A1A" style={{ marginTop: 60 }} />
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
              router.push({ pathname: '/request/[id]/ongoing', params: { id: selectedMission.id } });
            }}
          />
        ) : null}
      </BottomSheet>

      {/* ── Modal confirmation "Terminer" ── */}
      <ConfirmModal
        visible={!!completeModal}
        title="Terminer la mission ?"
        message={completeModal ? `Confirmer la fin de "${completeModal.title}" ?` : undefined}
        confirmLabel="Terminer"
        cancelLabel="Pas encore"
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
  root:   { flex: 1, backgroundColor: '#F8F8F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F8' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: '#FFF', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.5 },
  headerSub:   { fontSize: 13, color: '#ADADAD', fontWeight: '500', marginTop: 2 },
  searchIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  searchBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 14, height: 44, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#1A1A1A', paddingHorizontal: 10, height: 44 },

  list:      { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32 },
  listEmpty: { flex: 1 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F5F5F5', marginHorizontal: 16, marginBottom: 4, borderRadius: 12, padding: 12 },
  errorText:   { flex: 1, fontSize: 13, color: '#1A1A1A', fontWeight: '500' },
  retryText:   { fontSize: 13, fontWeight: '700', color: '#1A1A1A' },
});