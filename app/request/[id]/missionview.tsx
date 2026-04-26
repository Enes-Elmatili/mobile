// app/request/[id]/MissionView.tsx
// ─── Page unifiée : SEARCHING → TRACKING (même écran, transition de phase) ───

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Easing, Platform, Dimensions, StatusBar,
  TextInput, KeyboardAvoidingView, Modal, Pressable, Linking, Image,
  ActionSheetIOS, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSocket } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useConversationUnread } from '@/lib/useConversationUnread';
import { isCompletionHandled, markCompletionHandled } from '@/lib/navDedup';
import { resolveAvatarUrl } from '@/lib/avatarUrl';
import { api } from '@/lib/api';
import { devLog, devError } from '@/lib/logger';
import { useAppTheme, FONTS, COLORS, darkTokens } from '@/hooks/use-app-theme';
import { PulseDot } from '@/components/ui/PulseDot';
import LiveMapSearching from '@/components/searching/LiveMapSearching';
import { formatEUR as formatEuros } from '@/lib/format';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';
const SERVER_BASE = API_BASE_URL.replace(/\/api\/?$/, '');
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

/** Avatar component — real photo or initials fallback */
function Avatar({ url, name, size = 46, style }: { url?: string | null; name?: string | null; size?: number; style?: any }) {
  const theme = useAppTheme();
  const r = size / 2;
  const base = { width: size, height: size, borderRadius: r, overflow: 'hidden' as const };
  const resolved = resolveAvatarUrl(url);
  if (resolved) {
    return <Image source={{ uri: resolved }} style={[base, { borderWidth: 1.5, borderColor: theme.borderLight }, style]} />;
  }
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <View style={[base, { backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.borderLight }, style]}>
      <Text style={{ fontSize: size * 0.38, fontFamily: FONTS.sansMedium, color: theme.text }}>{initials}</Text>
    </View>
  );
}

// ─── Phase de la page ────────────────────────────────────────────────────────
type Phase = 'SEARCHING' | 'TRACKING';

// ─── Params ──────────────────────────────────────────────────────────────────
interface MissionParams {
  id: string;
  serviceName?: string;
  address?: string;
  price?: string;
  scheduledLabel?: string;
  expiresAt?: string;
  lat?: string;
  lng?: string;
  // Set to '1' when the request is scheduled for the future — changes the
  // SEARCHING phase copy from active "searching now" to passive "scheduled, waiting".
  isScheduled?: string;
  isQuote?: string;
  calloutFee?: string;
}

// ─── Utils ───────────────────────────────────────────────────────────────────
// ─── Toast System ─────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
interface ToastData { id: number; message: string; type: ToastType }

const toastEmitter = { listeners: [] as ((t: ToastData) => void)[] };
let toastId = 0;

function showToast(message: string, type: ToastType = 'info') {
  const t: ToastData = { id: toastId++, message, type };
  toastEmitter.listeners.forEach(fn => fn(t));
}

function ToastProvider() {
  const theme = useAppTheme();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const anim = useRef<Record<number, Animated.Value>>({});

  useEffect(() => {
    const handler = (t: ToastData) => {
      anim.current[t.id] = new Animated.Value(0);
      setToasts(prev => [t, ...prev]);
      Animated.sequence([
        Animated.timing(anim.current[t.id], { toValue: 1, duration: 280, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
        Animated.delay(2600),
        Animated.timing(anim.current[t.id], { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
        delete anim.current[t.id];
      });
    };
    toastEmitter.listeners.push(handler);
    return () => { toastEmitter.listeners = toastEmitter.listeners.filter(l => l !== handler); };
  }, []);

  if (!toasts.length) return null;
  return (
    <View style={toast.stack} pointerEvents="none">
      {toasts.map(t => {
        const av = anim.current[t.id] || new Animated.Value(1);
        const bg = t.type === 'success' ? COLORS.greenBrand : theme.cardBg;
        const iconName = t.type === 'success' ? 'check' : t.type === 'error' ? 'x' : 'circle';
        return (
          <Animated.View
            key={t.id}
            style={[toast.pill, { backgroundColor: bg, borderWidth: 1, borderColor: theme.borderLight },
              {
                opacity: av,
                transform: [{ translateY: av.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <Feather name={iconName as any} size={14} color={darkTokens.text} />
            <Text style={toast.text}>{t.message}</Text>
          </Animated.View>
        );
      })}
    </View>
  );
}

const toast = StyleSheet.create({
  stack:  { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 36, left: 20, right: 20, zIndex: 9999, gap: 8, pointerEvents: 'none' },
  pill:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 13, gap: 10,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 12 } }) },
  icon:   { fontSize: 13, color: darkTokens.text, fontFamily: FONTS.sansMedium },
  text:   { fontSize: 14, color: darkTokens.text, fontFamily: FONTS.sansMedium, flex: 1 },
});

// ─── ConfirmModal (remplace Alert.alert) ─────────────────────────────────────
interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ visible, title, message, confirmLabel, cancelLabel, destructive = false, onConfirm, onCancel }: ConfirmModalProps) {
  const { t } = useTranslation();
  const th = useAppTheme();
  const resolvedConfirmLabel = confirmLabel || t('common.confirm');
  const resolvedCancelLabel = cancelLabel || t('common.cancel');
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={cm.overlay} onPress={onCancel}>
        <Animated.View style={{ opacity: fadeAnim, ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      </Pressable>
      <Animated.View style={[cm.sheet, { backgroundColor: th.cardBg, transform: [{ translateY: slideAnim }] }]}>
        <View style={[cm.handle, { backgroundColor: th.borderLight }]} />
        <Text style={[cm.title, { color: th.text, fontFamily: FONTS.bebas }]}>{title}</Text>
        {message ? <Text style={[cm.message, { color: th.textSub, fontFamily: FONTS.sans }]}>{message}</Text> : null}
        <View style={cm.actions}>
          <TouchableOpacity style={[cm.cancelBtn, { borderColor: th.border }]} onPress={onCancel} activeOpacity={0.75}>
            <Text style={[cm.cancelLabel, { color: th.textSub, fontFamily: FONTS.sansMedium }]}>{resolvedCancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: th.accent }, destructive && { backgroundColor: COLORS.red }]} onPress={onConfirm} activeOpacity={0.75}>
            <Text style={[cm.confirmLabel, { fontFamily: FONTS.sansMedium }]}>{resolvedConfirmLabel}</Text>
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
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: -4 } }, android: { elevation: 16 } }),
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 24, textAlign: 'center', letterSpacing: 1, marginBottom: 10 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, alignItems: 'center' },
  cancelLabel: { fontSize: 15 },
  confirmBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  confirmLabel: { fontSize: 15, color: darkTokens.text },
});




/** Display name for provider — checks provider.name, then user.name, detects slugs */
const providerDisplayName = (provider: any): string => {
  // Try provider.name first, then user.name (joined via backend include)
  const candidates = [provider?.name, provider?.user?.name, provider?.firstName];
  for (const raw of candidates) {
    if (!raw) continue;
    // Slug detection: all lowercase alphanumeric, no spaces, 6+ chars = probably a hash
    if (/^[a-z0-9]{6,}$/.test(raw)) continue;
    // Email detection: skip if it looks like an email
    if (raw.includes('@')) continue;
    return raw;
  }
  return 'Prestataire';
};

/** First name only for humanized text */
const providerFirstName = (provider: any): string => {
  const full = providerDisplayName(provider);
  return full.split(' ')[0];
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fallbackETA = (oLat: number, oLng: number, dLat: number, dLng: number) => {
  const min = Math.ceil((calculateDistance(oLat, oLng, dLat, dLng) * 1.4 / 30) * 60);
  return min <= 1 ? '1 min' : `${min} min`;
};

// ─── Decode Google encoded polyline ──────────────────────────────────────────
function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b: number;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

// ─── Grayscale map style (light) ──────────────────────────────────────────────
const MAP_STYLE_LIGHT = [
  { elementType: 'geometry',           stylers: [{ color: '#f0f0f0' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'poi',     elementType: 'geometry', stylers: [{ color: '#e8e8e8' }] },
  { featureType: 'road',    elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#d6d6d6' }] },
  { featureType: 'water',   elementType: 'geometry', stylers: [{ color: '#d0d0d0' }] },
];

// ─── Dark map style (monochrome branded — no blue) ───────────────────────────
const MAP_STYLE_DARK = [
  { elementType: 'geometry',           stylers: [{ color: '#1A1A1A' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#888888' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'poi',           stylers: [{ visibility: 'off' }] },
  { featureType: 'road',          elementType: 'geometry', stylers: [{ color: '#2C2C2C' }] },
  { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#333333' }] },
  { featureType: 'road.highway',  elementType: 'labels.text.fill', stylers: [{ color: '#888888' }] },
  { featureType: 'road.local',    elementType: 'labels.text.fill', stylers: [{ color: '#666666' }] },
  { featureType: 'water',         elementType: 'geometry', stylers: [{ color: '#111111' }] },
  { featureType: 'water',         elementType: 'labels.text.fill', stylers: [{ color: '#555555' }] },
];

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR WAVES (phase SEARCHING)
// ═══════════════════════════════════════════════════════════════════════════════
const WAVE_COUNT = 4;
const WAVE_SIZE = width * 0.85;

function RadarWaves() {
  const theme = useAppTheme();
  const anims = useRef(
    Array.from({ length: WAVE_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 650),
          Animated.timing(anim, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={rw.wrap} pointerEvents="none">
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[rw.wave, { borderColor: theme.textMuted },  {
            opacity:   anim.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.2, 0.07, 0] }),
            transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }],
          }]}
        />
      ))}
    </View>
  );
}

const rw = StyleSheet.create({
  wrap: { position: 'absolute', width: WAVE_SIZE, height: WAVE_SIZE, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', width: WAVE_SIZE, height: WAVE_SIZE, borderRadius: WAVE_SIZE / 2, borderWidth: 1.5 },
});

// ─── Ghost Markers (prestataires fantômes sur carte) ─────────────────────────
const GHOST_OFFSETS = [
  { lat: 0.008, lng: 0.006 },
  { lat: -0.005, lng: 0.012 },
  { lat: 0.003, lng: -0.010 },
];

function GhostMarkers({ center }: { center: { latitude: number; longitude: number } }) {
  const theme = useAppTheme();
  const anims = useRef(GHOST_OFFSETS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 1100),
          Animated.timing(anim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <>
      {GHOST_OFFSETS.map((offset, i) => {
        const coord = {
          latitude: center.latitude + offset.lat,
          longitude: center.longitude + offset.lng,
        };
        return (
          <Marker key={i} coordinate={coord} anchor={{ x: 0.5, y: 0.5 }}>
            <Animated.View style={[gm.outer, { backgroundColor: theme.accent }, {
              opacity: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] }),
              transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.05] }) }],
            }]}>
              <Feather name="user" size={12} color={theme.accentText} />
            </Animated.View>
          </Marker>
        );
      })}
    </>
  );
}

const gm = StyleSheet.create({
  outer: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)',
  },
});

// ─── Logo central pulsant ─────────────────────────────────────────────────────
function CenterLogo() {
  const theme = useAppTheme();
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[cl.outer, { backgroundColor: theme.accent }, { transform: [{ scale: pulse }] }]}>
      <Feather name="search" size={28} color={theme.accentText as string} />
    </Animated.View>
  );
}

const cl = StyleSheet.create({
  outer: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 16 },
    }),
  },
});

// ─── Messages dynamiques (SEARCHING) ─────────────────────────────────────────
const getSteps = (t: any) => [
  { at: 0,   title: t('mission_view.search_step1_title'), sub: t('mission_view.search_step1_sub') },
  { at: 4,   title: t('mission_view.search_step2_title'), sub: t('mission_view.search_step2_sub') },
  { at: 10,  title: t('mission_view.search_step3_title'), sub: t('mission_view.search_step3_sub') },
  { at: 25,  title: t('mission_view.search_step4_title'), sub: t('mission_view.search_step4_sub') },
  { at: 70,  title: t('mission_view.search_step5_title'), sub: t('mission_view.search_step5_sub') },
  { at: 140, title: t('mission_view.search_step6_title'), sub: t('mission_view.search_step6_sub') },
];

function DynamicMessage({ elapsed }: { elapsed: number }) {
  const { t } = useTranslation();
  const th = useAppTheme();
  const steps = getSteps(t);
  const current = [...steps].reverse().find(s => elapsed >= s.at) || steps[0];
  const opacity = useRef(new Animated.Value(1)).current;
  const prev = useRef(current.title);

  useEffect(() => {
    if (prev.current === current.title) return;
    prev.current = current.title;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.title]);

  return (
    <Animated.View style={[dm.wrap, { opacity }]}>
      <Text style={[dm.title, { color: th.text }]}>{current.title}</Text>
      <Text style={[dm.sub, { color: th.textSub }]}>{current.sub}</Text>
    </Animated.View>
  );
}

const dm = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingHorizontal: 32 },
  title: { fontSize: 22, textAlign: 'center', letterSpacing: 1, marginBottom: 7, fontFamily: FONTS.bebas },
  sub:   { fontSize: 14, textAlign: 'center', lineHeight: 20, fontFamily: FONTS.sans },
});

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(expiresAt?: string) {
  const [sec, setSec] = useState(() =>
    expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : 15 * 60
  );
  useEffect(() => {
    const iv = setInterval(() => setSec(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(iv);
  }, []);
  const m = Math.floor(sec / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return { display: `${m}:${ss}`, isExpiring: sec < 120, isExpired: sec === 0 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER MARKER (TRACKING)
// ═══════════════════════════════════════════════════════════════════════════════
function ProviderMarker() {
  const theme = useAppTheme();
  return (
    <View style={pm.wrap}>
      <View style={[pm.pin, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
        <Feather name="navigation" size={14} color={theme.text} />
      </View>
      <View style={[pm.stem, { backgroundColor: theme.cardBg }]} />
    </View>
  );
}

const pm = StyleSheet.create({
  wrap: { alignItems: 'center' },
  pin: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  stem: {
    width: 2, height: 6, borderRadius: 1, marginTop: -1,
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function MissionView() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const id = params.id;
  const serviceName = params.serviceName;
  const address = params.address;
  const price = params.price;
  const scheduledLabel = params.scheduledLabel;
  const expiresAt = params.expiresAt;
  const lat = params.lat;
  const lng = params.lng;
  const isScheduledMission = params.isScheduled === '1';
  const isQuoteMission = params.isQuote === '1';
  const { socket, joinRoom, leaveRoom } = useSocket();
  const { user: authUser } = useAuth();

  // Guard: id is required
  if (!id || !/^\d+$/.test(id)) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Mission introuvable</Text>
      </SafeAreaView>
    );
  }
  const { t } = useTranslation();
  const theme = useAppTheme();
  const mapStyle = theme.isDark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const mapRef = useRef<MapView>(null);

  // ─── Phase state ─────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('SEARCHING');
  const phaseAnim = useRef(new Animated.Value(0)).current; // 0 = searching, 1 = tracking
  const hasTransitionedRef = useRef(false); // guard anti-double-transition

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [cancelSearchModal, setCancelSearchModal] = useState(false);
  const [cancelTrackModal, setCancelTrackModal] = useState(false);

  // ─── Searching state ──────────────────────────────────────────────────────
  const [elapsed, setElapsed] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  // Countdown removed — no timer shown to client during searching

  // ─── Tracking state ───────────────────────────────────────────────────────
  const [request, setRequest] = useState<any>(null);
  const [providerLocation, setProviderLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [eta, setEta] = useState('');
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [message, setMessage] = useState('');
  // Ref : vrai dès qu'on a reçu une position GPS réelle via socket
  const hasRealLocationRef = useRef(false);

  // ─── PIN state ──────────────────────────────────────────────────────────
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [providerArrived, setProviderArrived] = useState(false);

  // ─── Conversation badge (provider → client) ──────────────────────────────
  const providerUserId = request?.provider?.userId || request?.provider?.id || null;
  const { count: unreadFromProvider, reset: resetUnread } = useConversationUnread(
    providerUserId,
    authUser?.id,
  );

  // ─── Shared ───────────────────────────────────────────────────────────────
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;

  const clientLocation = {
    latitude: lat ? parseFloat(lat) : request?.lat || 50.8503,
    longitude: lng ? parseFloat(lng) : request?.lng || 4.3517,
  };

  // Computed distance between provider and client (km)
  const distance = providerLocation
    ? calculateDistance(providerLocation.latitude, providerLocation.longitude, clientLocation.latitude, clientLocation.longitude)
    : null;

  // Extract numeric ETA from string (e.g. "21 minutes" → "21", "Arrivée dans 5 min" → "5")
  const etaNumMatch = eta.match(/(\d+)/);
  const etaNum = etaNumMatch ? etaNumMatch[1] : null;

  // ─── Entrée page ──────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Elapsed (searching) — only for now-requests, not scheduled missions ───
  useEffect(() => {
    if (phase !== 'SEARCHING' || isScheduledMission) return;
    const iv = setInterval(() => setElapsed(p => p + 1), 1000);
    return () => clearInterval(iv);
  }, [phase, isScheduledMission]);

  // ─── Drift carte (SEARCHING) — only for urgent now-requests, static for scheduled
  useEffect(() => {
    if (phase !== 'SEARCHING' || isScheduledMission || !mapRef.current) return;
    const radius = 0.004;
    let angle = 0;
    const iv = setInterval(() => {
      angle += 0.15;
      mapRef.current?.animateToRegion({
        latitude:  clientLocation.latitude  + Math.sin(angle) * radius,
        longitude: clientLocation.longitude + Math.cos(angle) * radius,
        latitudeDelta:  0.025,
        longitudeDelta: 0.025,
      }, 3000);
    }, 3000);
    return () => clearInterval(iv);
  }, [phase, isScheduledMission, clientLocation.latitude, clientLocation.longitude]);

  // ─── Fetch PIN (silencieux — le 404 NO_PIN est un état normal) ───────────
  const fetchPin = useCallback(async (requestId: string) => {
    try {
      const token = await (await import('@/lib/storage')).tokenStorage.getToken();
      const baseUrl = (await import('@/lib/config')).default.apiUrl;
      const res = await fetch(`${baseUrl}/requests/${requestId}/pin`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(__DEV__ ? { 'ngrok-skip-browser-warning': 'true' } : {}),
        },
      });
      if (!res.ok) return; // 404 NO_PIN = normal, pas encore généré
      const data = await res.json();
      if (data?.pinCode) setPinCode(data.pinCode);
      if (data?.pinVerified) setPinVerified(true);
    } catch { /* network error — ignore silently */ }
  }, []);

  // ─── Transition vers TRACKING ─────────────────────────────────────────────
  const transitionToTracking = useCallback((requestData: any) => {
    // Guard : évite la double-transition si le polling et le socket arrivent en même temps
    if (hasTransitionedRef.current) return;
    hasTransitionedRef.current = true;

    setRequest(requestData);
    if (requestData.beforePhotoUrl) setProviderArrived(true);
    if (requestData.pinVerified) setPinVerified(true);

    // Fix : set provider location depuis la réponse polling
    if (requestData.provider?.lat && requestData.provider?.lng) {
      setProviderLocation({
        latitude: requestData.provider.lat,
        longitude: requestData.provider.lng,
      });
    }

    // Fix PIN : set directement depuis la réponse REST (évite race condition socket)
    const resolvedPin = requestData.pinCode || null;
    devLog('[MissionView] transitionToTracking — pinCode:', resolvedPin, 'pinVerified:', requestData.pinVerified);
    if (resolvedPin) {
      setPinCode(resolvedPin);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    fetchPin(String(requestData.id)); // fallback si pinCode absent de la réponse

    // Fix : setPhase AVANT l'animation pour que la PIN card s'affiche immédiatement
    setPhase('TRACKING');
    devLog('[MissionView] phase → TRACKING, pinCode:', resolvedPin);
    Animated.timing(phaseAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPin]);

  // ─── ETA Google ──────────────────────────────────────────────────────────
  const fetchETA = useCallback(async (oLat: number, oLng: number, dLat: number, dLng: number) => {
    try {
      if (!GOOGLE_MAPS_API_KEY) throw new Error('No key');
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'OK' && data.routes?.length > 0) {
        setEta(data.routes[0].legs[0].duration.text);
        // Decode route polyline
        const encoded = data.routes[0].overview_polyline?.points;
        if (encoded) setRouteCoords(decodePolyline(encoded));
      } else throw new Error(data.status);
    } catch {
      setEta(fallbackETA(oLat, oLng, dLat, dLng));
    }
  }, []);

  // ─── Polling SEARCHING (5s) — s'arrête dès que phase passe en TRACKING ──
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pinPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!id || phase !== 'SEARCHING') return;
    const poll = async () => {
      try {
        const res = await api.get(`/requests/${id}`);
        const data = res?.data || res;
        devLog('[MissionView] poll data keys:', Object.keys(data || {}), 'pinCode:', data?.pinCode, 'status:', data?.status);
        const status = (data?.status || '').toUpperCase();
        // Tracking = prestataire en route ou sur place (ONGOING). Pour ACCEPTED, on bascule
        // en tracking SEULEMENT si la demande est immédiate (rendez-vous dans <30 min) ;
        // sinon (mission planifiée), on redirige vers le récap pour ne pas afficher un faux
        // tracking alors que le prestataire ne bouge pas encore.
        const startTs = data?.preferredTimeStart ? new Date(data.preferredTimeStart).getTime() : null;
        const isFutureScheduled = startTs != null && startTs > Date.now() + 30 * 60 * 1000;
        const isScheduled = isScheduledMission || isFutureScheduled;

        if (status === 'ONGOING' || (status === 'ACCEPTED' && !isScheduled)) {
          // Stop polling before transitioning
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          transitionToTracking(data);
        } else if (status === 'ACCEPTED' && isScheduled) {
          // Mission planifiée acceptée → récap, pas de tracking prématuré
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          router.replace({ pathname: '/request/[id]/scheduled', params: { id: String(id), mode: 'recap' } });
        } else if (status === 'QUOTE_SENT') {
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          router.replace({ pathname: '/request/[id]/quote-review', params: { id: String(id) } });
        } else if (status === 'QUOTE_REFUSED' || status === 'QUOTE_EXPIRED') {
          // Quote refused/expired — stop polling, redirect to dashboard
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          router.replace('/(tabs)/dashboard');
        } else if (['CANCELLED', 'EXPIRED', 'COMPLETED', 'DONE'].includes(status)) {
          // Stop polling on terminal statuses
          if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          router.replace('/(tabs)/dashboard');
        }
      } catch (e) { devError('[MissionView] poll:', e); }
    };
    poll();
    pollingRef.current = setInterval(poll, 15000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, phase]);

  // Countdown auto-redirect removed — backend handles expiration via cron

  // ─── Polling PIN de sécurité (fallback si socket raté) ────────────────────
  useEffect(() => {
    if (phase !== 'TRACKING' || pinCode || pinVerified) return;

    fetchPin(id);
    pinPollRef.current = setInterval(() => fetchPin(id), 10000);

    return () => {
      if (pinPollRef.current) { clearInterval(pinPollRef.current); pinPollRef.current = null; }
    };
  }, [phase, pinCode, pinVerified, id, fetchPin]);

  useEffect(() => {
    if (pinCode && pinPollRef.current) {
      clearInterval(pinPollRef.current);
      pinPollRef.current = null;
    }
  }, [pinCode]);

  // ─── PIN — affichage inline dans la sheet de tracking ────────────────────
  // Plus de navigation vers /request/[id]/pin : le code est désormais visible
  // directement dans la card PIN du tracking sheet (cf. block "PIN Card" ci-dessous).

  // ─── Socket (TRACKING) ────────────────────────────────────────────────────
  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (request?.lat && request?.lng) destRef.current = { lat: request.lat, lng: request.lng };
  }, [request]);

  useEffect(() => {
    if (!socket || !id) return;
    joinRoom('request', id);

    // Track deferred navigations so we can cancel them on unmount or effect
    // re-run — otherwise a 1.8–2s setTimeout can fire router.replace() into
    // an already-unmounted screen or after the user tapped something else.
    const deferredNavTimers: ReturnType<typeof setTimeout>[] = [];

    let lastEtaFetch = 0;
    const onLocation = async (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      hasRealLocationRef.current = true;
      const loc = { latitude: data.lat, longitude: data.lng };
      setProviderLocation(loc);
      // Throttle ETA fetch to max 1 per 30 seconds
      const now = Date.now();
      if (destRef.current && now - lastEtaFetch >= 30_000) {
        lastEtaFetch = now;
        await fetchETA(data.lat, data.lng, destRef.current.lat, destRef.current.lng);
      } else if (data.eta) {
        setEta(data.eta);
      }
      // Fit map to show both provider and destination pins
      if (destRef.current) {
        mapRef.current?.fitToCoordinates(
          [loc, { latitude: destRef.current.lat, longitude: destRef.current.lng }],
          { edgePadding: { top: 80, right: 60, bottom: 380, left: 60 }, animated: true }
        );
      } else {
        mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.01, longitudeDelta: 0.01 });
      }
    };

    const onStarted = (data: any) => {
      if (String(data.id || data.requestId) === String(id))
        setRequest((p: any) => p ? { ...p, status: 'ONGOING' } : p);
    };

    const onStatusUpdated = (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      const st = data.status?.toUpperCase();
      if (st === 'QUOTE_SENT') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace({ pathname: '/request/[id]/quote-review', params: { id: String(id) } });
      } else if (st === 'QUOTE_REFUSED' || st === 'QUOTE_EXPIRED') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        router.replace('/(tabs)/dashboard');
      } else if (st === 'ONGOING') {
        // Quote accepted and paid — reload request data for tracking
        api.get(`/requests/${id}`).then((res: any) => {
          const d = res?.data || res;
          if (d) transitionToTracking(d);
        }).catch(() => {});
      }
    };

    const onCompleted = (data: any) => {
      if (String(data.requestId) === String(id)) {
        if (isCompletionHandled(id)) return; // SocketContext a déjà pris la main
        markCompletionHandled(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast(t('mission_view.mission_completed'), 'success');
        deferredNavTimers.push(setTimeout(() => router.replace({
          pathname: '/request/[id]/rating',
          params: { id: String(id) },
        }), 2000));
      }
    };

    const onCancelled = (data: any) => {
      if (String(data.requestId || data.id) === String(id)) {
        showToast(t('mission_view.mission_cancelled'), 'error');
        deferredNavTimers.push(setTimeout(() => router.replace('/(tabs)/dashboard'), 1800));
      }
    };

    // ── PIN / photo events ──────────────────────────────────────────────────
    const onPinReady = (data: any) => {
      if (String(data.requestId) === String(id) && data.pinCode) {
        setPinCode(data.pinCode);
      }
    };

    const onBeforePhoto = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setProviderArrived(true);
        // La navigation vers /pin est gérée par le useEffect dédié
      }
    };

    const onPinVerified = (data: any) => {
      if (String(data.requestId) === String(id)) {
        setPinVerified(true);
        showToast('Code PIN vérifié — mission en cours', 'success');
      }
    };

    // ── Reassigning : le prestataire s'est désisté, on cherche un remplaçant.
    // On rebascule l'écran en phase SEARCHING en réinitialisant les states liés
    // au tracking (PIN, position provider, request data partielle).
    const onReassigning = (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      showToast('Votre prestataire s\'est désisté. Recherche d\'un remplaçant…', 'info');
      hasTransitionedRef.current = false;
      hasRealLocationRef.current = false;
      setPinCode(null);
      setPinVerified(false);
      setProviderArrived(false);
      setProviderLocation(null);
      setRouteCoords([]);
      setEta('');
      setRequest((p: any) => p ? { ...p, status: 'PUBLISHED', providerId: null, provider: null, pinCode: null, pinVerified: false } : p);
      setPhase('SEARCHING');
      Animated.timing(phaseAnim, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start();
    };

    socket.on('provider:location_update', onLocation);
    socket.on('request:started', onStarted);
    socket.on('request:completed', onCompleted);
    socket.on('request:cancelled', onCancelled);
    socket.on('request:reassigning', onReassigning);
    socket.on('mission:pin_ready', onPinReady);
    socket.on('mission:before_photo', onBeforePhoto);
    socket.on('mission:pin_verified', onPinVerified);
    socket.on('request:statusUpdated', onStatusUpdated);
    return () => {
      leaveRoom('request', id);
      deferredNavTimers.forEach(clearTimeout);
      socket.off('provider:location_update', onLocation);
      socket.off('request:started', onStarted);
      socket.off('request:completed', onCompleted);
      socket.off('request:cancelled', onCancelled);
      socket.off('request:reassigning', onReassigning);
      socket.off('mission:pin_ready', onPinReady);
      socket.off('mission:before_photo', onBeforePhoto);
      socket.off('mission:pin_verified', onPinVerified);
      socket.off('request:statusUpdated', onStatusUpdated);
    };
  }, [socket, id, fetchETA, joinRoom, leaveRoom]);

  // ─── Set provider location depuis request initial ─────────────────────────
  // N'écrase JAMAIS l'ETA si on a déjà reçu une position réelle via socket
  // (évite le bug : request:started → setRequest → useEffect → reset ETA)
  useEffect(() => {
    if (!request) return;
    if (request.provider?.lat && request.provider?.lng) {
      const loc = { latitude: request.provider.lat, longitude: request.provider.lng };
      setProviderLocation(loc);
      if (!hasRealLocationRef.current && request.lat && request.lng) {
        fetchETA(request.provider.lat, request.provider.lng, request.lat, request.lng);
      }
    } else if (!hasRealLocationRef.current) {
      // Seulement si aucun GPS réel reçu — ne pas écraser l'ETA du socket
      setEta(t('mission_view.waiting_location'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // ─── Annuler (SEARCHING) ──────────────────────────────────────────────────
  const handleCancelSearching = useCallback(() => {
    setCancelSearchModal(true);
  }, []);

  const doConfirmCancelSearching = useCallback(async () => {
    setCancelSearchModal(false);
    setCancelling(true);
    try {
      await api.post(`/requests/${id}/cancel`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      router.replace('/(tabs)/dashboard');
    } catch {
      showToast(t('mission_view.cancel_failed'), 'error');
      setCancelling(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  // ─── Annuler (TRACKING) ───────────────────────────────────────────────────
  // useCallback avec status en dep pour qu'openActionsMenu lise toujours la valeur fraîche.
  // Le guard ONGOING est traité via Alert (pas toast) car le toast peut être invisible
  // selon la pile UI active — un Alert garantit que le client voit l'explication.
  const handleCancelTracking = useCallback(() => {
    const status = (request?.status || '').toUpperCase();
    if (status === 'ONGOING') {
      Alert.alert(
        'Mission en cours',
        'La mission est déjà démarrée par le prestataire. Pour l\'annuler maintenant, contactez le support.',
        [
          { text: 'Fermer', style: 'cancel' },
          { text: 'Contacter le support', onPress: () => router.push('/settings/help') },
        ],
      );
      return;
    }
    setCancelTrackModal(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.status, router]);

  const doConfirmCancelTracking = async () => {
    setCancelTrackModal(false);
    try {
      await api.post(`/requests/${id}/cancel`);
      showToast(t('mission_view.mission_was_cancelled'), 'info');
      setTimeout(() => router.replace('/(tabs)/dashboard'), 1600);
    } catch (error: any) {
      const code = error?.data?.code || error?.response?.data?.code;
      if (code === 'INVALID_STATE' || error?.status === 400) {
        // L'état serveur a changé entre l'ouverture de la modale et la confirmation
        // (ex : le prestataire a démarré la mission entre-temps). On refresh + on explique.
        try {
          const res: any = await api.get(`/requests/${id}`);
          setRequest(res?.data || res);
        } catch { /* ignore */ }
        Alert.alert(
          'Annulation impossible',
          'Le statut de la mission a changé. Si elle est désormais en cours, contactez le support pour l\'annuler.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Contacter le support', onPress: () => router.push('/settings/help') },
          ],
        );
      } else {
        Alert.alert('Erreur', 'Impossible d\'annuler la mission. Réessayez ou contactez le support.');
      }
    }
  };

  // ─── Menu d'actions (ellipsis en haut à droite) ──────────────────────────
  const openActionsMenu = useCallback(() => {
    const goSupport = () => router.push('/settings/help');

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Contacter le support', 'Annuler la mission'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
        },
        (idx: number) => {
          if (idx === 1) goSupport();
          else if (idx === 2) handleCancelTracking();
        },
      );
      return;
    }

    Alert.alert(
      'Options',
      undefined,
      [
        { text: 'Contacter le support', onPress: goSupport },
        { text: 'Annuler la mission', style: 'destructive', onPress: handleCancelTracking },
        { text: 'Fermer', style: 'cancel' },
      ],
      { cancelable: true },
    );
  }, [router, handleCancelTracking]);

  // ─── Actions communication ───────────────────────────────────────────────
  const handleCall = useCallback(() => {
    const phone = request?.provider?.phone;
    if (!phone) {
      showToast(t('mission_view.phone_unavailable'), 'error');
      return;
    }
    const url = `tel:${phone.replace(/\s+/g, '')}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        showToast(t('mission_view.call_failed'), 'error');
      }
    }).catch(() => showToast(t('mission_view.call_failed'), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;
    const recipientId = request?.provider?.userId || request?.provider?.id;
    if (!recipientId) {
      showToast(t('mission_view.provider_not_found'), 'error');
      return;
    }
    const text = message.trim();
    setMessage('');
    try {
      await api.messages.send(recipientId, text);
      showToast(t('mission_view.message_sent'), 'success');
    } catch {
      showToast(t('mission_view.message_failed'), 'error');
      setMessage(text);
    }
  };

  // ─── Map region ──────────────────────────────────────────────────────────
  const mapRegion = {
    latitude:  clientLocation.latitude,
    longitude: clientLocation.longitude,
    latitudeDelta:  phase === 'SEARCHING' ? 0.025 : 0.015,
    longitudeDelta: phase === 'SEARCHING' ? 0.025 : 0.015,
  };

  const status = (request?.status || '').toUpperCase();

  // ─── Slide animation pour bottom sheets ──────────────────────────────────
  const searchingSheetY = phaseAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] });
  const trackingSheetY  = phaseAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.root}>
      <StatusBar barStyle={theme.statusBar} translucent backgroundColor="transparent" />

      {/* ── CARTE ── rendue uniquement hors SEARCHING (l'overlay LiveMapSearching
          porte sa propre carte pour éviter un double MapView) ── */}
      {phase !== 'SEARCHING' && (
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle}
        initialRegion={mapRegion}
        scrollEnabled={phase === 'TRACKING'}
        zoomEnabled={phase === 'TRACKING'}
        showsUserLocation={false}
        showsPointsOfInterest={false}
        showsBuildings={false}
      >
        {/* Marker client — toujours */}
        <Marker coordinate={clientLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={s.clientMarker}>
            <View style={[s.clientMarkerInner, { backgroundColor: theme.accent, borderColor: theme.cardBg }]} />
          </View>
        </Marker>

        {/* Itinéraire prestataire → client */}
        {phase === 'TRACKING' && routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={theme.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,26,26,0.4)'}
            strokeWidth={3}
            lineDashPattern={[0]}
          />
        )}

        {/* Marker prestataire — seulement en TRACKING */}
        {phase === 'TRACKING' && providerLocation && (
          <Marker coordinate={providerLocation} anchor={{ x: 0.5, y: 0.5 }}>
            <ProviderMarker />
          </Marker>
        )}

      </MapView>
      )}

      {/* ── PHASE SEARCHING : live map + bottom sheet ── */}
      {phase === 'SEARCHING' && (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
          pointerEvents="box-none"
        >
          <LiveMapSearching
            missionId={id}
            missionCoord={clientLocation}
            missionTitle={serviceName}
            missionAddress={address}
            missionWhen={scheduledLabel}
            missionPrice={price}
            expiresAt={expiresAt || null}
            cancelling={cancelling}
            isScheduled={isScheduledMission}
            isQuote={isQuoteMission}
            onCancel={handleCancelSearching}
          />
        </Animated.View>
      )}

      {/* ── PHASE TRACKING ── */}
      {phase === 'TRACKING' && (
        <>
          {/* Bouton retour flottant */}
          <SafeAreaView style={s.floatingTopBar} pointerEvents="box-none">
            <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }} activeOpacity={0.8} accessibilityLabel={t('common.back')} accessibilityRole="button">
              <Feather name="chevron-left" size={22} color={theme.text} />
            </TouchableOpacity>

            {/* FIXED · #ID */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View style={[s.statusBadge, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
                <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 12, letterSpacing: 2, color: theme.text }}>FIXED</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: theme.textMuted }}>·</Text>
                <Text style={{ fontFamily: FONTS.mono, fontSize: 12, letterSpacing: 1, color: theme.textSub }}>#{id}</Text>
              </View>
            </View>

            <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]} onPress={openActionsMenu} activeOpacity={0.8} accessibilityLabel="Options" accessibilityRole="button">
              <Feather name="more-horizontal" size={22} color={theme.text} />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Bottom sheet tracking */}
          <Animated.View style={[s.trackingSheet, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity + 0.04, transform: [{ translateY: trackingSheetY }] }]}>
            <View style={[s.sheetHandle, { backgroundColor: theme.borderLight }]} />
            <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={s.trackingScroll} contentContainerStyle={s.trackingScrollContent}>

            {/* Status badge + LIVE indicator */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(59,130,246,0.10)' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.statusOngoing }} />
                <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: COLORS.statusOngoing }}>
                  {status === 'ONGOING' ? t('mission_view.on_site').toUpperCase() : 'EN ROUTE'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <PulseDot size={6} color={COLORS.greenBrand} />
                <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: theme.textMuted }}>LIVE · GPS</Text>
              </View>
            </View>

            {/* ETA — the star of the show */}
            <View style={{ marginBottom: 10 }}>
              {status !== 'ONGOING' && etaNum ? (
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginBottom: 2 }}>
                  <Text style={{ fontFamily: FONTS.bebas, fontSize: 60, color: theme.text, lineHeight: 60, letterSpacing: -1 }}>
                    {etaNum}
                  </Text>
                  <Text style={{ fontFamily: FONTS.bebas, fontSize: 16, color: theme.text, letterSpacing: 0.5, marginBottom: 8 }}>
                    MIN AWAY
                  </Text>
                </View>
              ) : (
                <Text style={{ fontFamily: FONTS.bebas, fontSize: 36, color: theme.text, marginBottom: 2 }}>
                  {status === 'ONGOING' ? t('mission_view.on_site').toUpperCase() : t('mission_view.calculating')}
                </Text>
              )}
              <Text style={{ fontFamily: FONTS.sans, fontSize: 13, color: theme.textSub }}>
                {request?.provider
                  ? `${providerFirstName(request.provider)} est à ${distance ? `${distance.toFixed(1)} km` : '...'} de chez vous`
                  : t('mission_view.provider_on_way')}
              </Text>
            </View>

            {/* Divider */}
            <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

            {/* Provider row — compact, balanced sizing */}
            {request?.provider && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <TouchableOpacity onPress={() => router.push(`/providers/${request.provider.id}`)} activeOpacity={0.75}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {request.provider.avatarUrl ? (
                      <Image source={{ uri: resolveAvatarUrl(request.provider.avatarUrl) || '' }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                    ) : (
                      <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13, color: theme.text }}>
                        {providerDisplayName(request.provider).split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    )}
                    {request.provider.validationStatus === 'ACTIVE' && (
                      <View style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.greenBrand, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.cardBg }}>
                        <Feather name="check" size={8} color="#fff" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingRight: 8 }} onPress={() => router.push(`/providers/${request.provider.id}`)} activeOpacity={0.75}>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 15, color: theme.text, marginBottom: 2 }} numberOfLines={1}>
                    {providerDisplayName(request.provider)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Feather name="star" size={12} color={theme.text} />
                    <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 12, color: theme.textSub }}>
                      {request.provider.avgRating > 0 ? request.provider.avgRating.toFixed(1) : '-'}
                    </Text>
                    <Text style={{ fontFamily: FONTS.mono, fontSize: 12, color: theme.textMuted }}>·</Text>
                    <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 12, color: theme.textSub }}>
                      {request.provider.jobsCompleted || 0} missions
                    </Text>
                  </View>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.greenBrand, alignItems: 'center', justifyContent: 'center' }}
                    onPress={handleCall} activeOpacity={0.75}
                  >
                    <Feather name="phone" size={16} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => {
                      const recipientId = request?.provider?.userId || request?.provider?.id;
                      if (recipientId) {
                        resetUnread();
                        router.push({ pathname: '/messages/[userId]', params: { userId: recipientId, name: request?.provider?.name || '' } });
                      } else {
                        showToast(t('mission_view.provider_not_found'), 'error');
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <Feather name="message-circle" size={16} color={theme.text} />
                    {unreadFromProvider > 0 && (
                      <View style={{
                        position: 'absolute', top: -3, right: -3,
                        minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
                        backgroundColor: COLORS.greenBrand,
                        alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1.5, borderColor: theme.cardBg,
                      }}>
                        <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 9, color: '#fff', lineHeight: 11 }}>
                          {unreadFromProvider > 9 ? '9+' : unreadFromProvider}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* PIN Card — visible dès que le PIN est généré, avant l'arrivée du prestataire.
                Donne au client le temps de le préparer pour la vérification mutuelle sur place. */}
            {pinCode && !pinVerified && (
              <>
                <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
                <View style={pinStyles.card}>
                  <View style={pinStyles.header}>
                    <Feather name="key" size={14} color={theme.textMuted} />
                    <Text style={[pinStyles.label, { color: theme.textMuted }]}>CODE PIN DE VÉRIFICATION</Text>
                  </View>
                  <View style={pinStyles.digitsRow}>
                    {pinCode.split('').map((digit, i) => (
                      <View key={i} style={[pinStyles.digitBox, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
                        <Text style={[pinStyles.digitText, { color: theme.text }]}>{digit}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[pinStyles.hint, { color: theme.textSub }]}>
                    Communiquez ce code au prestataire à son arrivée.
                  </Text>
                </View>
              </>
            )}
            {pinVerified && (
              <>
                <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
                <View style={[pinStyles.verified, { backgroundColor: 'rgba(61,139,61,0.10)' }]}>
                  <Feather name="check-circle" size={16} color={COLORS.greenBrand} />
                  <Text style={[pinStyles.verifiedText, { color: COLORS.greenBrand }]}>
                    Code PIN vérifié — la mission a démarré
                  </Text>
                </View>
              </>
            )}

            {/* Divider */}
            <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

            {/* 3 metrics — SERVICE · MONTANT · DISTANCE */}
            {(() => {
              const priceNum = price ? parseFloat(String(price)) : NaN;
              const hasPrice = Number.isFinite(priceNum) && priceNum > 0;
              const priceLabel = isQuoteMission && !hasPrice ? 'Devis' : (hasPrice ? Math.round(priceNum).toString() : '—');
              const priceUnit = hasPrice ? '€' : '';
              return (
                <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                  <View style={{ flex: 1, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: theme.textMuted, marginBottom: 6 }}>SERVICE</Text>
                    <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, color: theme.text }} numberOfLines={1}>
                      {(request?.category?.name || request?.serviceType || 'SERVICE').toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: theme.borderLight, marginHorizontal: 12 }} />
                  <View style={{ flex: 1, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: theme.textMuted, marginBottom: 6 }}>MONTANT</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, color: theme.text }} numberOfLines={1}>{priceLabel}</Text>
                      {priceUnit ? <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 11, color: theme.textSub }}>{priceUnit}</Text> : null}
                    </View>
                  </View>
                  <View style={{ width: 1, backgroundColor: theme.borderLight, marginHorizontal: 12 }} />
                  <View style={{ flex: 1, paddingVertical: 4 }}>
                    <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2, color: theme.textMuted, marginBottom: 6 }}>DISTANCE</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                      <Text style={{ fontFamily: FONTS.bebas, fontSize: 22, color: theme.text }}>{distance ? distance.toFixed(1) : '-'}</Text>
                      <Text style={{ fontFamily: FONTS.monoMedium, fontSize: 11, color: theme.textSub }}>km</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            </ScrollView>
          </Animated.View>
        </>
      )}

      {/* ── MODALS ── */}
      <ConfirmModal
        visible={cancelSearchModal}
        title={`${t('mission_view.cancel_search')} ?`}
        message="Le remboursement sera traité sous 48h."
        confirmLabel={t('common.cancel')}
        cancelLabel={t('common.continue')}
        destructive
        onConfirm={doConfirmCancelSearching}
        onCancel={() => setCancelSearchModal(false)}
      />
      <ConfirmModal
        visible={cancelTrackModal}
        title={`${t('mission_view.cancel_mission')} ?`}
        message="Êtes-vous sûr de vouloir annuler ?"
        confirmLabel={t('missions.yes_cancel')}
        cancelLabel="Non"
        destructive
        onConfirm={doConfirmCancelTracking}
        onCancel={() => setCancelTrackModal(false)}
      />

      {/* ── TOASTS ── */}
      <ToastProvider />
    </View>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.45)' },

  // ─── SEARCHING ────────────────────────────────────────────────────────────
  searchingContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  radarZone: {
    width: '100%',
    height: height * 0.35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchingSheet: {
    width: '100%',
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 6 },
    }),
  },

  sheetHandle: {
    width: 38, height: 4, borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },

  missionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  missionName: { fontSize: 14, fontFamily: FONTS.sansMedium, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
  metaText: { fontSize: 12, flex: 1 },
  missionRight: { alignItems: 'flex-end', gap: 8, marginLeft: 12 },
  missionPrice: { fontSize: 24, fontFamily: FONTS.bebas, letterSpacing: 0.4 },
  quoteBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  quoteBadgeText: { fontSize: 12 },


  cancelSearchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5,
  },
  cancelSearchText: { fontSize: 15, letterSpacing: -0.2 },

  // ─── TRACKING ─────────────────────────────────────────────────────────────
  floatingTopBar: {
    position: 'absolute',
    top: 0, left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 8 : 44,
    gap: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  // recenterBtn removed — map auto-fits both pins on every location update
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 22,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  statusText: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 0.8 },

  trackingScroll: { maxHeight: height * 0.55 },
  trackingScrollContent: { paddingBottom: 4 },
  trackingSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
      android: { elevation: 8 },
    }),
  },

  etaRow: { alignItems: 'center', marginBottom: 12 },
  etaLabel: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 0.8, marginBottom: 4, textAlign: 'center', textTransform: 'uppercase' },
  etaTime: { fontSize: 40, fontFamily: FONTS.bebas, letterSpacing: 0.5, textAlign: 'center' },
  etaBadge: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },

  divider: { height: 1, marginVertical: 12 },

  // ── Premium provider card ──
  providerCard: {
    borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12,
    overflow: 'hidden',
  },
  providerCardTop: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  providerIdentity: { flex: 1, gap: 3 },
  providerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  providerName: { fontSize: 14, fontFamily: FONTS.sansMedium },
  verifiedBadge: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  providerCityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  providerCityText: { fontSize: 12 },
  providerDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },

  providerStats: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, paddingTop: 10, marginBottom: 10,
  },
  providerStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  providerStatValue: { fontSize: 13, fontFamily: FONTS.monoMedium },
  providerStatLabel: { fontSize: 10.5, fontFamily: FONTS.mono, letterSpacing: 0.5 },
  providerStatSep: { width: 1, height: 20 },

  providerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  providerChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  providerChipText: { fontSize: 11 },

  profileHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 4,
  },
  profileHintText: { fontSize: 12 },

  // ── Communication row ──
  comRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  comBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, borderRadius: 12,
  },
  comBtnSecondary: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  comBtnText: { fontSize: 14 },
  btnIconWrap: { marginRight: 8 },

  cancelTrackBtn: {
    flexDirection: 'row', paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelTrackText: { fontSize: 13 },

  ongoingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  ongoingText: { fontSize: 13, flex: 1 },

  // ─── PIN ────────────────────────────────────────────────────────────────
  pinVerifiedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 10, borderWidth: 1,
  },
  pinVerifiedText: { fontSize: 13, flex: 1 },

  // ─── Markers ──────────────────────────────────────────────────────────────
  clientMarker: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(26,26,26,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  clientMarkerInner: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2,
  },
});

// ─── PIN Card (TRACKING phase, inline) ───────────────────────────────────────
const pinStyles = StyleSheet.create({
  card: {
    paddingVertical: 4,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: FONTS.monoMedium, fontSize: 10, letterSpacing: 1.2 },
  digitsRow: { flexDirection: 'row', gap: 5 },
  digitBox: {
    width: 36, height: 40, borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  digitText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 1, lineHeight: 22 },
  hint: { fontFamily: FONTS.sans, fontSize: 11 },
  verified: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, marginVertical: 4,
  },
  verifiedText: { fontFamily: FONTS.sansMedium, fontSize: 13, flex: 1 },
});