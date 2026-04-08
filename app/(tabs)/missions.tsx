// app/(tabs)/missions.tsx — Provider Mission Hub
// --- Design FIXED : Dark mode support, FONTS/COLORS from design system ---

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, SafeAreaView,
  Animated, Dimensions, Linking, Platform,
  TextInput, ScrollView, Modal, Pressable, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { devLog, devWarn, devError } from '@/lib/logger';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useSocket } from '@/lib/SocketContext';
import { useCall } from '@/lib/webrtc/CallContext';
import * as Haptics from 'expo-haptics';


const { width } = Dimensions.get('window');
const NET_RATE = 0.80;

// --- Grayscale map style ---
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
  category: { id: number; name: string; icon: string | null };
  subcategory: { id: number; name: string } | null;
  client: { name: string };
}

function formatScheduledDate(iso: string): { day: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const day = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  let relative = '';
  if (diffDays === 0) relative = "Aujourd'hui";
  else if (diffDays === 1) relative = 'Demain';
  else if (diffDays <= 7) relative = `Dans ${diffDays} jours`;
  else relative = `Dans ${Math.ceil(diffDays / 7)} sem.`;

  return { day, time, relative };
}

// ============================================================================
// UTILS
// ============================================================================

const formatEuros = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

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

const STATUS_CFG: Record<MissionStatus, { label: string; icon: string; active?: boolean; done?: boolean }> = {
  PUBLISHED:       { label: 'Publie',            icon: 'radio-outline',            active: true },
  ACCEPTED:        { label: 'Confirme',          icon: 'checkmark-circle-outline', active: true },
  ONGOING:         { label: 'En cours',          icon: 'flash-outline',            active: true },
  DONE:            { label: 'Terminé',           icon: 'checkmark-done-outline',   done: true },
  CANCELLED:       { label: 'Annulé',            icon: 'close-circle-outline' },
  PENDING_PAYMENT: { label: 'Paiement',          icon: 'card-outline' },
  EXPIRED:         { label: 'Expiré',            icon: 'time-outline' },
  QUOTE_PENDING:   { label: 'Devis à envoyer',   icon: 'document-text-outline',    active: true },
  QUOTE_SENT:      { label: 'Devis envoyé',      icon: 'checkmark-circle-outline' },
  QUOTE_ACCEPTED:  { label: 'Devis accepté',     icon: 'checkmark-done-outline',   active: true },
};

const SERVICE_ICONS: Record<string, string> = {
  serrurerie: 'lock-closed-outline',
  plomberie: 'water-outline',
  'entretien chaudiere': 'flame-outline',
  electricite: 'flash-outline',
  bricolage: 'hammer-outline',
  peinture: 'brush-outline',
  menage: 'home-outline',
  'depannage informatique': 'laptop-outline',
  vitrier: 'grid-outline',
  'pet sitting': 'paw-outline',
};

const getServiceIcon = (type?: string): string => {
  if (!type) return 'construct-outline';
  const key = type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const match = Object.keys(SERVICE_ICONS).find(k => key.includes(k));
  return match ? SERVICE_ICONS[match] : 'construct-outline';
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
      <Animated.View style={[cm.sheet, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity > 0.1 ? t.shadowOpacity : 0.14 }, { transform: [{ translateY: slideAnim }] }]}>
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
  dayNum:          { fontSize: 18, fontFamily: FONTS.bebas },
});

// ============================================================================
// EARNINGS BANNER
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
            : 'Journee completee'}
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
// MISSION CARD
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

  const badgeBg    = cfg.done ? t.surface : isActive ? t.accent : t.surface;
  const badgeColor = cfg.done ? t.textSub : isActive ? t.accentText : t.textMuted;

  return (
    <TouchableOpacity style={[mc.card, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity }, isActive && [mc.cardActive, { borderColor: t.accent }]]} onPress={onPress} activeOpacity={0.78}>

      {/* Barre temporelle a gauche */}
      <View style={mc.timeCol}>
        {time ? (
          <>
            <Text style={[mc.timeText, { color: t.textMuted }, isActive && { color: t.text }]}>{time}</Text>
            <View style={[mc.timeLine, { backgroundColor: t.border }, isActive && { backgroundColor: t.accent }]} />
          </>
        ) : (
          <View style={[mc.timeDot, { backgroundColor: t.border }, isActive && { backgroundColor: t.accent }]} />
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

          {/* Gains a droite */}
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
              <TouchableOpacity style={[mc.quickBtn, { backgroundColor: t.surface }]} onPress={onComplete} activeOpacity={0.8}>
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
    borderRadius: 18, marginBottom: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 2 },
    }),
  },
  cardActive: { borderWidth: 1.5 },

  timeCol:       { width: 56, alignItems: 'center', paddingTop: 16, paddingBottom: 12, gap: 4 },
  timeText:      { fontSize: 12, fontFamily: FONTS.mono },
  timeLine:      { flex: 1, width: 2, borderRadius: 1 },
  timeDot:       { width: 8, height: 8, borderRadius: 4 },

  body:   { flex: 1, paddingRight: 14, paddingTop: 14, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  info:   { flex: 1, gap: 3 },
  title:  { fontSize: 15, fontFamily: FONTS.sansMedium },
  client: { fontSize: 12, fontFamily: FONTS.sans },
  addrRow:{ flexDirection: 'row', alignItems: 'center', gap: 3 },
  addr:   { fontSize: 11, fontFamily: FONTS.sans, flex: 1 },

  earningsCol:   { alignItems: 'flex-end', paddingLeft: 10 },
  earningsNet:   { fontSize: 18, fontFamily: FONTS.bebas, letterSpacing: -0.4 },
  earningsLabel: { fontSize: 10, fontFamily: FONTS.mono },

  footer:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText:   { fontSize: 11, fontFamily: FONTS.sansMedium },
  quickActions:{ flexDirection: 'row', gap: 6 },
  quickBtn:    { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
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
  if (tab === 'history') {
    return (
      <View style={es.wrap}>
        <Ionicons name="time-outline" size={40} color={t.textMuted} />
        <Text style={[es.title, { color: t.text }]}>Aucun historique</Text>
        <Text style={[es.sub, { color: t.textMuted }]}>Vos missions terminees apparaitront ici.</Text>
      </View>
    );
  }

  if (dayEarnings && dayEarnings > 0) {
    return (
      <View style={es.wrap}>
        <View style={[es.checkCircle, { backgroundColor: t.accent }]}>
          <Ionicons name="checkmark" size={32} color={t.accentText} />
        </View>
        <Text style={[es.heroAmount, { color: t.text }]}>+{formatEuros(dayEarnings)}</Text>
        <Text style={[es.title, { color: t.text }]}>Journee completee</Text>
        <Text style={[es.sub, { color: t.textMuted }]}>Excellent travail. Vos gains sont en cours de traitement.</Text>
      </View>
    );
  }

  return (
    <View style={es.wrap}>
      <View style={[es.iconWrap, { backgroundColor: t.surface }]}>
        <Ionicons name="navigate-circle-outline" size={44} color={t.textMuted} />
      </View>
      <Text style={[es.title, { color: t.text }]}>Aucune mission a venir</Text>
      <Text style={[es.sub, { color: t.textMuted }]}>Passez en ligne pour commencer a recevoir des missions.</Text>
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
  iconWrap:{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  checkCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  heroAmount: { fontSize: 36, fontFamily: FONTS.bebas, letterSpacing: -1.5 },
  title:   { fontSize: 17, fontFamily: FONTS.sansMedium, textAlign: 'center' },
  sub:     { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 20 },
  cta:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 20, marginTop: 8 },
  ctaDot:  { width: 8, height: 8, borderRadius: 4 },
  ctaText: { fontSize: 15, fontFamily: FONTS.sansMedium },
});

// ============================================================================
// OPPORTUNITY CARD
// ============================================================================

function OpportunityCard({
  item, theme, onAccept, onDecline, accepting,
}: {
  item: Opportunity; theme: ReturnType<typeof useAppTheme>;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  accepting: number | null;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const { day, time, relative } = formatScheduledDate(item.preferredTimeStart);
  const net = item.price ? (item.price * NET_RATE).toFixed(0) : null;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAccept(item.id);
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecline(item.id);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={[opp.card, { backgroundColor: theme.cardBg, borderColor: theme.border, shadowOpacity: theme.shadowOpacity }]}>
        <View style={opp.cardHead}>
          <View style={[opp.catBadge, { backgroundColor: theme.surface }]}>
            <Ionicons name={(item.category.icon || getServiceIcon(item.category.name)) as any} size={14} color={theme.text} />
            <Text style={[opp.catBadgeText, { color: theme.text }]}>{item.category.name}</Text>
          </View>
          <View style={[opp.relBadge, { backgroundColor: theme.surface }]}>
            <Text style={[opp.relText, { color: theme.textSub }]}>{relative}</Text>
          </View>
        </View>

        <Text style={[opp.serviceName, { color: theme.text }]} numberOfLines={1}>
          {item.serviceType}
        </Text>
        {item.description ? (
          <Text style={[opp.desc, { color: theme.textSub }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={opp.infoRow}>
          <View style={opp.infoItem}>
            <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
            <Text style={[opp.infoText, { color: theme.textSub }]}>{day} a {time}</Text>
          </View>
          <View style={opp.infoItem}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={[opp.infoText, { color: theme.textSub }]} numberOfLines={1}>
              {item.address.split(',')[0]}
            </Text>
          </View>
        </View>

        <View style={opp.cardFoot}>
          {net ? (
            <View>
              <Text style={[opp.priceNet, { color: theme.text }]}>{net} €</Text>
              <Text style={[opp.priceLabel, { color: theme.textMuted }]}>net estime</Text>
            </View>
          ) : (
            <View />
          )}
          <View style={opp.actionsRow}>
            <TouchableOpacity
              style={[opp.declineBtn, { borderColor: theme.border }]}
              onPress={handleDecline}
              disabled={accepting !== null}
              activeOpacity={0.7}
              accessibilityLabel="Refuser"
            >
              <Ionicons name="close" size={18} color={theme.textSub} />
              <Text style={[opp.declineText, { color: theme.textSub }]}>Refuser</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[opp.acceptBtn, { backgroundColor: theme.accent }]}
              onPress={handlePress}
              disabled={accepting !== null}
              activeOpacity={0.8}
            >
              {accepting === item.id ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={theme.accentText} />
                  <Text style={[opp.acceptText, { color: theme.accentText }]}>Accepter</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const opp = StyleSheet.create({
  card: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  catBadgeText: { fontSize: 12, fontFamily: FONTS.sansMedium },
  relBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  relText: { fontSize: 11, fontFamily: FONTS.sansMedium },
  serviceName: { fontSize: 17, fontFamily: FONTS.sansMedium, marginBottom: 4 },
  desc: { fontSize: 13, fontFamily: FONTS.sans, lineHeight: 18, marginBottom: 10 },
  infoRow: { gap: 6, marginBottom: 14 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontFamily: FONTS.sans },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceNet: { fontSize: 20, fontFamily: FONTS.bebas },
  priceLabel: { fontSize: 11, fontFamily: FONTS.mono },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  declineBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  declineText: { fontSize: 14, fontFamily: FONTS.sansMedium },
  acceptBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  acceptText: { fontSize: 14, fontFamily: FONTS.sansMedium },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.sansMedium, marginTop: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: FONTS.sans, textAlign: 'center', lineHeight: 20 },
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
  text:   { fontFamily: FONTS.sansMedium, letterSpacing: 0.5 },
});

// ============================================================================
// TAB BAR
// ============================================================================

function TabBar({ tab, onChange, upcomingCount, opportunityCount }: {
  tab: Tab; onChange: (t: Tab) => void; upcomingCount: number; opportunityCount: number;
}) {
  const t = useAppTheme();
  const indicatorX = useRef(new Animated.Value(0)).current;

  const TAB_INDEX: Record<Tab, number> = { opportunities: 0, upcoming: 1, history: 2 };
  const TAB_LABELS: Record<Tab, string> = { opportunities: 'Opportunites', upcoming: 'A venir', history: 'Historique' };

  useEffect(() => {
    Animated.spring(indicatorX, { toValue: TAB_INDEX[tab], tension: 220, friction: 22, useNativeDriver: false }).start();
  }, [tab]);

  const indicatorLeft = indicatorX.interpolate({ inputRange: [0, 1, 2], outputRange: ['0%', '33.33%', '66.66%'] });

  return (
    <View style={[tb.wrap, { backgroundColor: t.surface }]}>
      <Animated.View style={[tb.indicator, tb.indicator3, { backgroundColor: t.cardBg, shadowOpacity: t.shadowOpacity }, { left: indicatorLeft }]} />
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

function MissionDetail({ mission, onNavigate, onComplete, onViewFull }: {
  mission: Mission; onNavigate: () => void; onComplete: () => void; onViewFull: () => void;
}) {
  const t = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { initiateCall } = useCall();
  const TAB_BAR_H = Platform.OS === 'ios' ? 70 : 54;
  const cfg         = STATUS_CFG[mission.status] ?? STATUS_CFG.PUBLISHED;
  const net         = mission.price * NET_RATE;
  const canComplete = mission.status === 'ONGOING';
  const canNavigate = !!(cfg.active) && !!(mission.lat || mission.location?.lat);
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
    <BottomSheetScrollView contentContainerStyle={[sd.scroll, { paddingBottom: TAB_BAR_H + insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
      {/* -- Mini-carte -- */}
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
          {/* Badge statut flottant */}
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
              <Text style={[sd.earningsZero, { color: t.textMuted }]}>Prix a confirmer</Text>
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
                  <Text style={[sd.infoValue, { color: t.text }]}>Commande passee · {fmtD(createdAt)} · {fmtT(createdAt)}</Text>
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
                  <Text style={[sd.infoValue, { color: t.text }]}>Depart prevu · {fmtD(scheduledAt)} · {fmtT(scheduledAt)}</Text>
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
            <Text style={[sd.sectionLabel, { color: t.textMuted }]}>Details mission</Text>
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
              {mission.client.id && (
                <TouchableOpacity
                  style={[sd.callBtn, { backgroundColor: t.surfaceAlt || t.surface }]}
                  onPress={() => {
                    router.push({
                      pathname: '/messages/[userId]',
                      params: {
                        userId: mission.client!.id!,
                        name: mission.client!.name,
                        requestId: String(mission.id),
                      },
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble" size={16} color={t.text} />
                </TouchableOpacity>
              )}
              {(mission.client.id || mission.client.phone) && (
                <TouchableOpacity
                  style={[sd.callBtn, { backgroundColor: t.accent }]}
                  onPress={() => {
                    if (mission.client?.id) {
                      initiateCall({
                        targetUserId: mission.client.id,
                        targetName: mission.client.name,
                        requestId: String(mission.id),
                      });
                    } else if (mission.client?.phone) {
                      Linking.openURL(`tel:${mission.client.phone}`);
                    }
                  }}
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
        {/* -- CTA -- */}
        {mission.status === 'QUOTE_PENDING' && (
          <View style={sd.actionsBlock}>
            <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
              <Ionicons name="document-text-outline" size={18} color={t.accentText} />
              <Text style={[sd.navBtnText, { color: t.accentText }]}>Envoyer un devis</Text>
            </TouchableOpacity>
          </View>
        )}
        {mission.status === 'QUOTE_SENT' && (
          <View style={[sd.actionsBlock, { opacity: 0.6 }]}>
            <View style={[sd.navBtn, { backgroundColor: t.surface, borderWidth: 1, borderColor: t.border }]}>
              <Ionicons name="time-outline" size={18} color={t.textMuted} />
              <Text style={[sd.navBtnText, { color: t.textMuted }]}>En attente de réponse du client</Text>
            </View>
          </View>
        )}
        {mission.status === 'QUOTE_ACCEPTED' && (
          <View style={sd.actionsBlock}>
            <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
              <Ionicons name="arrow-forward" size={18} color={t.accentText} />
              <Text style={[sd.navBtnText, { color: t.accentText }]}>Commencer la mission</Text>
            </TouchableOpacity>
          </View>
        )}
        {(canNavigate || canComplete || cfg.active) && !['QUOTE_PENDING', 'QUOTE_SENT', 'QUOTE_ACCEPTED'].includes(mission.status) && (
          <View style={sd.actionsBlock}>
            {cfg.active && (
              <TouchableOpacity style={[sd.navBtn, { backgroundColor: t.accent }]} onPress={onViewFull} activeOpacity={0.85}>
                <Ionicons name="arrow-forward" size={18} color={t.accentText} />
                <Text style={[sd.navBtnText, { color: t.accentText }]}>Reprendre la mission</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

    </BottomSheetScrollView>
  );
}

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
  titleRow: { marginBottom: 12, gap: 6 },
  title:    { fontSize: 22, fontFamily: FONTS.bebas, letterSpacing: -0.4 },
  clientRow:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  clientName:{ fontSize: 13, fontFamily: FONTS.sansMedium },

  earningsBlock:  { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14, marginBottom: 12 },
  earningsLabel:  { fontSize: 11, fontFamily: FONTS.mono, marginBottom: 3 },
  earningsNet:    { fontSize: 28, fontFamily: FONTS.bebas, letterSpacing: -0.8 },
  earningsZero:   { fontSize: 16, fontFamily: FONTS.sans, fontStyle: 'italic' },
  earningsDivider:{ width: StyleSheet.hairlineWidth, height: 44, marginHorizontal: 20 },
  earningsGross:  { fontSize: 16, fontFamily: FONTS.mono },

  sep: { height: StyleSheet.hairlineWidth, marginVertical: 10 },

  sectionLabel: { fontSize: 11, fontFamily: FONTS.sansMedium, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  infoRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  infoIcon:     { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  infoContent:  { flex: 1 },
  infoLabel:    { fontSize: 10, fontFamily: FONTS.sansMedium, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue:    { fontSize: 14, fontFamily: FONTS.sans, lineHeight: 20 },

  clientCard:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  clientCardName: { fontSize: 15, fontFamily: FONTS.sansMedium },
  clientCardPhone:{ fontSize: 13, fontFamily: FONTS.sans, marginTop: 2 },
  callBtn:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  actionsBlock: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4, gap: 10,
  },
  navBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15 },
  navBtnText:     { fontSize: 15, fontFamily: FONTS.sansMedium },
  completeBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingVertical: 15 },
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
  const [error,           setError]           = useState<string | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [loadingDetails,  setLoadingDetails]  = useState(false);
  const [tab,             setTab]             = useState<Tab>('opportunities');
  const [historyFilter,   setHistoryFilter]   = useState<string>('all');
  const [, setCompleting] = useState<string | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchActive,    setSearchActive]    = useState(false);
  const [selectedDay,     setSelectedDay]     = useState<string | null>(null);
  const t = useAppTheme();

  // Opportunity state
  const [opportunities,    setOpportunities]    = useState<Opportunity[]>([]);
  const [loadingOpps,      setLoadingOpps]      = useState(true);
  const [acceptingOpp,     setAcceptingOpp]     = useState<number | null>(null);

  // Modals
  const [completeModal, setCompleteModal] = useState<Mission | null>(null);

  const bottomSheetRef = useRef<BottomSheet>(null);

  // -- Data --
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
        client:      r.client ? { id: r.client.id, name: r.client.name || '', phone: r.client.phone } : undefined,
        createdAt:   r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
      }));

      setMissions(list);
    } catch (e: any) {
      devError('Missions load error:', e);
      setError('Erreur de chargement');
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
      setOpportunities(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e) {
      devError('Opportunities load error:', e);
    } finally {
      setLoadingOpps(false);
    }
  }, []);

  const handleAcceptOpp = useCallback(async (requestId: number) => {
    setAcceptingOpp(requestId);
    try {
      await api.post(`/requests/${requestId}/accept`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
      await loadMissions();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Erreur';
      Alert.alert('Impossible', msg);
    } finally {
      setAcceptingOpp(null);
    }
  }, [loadMissions]);

  const handleDeclineOpp = useCallback(async (requestId: number) => {
    // Remove immediately from local list (optimistic), then call backend to persist
    // the decline so the rebroadcast loop skips this provider for this request.
    setOpportunities((prev) => prev.filter((o) => o.id !== requestId));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await api.post(`/requests/${requestId}/refuse`);
    } catch (e: any) {
      // Non-fatal: local state already updated. Just log for debugging.
      const msg = e?.response?.data?.message || e?.message || 'Erreur';
      Alert.alert('Refus enregistré localement', msg);
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
    socket.on('new_opportunity', handleOpp);
    socket.on('request:statusUpdated', handleStatus);
    socket.on('request:claimed', handleClaimed);
    return () => {
      socket.off('new_opportunity', handleOpp);
      socket.off('request:statusUpdated', handleStatus);
      socket.off('request:claimed', handleClaimed);
    };
  }, [socket, fetchOpportunities, loadMissions]);

  useEffect(() => { loadMissions(); fetchOpportunities(); }, [loadMissions, fetchOpportunities]);
  const onRefresh = () => { setRefreshing(true); loadMissions(); fetchOpportunities(); };

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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        client:      r.client ? { id: r.client.id, name: r.client.name || '', phone: r.client.phone } : undefined,
        createdAt:   r.createdAt,
        scheduledAt: r.preferredTimeStart || r.scheduledAt,
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
      const earnings = response.earnings ?? (mission.price * NET_RATE);
      devLog(`[Missions] Mission ${mission.id} terminee. Gains: ${formatEuros(earnings)}`);
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
      <MissionCard
        mission={item}
        onPress={() => {
          if (isActive) {
            router.replace({ pathname: '/request/[id]/ongoing', params: { id: item.id } });
          } else {
            handleMissionPress(item.id);
          }
        }}
        onNavigate={() => handleNavigate(item)}
        onComplete={() => handleComplete(item)}
      />
    );
  }, [handleComplete, router]);

  if (loading) {
    return (
      <SafeAreaView style={[s.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator size="large" color={t.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: t.bg }]}>

      {/* -- Header -- */}
      <View style={[s.header, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={[s.headerTitle, { color: t.text }]}>Missions</Text>
            {upcomingMissions.length > 0 && (
              <Text style={[s.headerSub, { color: t.textMuted }]}>
                {upcomingMissions.length} mission{upcomingMissions.length > 1 ? 's' : ''} a venir
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

      {/* -- Tabs -- */}
      <TabBar tab={tab} onChange={setTab} upcomingCount={upcomingMissions.length} opportunityCount={opportunities.length} />

      {/* -- Opportunites tab -- */}
      {tab === 'opportunities' && (
        loadingOpps ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={t.accent} />
          </View>
        ) : opportunities.length === 0 ? (
          <View style={opp.emptyWrap}>
            <Ionicons name="telescope-outline" size={48} color={t.textMuted} />
            <Text style={[opp.emptyTitle, { color: t.text }]}>Aucune opportunite</Text>
            <Text style={[opp.emptySub, { color: t.textSub }]}>
              Les missions planifiees correspondant a vos competences apparaitront ici.
            </Text>
          </View>
        ) : (
          <FlatList
            data={opportunities}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <OpportunityCard item={item} theme={t} onAccept={handleAcceptOpp} onDecline={handleDeclineOpp} accepting={acceptingOpp} />
            )}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />
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
          <Ionicons name="alert-circle-outline" size={15} color={t.text} />
          <Text style={[s.errorText, { color: t.text }]}>{error}</Text>
          <TouchableOpacity onPress={loadMissions}>
            <Text style={[s.retryText, { color: t.text }]}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* -- Liste missions (A venir / Historique) -- */}
      {tab !== 'opportunities' && (
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
      )}

      {/* -- Bottom Sheet Detail -- */}
      <BottomSheet ref={bottomSheetRef} index={-1} enableDynamicSizing enablePanDownToClose backdropComponent={renderBackdrop} backgroundStyle={{ backgroundColor: t.cardBg }} handleIndicatorStyle={{ backgroundColor: t.border }} maxDynamicContentSize={Dimensions.get('window').height * 0.85}>
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
        ) : null}
      </BottomSheet>

      {/* -- Modal confirmation "Terminer" -- */}
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
  root:   { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 26, fontFamily: FONTS.bebas, letterSpacing: 0.5 },
  headerSub:   { fontSize: 13, fontFamily: FONTS.sans, marginTop: 2 },
  searchIconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  searchBar:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, height: 44, marginTop: 12 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: FONTS.sans, paddingHorizontal: 10, height: 44 },

  list:      { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 32 },
  listEmpty: { flex: 1 },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 4, borderRadius: 12, padding: 12 },
  errorText:   { flex: 1, fontSize: 13, fontFamily: FONTS.sans },
  retryText:   { fontSize: 13, fontFamily: FONTS.sansMedium },
});
