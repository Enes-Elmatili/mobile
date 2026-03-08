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
import { useAppTheme } from '@/hooks/use-app-theme';


const { width } = Dimensions.get('window');
const NET_RATE = 0.85;

// ─── Grayscale map style ──────────────────────────────────────────────────────
const LIGHT_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#F0F0F0' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F5F5F5' }] },
  { featureType: 'landscape',          elementType: 'geometry',         stylers: [{ color: '#F8F9FB' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',         stylers: [{ color: '#EFEFEF' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',  stylers: [{ color: '#E8E8E8' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#ADADAD' }] },
  { featureType: 'road.arterial',      elementType: 'geometry',         stylers: [{ color: '#F5F5F5' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#EBEBEB' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',  stylers: [{ color: '#DEDEDE' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#999999' }] },
  { featureType: 'road.local',         elementType: 'geometry',         stylers: [{ color: '#FAFAFA' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#D1D5DB' }] },
  { featureType: 'water',              elementType: 'labels.text.fill', stylers: [{ color: '#ADADAD' }] },
  { featureType: 'administrative',     elementType: 'geometry',         stylers: [{ color: '#E0E0E0' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',  stylers: [{ visibility: 'off' }] },
];

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#666666' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#111111' }] },
  { featureType: 'landscape',          elementType: 'geometry',         stylers: [{ color: '#151515' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry',         stylers: [{ color: '#1C1C1C' }] },
  { featureType: 'road',               elementType: 'geometry',         stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road',               elementType: 'geometry.stroke',  stylers: [{ color: '#222222' }] },
  { featureType: 'road',               elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road.arterial',      elementType: 'geometry',         stylers: [{ color: '#282828' }] },
  { featureType: 'road.highway',       elementType: 'geometry',         stylers: [{ color: '#333333' }] },
  { featureType: 'road.highway',       elementType: 'geometry.stroke',  stylers: [{ color: '#2A2A2A' }] },
  { featureType: 'road.highway',       elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
  { featureType: 'road.local',         elementType: 'geometry',         stylers: [{ color: '#232323' }] },
  { featureType: 'water',              elementType: 'geometry',         stylers: [{ color: '#0E0E0E' }] },
  { featureType: 'water',              elementType: 'labels.text.fill', stylers: [{ color: '#444444' }] },
  { featureType: 'administrative',     elementType: 'geometry',         stylers: [{ color: '#222222' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',  stylers: [{ visibility: 'off' }] },
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
  const t = useAppTheme();
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
      <Animated.View style={[cm.sheet, { backgroundColor: t.cardBg }, { transform: [{ translateY: slideAnim }] }]}>
        <View style={[cm.handle, { backgroundColor: t.border }]} />
        <Text style={[cm.title, { color: t.text }]}>{title}</Text>
        {message ? <Text style={[cm.message, { color: t.textSub }]}>{message}</Text> : null}
        <View style={cm.actions}>
          <TouchableOpacity style={[cm.cancelBtn, { borderColor: t.border }]} onPress={onCancel} activeOpacity={0.75}>
            <Text style={[cm.cancelLabel, { color: t.textSub }]}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: t.accent }]} onPress={onConfirm} activeOpacity={0.75}>
            <Text style={[cm.confirmLabel, { color: t.accentText }]}>{confirmLabel}</Text>
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
  const t = useAppTheme();
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
        <Text style={[dp.chipLabel, { color: t.textSub }, selected === null && [dp.chipLabelSelected, { color: t.accentText }]]}>Tous</Text>
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
            <Text style={[dp.dayName, { color: t.textMuted }, active && dp.dayNameSelected]}>{day.dayName}</Text>
            <Text style={[dp.dayNum, { color: t.text }, active && dp.dayNumSelected]}>{day.dayNum}</Text>
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
  const t = useAppTheme();
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
    <View style={[eb.wrap, { backgroundColor: t.surface }]}>
      <View style={eb.left}>
        <Ionicons name="flash-outline" size={14} color={t.textSub} />
        <Text style={[eb.text, { color: t.textSub }]}>
          {todayMs.length > 0
            ? `${todayMs.length} mission${todayMs.length > 1 ? 's' : ''} aujourd'hui`
            : 'Journée complétée'}
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
    backgroundColor: '#F5F5F5', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  left:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  text:     { fontSize: 13, fontWeight: '600', color: '#555' },
  earnings: { fontSize: 14, fontWeight: '800', color: '#1A1A1A' },
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
  const t = useAppTheme();
  const cfg      = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const net      = mission.price * NET_RATE;
  const dateStr  = mission.scheduledAt || mission.createdAt;
  const time     = formatTime(dateStr);
  const address  = mission.location?.address || mission.address || 'Adresse inconnue';
  const isActive = cfg.active ?? false;
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = isActive && !!(mission.lat || mission.location?.lat);

  // Badge monochrome
  const badgeBg    = cfg.done ? t.surface : isActive ? t.accent : t.surface;
  const badgeColor = cfg.done ? t.textSub : isActive ? t.accentText : t.textMuted;

  return (
    <TouchableOpacity style={[mc.card, { backgroundColor: t.cardBg }, isActive && [mc.cardActive, { borderColor: t.accent }]]} onPress={onPress} activeOpacity={0.78}>

      {/* Barre temporelle à gauche */}
      <View style={mc.timeCol}>
        {time ? (
          <>
            <Text style={[mc.timeText, { color: t.textMuted }, isActive && [mc.timeTextActive, { color: t.text }]]}>{time}</Text>
            <View style={[mc.timeLine, { backgroundColor: t.border }, isActive && [mc.timeLineActive, { backgroundColor: t.accent }]]} />
          </>
        ) : (
          <View style={[mc.timeDot, { backgroundColor: t.border }, isActive && [mc.timeDotActive, { backgroundColor: t.accent }]]} />
        )}
      </View>

      {/* Contenu principal */}
      <View style={mc.body}>
        <View style={mc.topRow}>
          <View style={mc.info}>
            <Text style={[mc.title, { color: t.text }]} numberOfLines={1}>{mission.title}</Text>
            {mission.client?.name && (
              <Text style={[mc.client, { color: t.textSub }]} numberOfLines={1}>{mission.client.name}</Text>
            )}
            <View style={mc.addrRow}>
              <Ionicons name="location-outline" size={11} color={t.textMuted} />
              <Text style={[mc.addr, { color: t.textMuted }]} numberOfLines={1}>{address}</Text>
            </View>
          </View>

          {/* Gains à droite — vert uniquement */}
          <View style={mc.earningsCol}>
            <Text style={[mc.earningsNet, { color: t.text }]}>+{formatEuros(net)}</Text>
            <Text style={[mc.earningsLabel, { color: t.textMuted }]}>net</Text>
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
              <TouchableOpacity style={[mc.quickBtn, { backgroundColor: t.surface }]} onPress={onNavigate} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={15} color={t.text} />
              </TouchableOpacity>
            )}
            {canComplete && (
              <TouchableOpacity style={[mc.quickBtn, mc.quickBtnComplete, { backgroundColor: t.surface }]} onPress={onComplete} activeOpacity={0.8}>
                <Ionicons name="checkmark" size={15} color={t.text} />
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
  earningsNet:   { fontSize: 18, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.4 },
  earningsLabel: { fontSize: 10, color: '#ADADAD', fontWeight: '600' },

  // Footer
  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  quickActions:{ flexDirection: 'row', gap: 6 },
  quickBtn:    { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  quickBtnComplete: { backgroundColor: '#F5F5F5' },
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
            style={[fb.chip, { backgroundColor: t.surface }, active && [fb.chipActive, { backgroundColor: t.accent }]]}
            onPress={() => onSelect(item.key)}
            activeOpacity={0.8}
          >
            <Text numberOfLines={1} style={[fb.chipText, { color: t.textSub }, active && [fb.chipTextActive, { color: t.accentText }]]}>
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

function EmptyState({ tab, onGoOnline, dayEarnings }: { tab: Tab; onGoOnline: () => void; dayEarnings?: number }) {
  const t = useAppTheme();
  if (tab === 'history') {
    return (
      <View style={es.wrap}>
        <Ionicons name="time-outline" size={40} color={t.textMuted} />
        <Text style={[es.title, { color: t.text }]}>Aucun historique</Text>
        <Text style={[es.sub, { color: t.textMuted }]}>Vos missions terminées apparaîtront ici.</Text>
      </View>
    );
  }

  // Journée complétée — célébration au lieu d'un empty state générique
  if (dayEarnings && dayEarnings > 0) {
    return (
      <View style={es.wrap}>
        <View style={[es.checkCircle, { backgroundColor: t.accent }]}>
          <Ionicons name="checkmark" size={32} color={t.accentText} />
        </View>
        <Text style={[es.heroAmount, { color: t.text }]}>+{formatEuros(dayEarnings)}</Text>
        <Text style={[es.title, { color: t.text }]}>Journée complétée</Text>
        <Text style={[es.sub, { color: t.textMuted }]}>Excellent travail. Vos gains sont en cours de traitement.</Text>
      </View>
    );
  }

  return (
    <View style={es.wrap}>
      <View style={[es.iconWrap, { backgroundColor: t.surface }]}>
        <Ionicons name="navigate-circle-outline" size={44} color={t.textMuted} />
      </View>
      <Text style={[es.title, { color: t.text }]}>Aucune mission à venir</Text>
      <Text style={[es.sub, { color: t.textMuted }]}>Passez en ligne pour commencer à recevoir des missions.</Text>
      <TouchableOpacity style={[es.cta, { backgroundColor: t.accent }]} onPress={onGoOnline} activeOpacity={0.85}>
        <View style={[es.ctaDot, { backgroundColor: t.accentText }]} />
        <Text style={[es.ctaText, { color: t.accentText }]}>Passer en ligne</Text>
        <Ionicons name="arrow-forward" size={16} color={t.accentText} />
      </TouchableOpacity>
    </View>
  );
}

const es = StyleSheet.create({
  wrap:    { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 80, gap: 12 },
  iconWrap:{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center' },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1A1A1A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  heroAmount: { fontSize: 36, fontWeight: '900', color: '#1A1A1A', letterSpacing: -1.5 },
  title:   { fontSize: 17, fontWeight: '800', color: '#1A1A1A', textAlign: 'center' },
  sub:     { fontSize: 14, color: '#ADADAD', textAlign: 'center', lineHeight: 20 },
  cta:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1A1A1A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, marginTop: 8 },
  ctaDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
});

// ============================================================================
// CLIENT AVATAR
// ============================================================================

function ClientAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const t = useAppTheme();
  const initials = name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={[cav.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accent }]}>
      <Text style={[cav.text, { fontSize: size * 0.34, color: t.accentText }]}>{initials}</Text>
    </View>
  );
}
const cav = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text:   { fontWeight: '800', letterSpacing: 0.5 },
});

// ============================================================================
// TAB BAR
// ============================================================================

function TabBar({ tab, onChange, upcomingCount }: {
  tab: Tab; onChange: (t: Tab) => void; upcomingCount: number;
}) {
  const t = useAppTheme();
  const indicatorX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(indicatorX, { toValue: tab === 'upcoming' ? 0 : 1, tension: 220, friction: 22, useNativeDriver: false }).start();
  }, [tab]);

  const indicatorLeft = indicatorX.interpolate({ inputRange: [0, 1], outputRange: ['0%', '50%'] });

  return (
    <View style={[tb.wrap, { backgroundColor: t.surface }]}>
      <Animated.View style={[tb.indicator, { backgroundColor: t.cardBg }, { left: indicatorLeft }]} />
      {(['upcoming', 'history'] as Tab[]).map(tb2 => (
        <TouchableOpacity key={tb2} style={tb.tab} onPress={() => onChange(tb2)} activeOpacity={0.75}>
          <Text style={[tb.label, { color: t.textMuted }, tab === tb2 && [tb.labelActive, { color: t.text }]]}>
            {tb2 === 'upcoming' ? 'À venir' : 'Historique'}
          </Text>
          {tb2 === 'upcoming' && upcomingCount > 0 && (
            <View style={[tb.badge, { backgroundColor: t.accent }]}>
              <Text style={[tb.badgeText, { color: t.accentText }]}>{upcomingCount}</Text>
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
  const t = useAppTheme();
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

  const badgeBg    = cfg.done ? t.surface : cfg.active ? t.accent : t.surface;
  const badgeColor = cfg.done ? t.textSub : cfg.active ? t.accentText : t.textMuted;

  return (
    <BottomSheetScrollView contentContainerStyle={sd.scroll} showsVerticalScrollIndicator={false}>
      {/* ── Mini-carte Silver ── */}
      {hasCoords ? (
        <View style={sd.mapContainer}>
          <MapView
            provider={PROVIDER_DEFAULT}
            customMapStyle={t.isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
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
              <Ionicons name="location-outline" size={11} color={t.textSub} />
              <Text style={[sd.mapAddrText, { color: t.text }]} numberOfLines={1}>{address}</Text>
            </View>
          </View>
          {/* Badge statut flottant — monochrome */}
          <View style={[sd.mapStatusPill, { backgroundColor: badgeBg }]}>
            <Ionicons name={cfg.icon as any} size={10} color={badgeColor} />
            <Text style={[sd.mapStatusText, { color: badgeColor }]}>{cfg.label}</Text>
          </View>
        </View>
      ) : (
        <View style={[sd.mapFallback, { backgroundColor: t.surface }]}>
          <Ionicons name="map-outline" size={24} color={t.textMuted} />
          <Text style={[sd.mapFallbackText, { color: t.textMuted }]}>{address || 'Adresse non disponible'}</Text>
        </View>
      )}

      <View style={sd.body}>
        {/* Titre */}
        <View style={sd.titleRow}>
          <Text style={[sd.title, { color: t.text }]}>{mission.title}</Text>
          {mission.client?.name && (
            <View style={sd.clientRow}>
              <ClientAvatar name={mission.client.name} size={24} />
              <Text style={[sd.clientName, { color: t.textSub }]}>{mission.client.name}</Text>
            </View>
          )}
        </View>

        {/* Gains */}
        <View style={[sd.earningsBlock, { backgroundColor: t.surfaceAlt }]}>
          <View>
            <Text style={[sd.earningsLabel, { color: t.textMuted }]}>Gain net</Text>
            {mission.price > 0 ? (
              <Text style={[sd.earningsNet, { color: t.text }]}>{formatEuros(net)}</Text>
            ) : (
              <Text style={[sd.earningsZero, { color: t.textMuted }]}>Prix à confirmer</Text>
            )}
          </View>
          <View style={[sd.earningsDivider, { backgroundColor: t.border }]} />
          <View>
            <Text style={[sd.earningsLabel, { color: t.textMuted }]}>Brut client</Text>
            {mission.price > 0 ? (
              <Text style={[sd.earningsGross, { color: t.textMuted }]}>{formatEuros(mission.price)}</Text>
            ) : (
              <Text style={[sd.earningsZero, { color: t.textMuted }]}>—</Text>
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={[sd.sep, { backgroundColor: t.border }]} />

        {/* Chronologie */}
        {(createdAt || scheduledAt) && (
          <>
            <Text style={[sd.sectionLabel, { color: t.textMuted }]}>Chronologie</Text>
            {createdAt && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Ionicons name="ellipse" size={10} color={t.text} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>Commande passée · {fmtD(createdAt)} · {fmtT(createdAt)}</Text>
                </View>
              </View>
            )}
            {cfg.active && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Ionicons name="ellipse" size={10} color={t.text} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>Confirmée</Text>
                </View>
              </View>
            )}
            {scheduledAt && (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Ionicons name="ellipse" size={10} color={t.textMuted} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>Départ prévu · {fmtD(scheduledAt)} · {fmtT(scheduledAt)}</Text>
                </View>
              </View>
            )}
            <View style={sd.infoRow}>
              <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Ionicons name="ellipse" size={10} color={t.textMuted} /></View>
              <View style={sd.infoContent}>
                <Text style={[sd.infoValue, { color: t.textMuted }]}>Terminée</Text>
              </View>
            </View>
            <View style={[sd.sep, { backgroundColor: t.border }]} />
          </>
        )}

        {/* Adresse + description */}
        {(address || mission.description) && (
          <>
            <Text style={[sd.sectionLabel, { color: t.textMuted }]}>Détails mission</Text>
            {address ? (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Ionicons name="location-outline" size={12} color={t.textMuted} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{address}</Text>
                </View>
              </View>
            ) : null}
            {mission.description ? (
              <View style={sd.infoRow}>
                <View style={[sd.infoIcon, { backgroundColor: t.surface }]}><Ionicons name="document-text-outline" size={12} color={t.textMuted} /></View>
                <View style={sd.infoContent}>
                  <Text style={[sd.infoValue, { color: t.text }]}>{mission.description}</Text>
                </View>
              </View>
            ) : null}
            <View style={[sd.sep, { backgroundColor: t.border }]} />
          </>
        )}

        {/* Client card */}
        {mission.client && (
          <>
            <Text style={[sd.sectionLabel, { color: t.textMuted }]}>Client</Text>
            <View style={sd.clientCard}>
              <ClientAvatar name={mission.client.name} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[sd.clientCardName, { color: t.text }]}>{mission.client.name}</Text>
              </View>
              {mission.client.phone && (
                <TouchableOpacity
                  style={[sd.callBtn, { backgroundColor: t.accent }]}
                  onPress={() => Linking.openURL(`tel:${mission.client!.phone}`)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="call" size={16} color={t.accentText} />
                </TouchableOpacity>
              )}
            </View>
            <View style={[sd.sep, { backgroundColor: t.border }]} />
          </>
        )}

      </View>
        {/* ── CTA ── */}
        {(canNavigate || canComplete) && (
          <View style={sd.actionsBlock}>
            {canNavigate && (
              <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onNavigate} activeOpacity={0.85}>
                <Ionicons name="navigate" size={18} color={t.accentText} />
                <Text style={[sd.navBtnText, { color: t.accentText }]}>S'y rendre (GPS)</Text>
              </TouchableOpacity>
            )}
            {canComplete && (
              <TouchableOpacity style={[sd.completeBtn, { backgroundColor: t.accent }]} onPress={onComplete} activeOpacity={0.85}>
                <Ionicons name="checkmark-circle" size={18} color={t.accentText} />
                <Text style={[sd.completeBtnText, { color: t.accentText }]}>Terminer la mission</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

    </BottomSheetScrollView>
  );
}

const sd = StyleSheet.create({
  scroll: { paddingBottom: 80 },
  // Map
  mapContainer: { height: 150, marginTop: 8, overflow: 'hidden', position: 'relative' },
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
  body: { paddingHorizontal: 20, paddingTop: 14 },
  titleRow: { marginBottom: 12, gap: 6 },
  title:    { fontSize: 22, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.4 },
  clientRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientName:{ fontSize: 13, color: '#888', fontWeight: '600' },

  // Gains
  earningsBlock:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderRadius: 16, padding: 14, marginBottom: 12 },
  earningsLabel:  { fontSize: 11, color: '#ADADAD', fontWeight: '600', marginBottom: 3 },
  earningsNet:    { fontSize: 28, fontWeight: '900', color: '#1A1A1A', letterSpacing: -0.8 },
  earningsZero:   { fontSize: 16, fontWeight: '600', color: '#888888', fontStyle: 'italic' },
  earningsDivider:{ width: StyleSheet.hairlineWidth, height: 44, backgroundColor: '#E0E0E0', marginHorizontal: 20 },
  earningsGross:  { fontSize: 16, fontWeight: '600', color: '#ADADAD' },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F0', marginVertical: 10 },

  // Info rows
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
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
  actionsBlock: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 10,
  },
  navBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A1A1A', borderRadius: 16, paddingVertical: 15 },
  navBtnText:     { fontSize: 15, fontWeight: '700', color: '#FFF' },
  completeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1A1A1A', borderRadius: 16, paddingVertical: 15 },
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
  const t = useAppTheme();

  // Modals
  const [completeModal, setCompleteModal] = useState<Mission | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints     = useMemo(() => ['70%', '92%'], []);

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

  // Gains du jour (missions DONE aujourd'hui) — pour le empty state célébration
  const todayDoneEarnings = useMemo(() => {
    const today = new Date();
    return missions
      .filter(m => {
        const d = m.scheduledAt || m.createdAt;
        return m.status === 'DONE' && d && isSameDay(new Date(d), today);
      })
      .reduce((acc, m) => acc + m.price * NET_RATE, 0);
  }, [missions]);

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
      <SafeAreaView style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.bg }]}>

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={[s.headerTitle, { color: t.text }]}>Missions</Text>
            {upcomingMissions.length > 0 && (
              <Text style={[s.headerSub, { color: t.textMuted }]}>
                {upcomingMissions.length} mission{upcomingMissions.length > 1 ? 's' : ''} à venir
              </Text>
            )}
          </View>
          {!searchActive && (
            <TouchableOpacity
              style={[s.searchIconBtn, { backgroundColor: t.surface }]}
              onPress={() => setSearchActive(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="search-outline" size={20} color={t.text} />
            </TouchableOpacity>
          )}
        </View>

        {searchActive && (
          <View style={[s.searchBar, { backgroundColor: t.surface }]}>
            <Ionicons name="search-outline" size={15} color={t.textMuted} style={{ marginLeft: 12 }} />
            <TextInput
              style={[s.searchInput, { color: t.text }]}
              placeholder="Rechercher une mission..."
              placeholderTextColor={t.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onBlur={() => { if (!searchQuery) setSearchActive(false); }}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ paddingHorizontal: 10 }}>
                <Ionicons name="close-circle" size={16} color={t.textMuted} />
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
        <View style={[s.errorBanner, { backgroundColor: t.surface }]}>
          <Ionicons name="alert-circle-outline" size={15} color={t.text} />
          <Text style={[s.errorText, { color: t.text }]}>{error}</Text>
          <TouchableOpacity onPress={loadMissions}>
            <Text style={[s.retryText, { color: t.text }]}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Liste ── */}
      <FlatList
        data={displayedList}
        renderItem={renderMission}
        keyExtractor={item => item.id}
        contentContainerStyle={[s.list, !displayedList.length && s.listEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
        ListEmptyComponent={
          <EmptyState tab={tab} onGoOnline={() => router.replace('/(tabs)/dashboard')} dayEarnings={tab === 'upcoming' ? todayDoneEarnings : undefined} />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── Bottom Sheet Detail ── */}
      <BottomSheet ref={bottomSheetRef} index={-1} snapPoints={snapPoints} enablePanDownToClose backdropComponent={renderBackdrop} backgroundStyle={{ backgroundColor: t.cardBg }} handleIndicatorStyle={{ backgroundColor: t.border }}>
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
  root:   { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },

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